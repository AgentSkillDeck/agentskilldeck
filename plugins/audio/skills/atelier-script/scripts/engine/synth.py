"""agentatelier audio engine worker (Supertonic 3 TTS + faster-whisper ASR).

Protocol: one JSON job on stdin, one JSON result per line on stdout, progress as
JSON lines {"progress": i, "total": n} on stderr. Models load once per process.

  {"mode": "synth", "steps": 10, "out_dir": "...", "items": [{id, text, voice, lang, speed, seed}]}
      -> {id, path, duration_s}   (44.1 kHz mono 16-bit WAV at <out_dir>/<id>.t<seed>.wav,
                                   so a retake never overwrites an earlier take; seed defaults to 0)
  {"mode": "asr", "items": [{id, path, lang}]}
      -> {id, text, words: [{w, start, end, p}]}   (base.en for en, else base)
  {"mode": "voices"}
      -> {id, voice}

Exit codes: 0 ok, 1 bad job or engine failure, 2 engine packages not installed.
Audio is loaded with soundfile and resampled with numpy: faster-whisper's own
decode_audio goes through PyAV, which breaks with the installed `av`.
Run with `python -B` (the bridge does) so no __pycache__ is written.
"""
import json
import os
import re
import sys
import traceback

sys.dont_write_bytecode = True

# Keep stdout for protocol lines only: anything the libraries print (download
# notices, warnings, C-level output) goes to stderr instead.
_proto = os.fdopen(os.dup(1), "w", buffering=1, encoding="utf-8")
os.dup2(2, 1)
sys.stdout = sys.stderr

SR = 44100
ASR_SR = 16000


def emit(obj):
    _proto.write(json.dumps(obj, ensure_ascii=False) + "\n")
    _proto.flush()


def progress(i, total):
    sys.stderr.write(json.dumps({"progress": i, "total": total}) + "\n")
    sys.stderr.flush()


def safe_name(item_id):
    return re.sub(r"[^A-Za-z0-9._-]+", "_", str(item_id)).strip("._") or "item"


try:
    import numpy as np
    import soundfile as sf
except ImportError as e:  # setup missing
    sys.stderr.write(f"setup: {e}\n")
    sys.exit(2)


class Engine:
    def __init__(self):
        self._tts = None
        self._styles = {}
        self._asr = {}

    def tts(self):
        if self._tts is None:
            try:
                from supertonic import TTS
            except ImportError as e:
                sys.stderr.write(f"setup: {e}\n")
                sys.exit(2)
            self._tts = TTS(auto_download=True)
        return self._tts

    def style(self, voice):
        if voice not in self._styles:
            self._styles[voice] = self.tts().get_voice_style(voice_name=voice)
        return self._styles[voice]

    def whisper(self, name):
        if name not in self._asr:
            try:
                from faster_whisper import WhisperModel
            except ImportError as e:
                sys.stderr.write(f"setup: {e}\n")
                sys.exit(2)
            self._asr[name] = WhisperModel(name, device="cpu", compute_type="int8")
        return self._asr[name]


def synth(engine, job):
    items = job.get("items") or []
    steps = int(job.get("steps") or 10)
    out_dir = os.path.abspath(job.get("out_dir") or ".")
    os.makedirs(out_dir, exist_ok=True)
    tts = engine.tts()
    for i, it in enumerate(items, 1):
        seed = int(it.get("seed") or 0)
        np.random.seed(seed)  # diffusion sampling uses numpy's global RNG: seed = take
        speed = min(2.0, max(0.7, float(it.get("speed") or 1.0)))
        wav, _ = tts.synthesize(
            str(it["text"]),
            voice_style=engine.style(it.get("voice") or "M1"),
            total_steps=steps,
            speed=speed,
            lang=it.get("lang") or "en",
        )
        wav = np.clip(np.ravel(wav).astype("float32"), -1.0, 1.0)
        path = os.path.join(out_dir, f"{safe_name(it['id'])}.t{seed}.wav")
        sf.write(path, wav, SR, subtype="PCM_16")
        emit({"id": it["id"], "path": path, "duration_s": round(len(wav) / SR, 4)})
        progress(i, len(items))


def load_16k(path):
    a, sr = sf.read(path, dtype="float32", always_2d=False)
    if a.ndim > 1:
        a = a.mean(axis=1)
    if sr != ASR_SR and len(a):
        n = max(1, int(round(len(a) * ASR_SR / sr)))
        a = np.interp(np.linspace(0, len(a) - 1, n), np.arange(len(a)), a)
    return np.ascontiguousarray(a, dtype="float32")


def asr(engine, job):
    items = job.get("items") or []
    for i, it in enumerate(items, 1):
        lang = it.get("lang") or "en"
        english = lang == "en"
        model = engine.whisper("base.en" if english else "base")
        language = "en" if english else (None if lang in ("na", "auto", "mixed") else lang)
        segments, _ = model.transcribe(load_16k(it["path"]), language=language, beam_size=5, word_timestamps=True)
        words, texts = [], []
        for seg in segments:
            texts.append(seg.text.strip())
            for w in seg.words or []:
                words.append({"w": w.word.strip(), "start": round(float(w.start), 3), "end": round(float(w.end), 3), "p": round(float(w.probability), 3)})
        emit({"id": it["id"], "text": " ".join(t for t in texts if t), "words": words})
        progress(i, len(items))


def voices(engine, job):
    from supertonic.config import get_model_cache_dir  # noqa: E402

    engine.tts()
    d = os.path.join(str(get_model_cache_dir("supertonic-3")), "voice_styles")
    names = sorted(f[:-5] for f in os.listdir(d) if f.endswith(".json")) if os.path.isdir(d) else []
    for n in names or ["F1", "F2", "F3", "F4", "F5", "M1", "M2", "M3", "M4", "M5"]:
        emit({"id": n, "voice": n})


MODES = {"synth": synth, "asr": asr, "voices": voices}


def main():
    try:
        job = json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError as e:
        sys.stderr.write(f"bad job JSON: {e}\n")
        return 1
    fn = MODES.get(job.get("mode"))
    if fn is None:
        sys.stderr.write(f"unknown mode {job.get('mode')!r}; expected synth|asr|voices\n")
        return 1
    try:
        fn(Engine(), job)
    except SystemExit:
        raise
    except Exception:
        traceback.print_exc(file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
