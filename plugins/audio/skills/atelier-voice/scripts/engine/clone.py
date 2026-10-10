"""agentatelier clone worker: Chatterbox voice conversion (Resemble AI, MIT).

Turns a Supertonic render into the timbre of a reference recording, keeping
its words, timing and delivery. Runs in its own venv (~/.agentatelier/venv-clone,
`setup.mjs --install-clone`): chatterbox-tts==0.1.7 and setuptools<81 (the
PerTh watermarker needs pkg_resources). ChatterboxVC applies Resemble's PerTh
imperceptible watermark to every output; it is kept on.

Protocol (as synth.py, plus a session): JSON jobs on stdin, one per line; for
each job one JSON result per line on stdout, then {"_done": true}; progress as
JSON lines {"progress": i, "total": n} on stderr. The process serves jobs until
stdin closes, so produce keeps one converter (and one model load, ~30 s) for
the whole run: take 0, every retake round and the nonverbal fallback.

  {"mode": "convert", "items": [{id, src_path, ref_path, out, seed?}]}
      -> {id, path, duration_s, sample_rate}   (16-bit mono WAV at `out`, model rate 24 kHz)
  {"mode": "warm"}
      -> {id: "warm", device}                  (downloads the weights, ~1.1 GB, once)

Device: AGENTATELIER_CLONE_DEVICE, else mps when available, else cpu; a load
failure on mps falls back to cpu. Saved with soundfile (torchaudio.save needs
torchcodec). Exit codes: 0 ok, 1 bad job or engine failure, 2 packages missing.
"""
import json
import os
import sys
import traceback

sys.dont_write_bytecode = True

_proto = os.fdopen(os.dup(1), "w", buffering=1, encoding="utf-8")
os.dup2(2, 1)
sys.stdout = sys.stderr


def emit(obj):
    _proto.write(json.dumps(obj, ensure_ascii=False) + "\n")
    _proto.flush()


def progress(i, total):
    sys.stderr.write(json.dumps({"progress": i, "total": total}) + "\n")
    sys.stderr.flush()


try:
    import numpy as np
    import soundfile as sf
    import torch
except ImportError as e:
    sys.stderr.write(f"setup: {e}\n")
    sys.exit(2)


def pick_device():
    want = os.environ.get("AGENTATELIER_CLONE_DEVICE")
    if want:
        return want
    try:
        if torch.backends.mps.is_available():
            return "mps"
    except Exception:
        pass
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


class Converter:
    def __init__(self):
        self._vc = None
        self.device = None
        self._ref = None

    def vc(self):
        if self._vc is None:
            try:
                from chatterbox.vc import ChatterboxVC
            except ImportError as e:
                sys.stderr.write(f"setup: {e}\n")
                sys.exit(2)
            dev = pick_device()
            try:
                self._vc = ChatterboxVC.from_pretrained(dev)
            except Exception:
                if dev == "cpu":
                    raise
                traceback.print_exc(file=sys.stderr)
                sys.stderr.write(f"clone: {dev} failed, falling back to cpu\n")
                dev = "cpu"
                self._vc = ChatterboxVC.from_pretrained(dev)
            self.device = dev
        return self._vc

    def target(self, ref_path):
        # The reference embedding is computed once per distinct reference.
        if self._ref != ref_path:
            self.vc().set_target_voice(ref_path)
            self._ref = ref_path


def convert(cv, job):
    items = job.get("items") or []
    vc = cv.vc()
    for i, it in enumerate(items, 1):
        cv.target(it["ref_path"])
        torch.manual_seed(int(it.get("seed") or 0))
        wav = vc.generate(it["src_path"])
        a = np.clip(wav.squeeze().detach().cpu().numpy().astype("float32"), -1.0, 1.0)
        out = os.path.abspath(it["out"])
        os.makedirs(os.path.dirname(out), exist_ok=True)
        sf.write(out, a, vc.sr, subtype="PCM_16")
        emit({"id": it["id"], "path": out, "duration_s": round(len(a) / vc.sr, 4), "sample_rate": vc.sr})
        progress(i, len(items))


def warm(cv, job):
    cv.vc()
    emit({"id": "warm", "device": cv.device})


MODES = {"convert": convert, "warm": warm}


def run_job(cv, line):
    try:
        job = json.loads(line)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"bad job JSON: {e}\n")
        return 1
    fn = MODES.get(job.get("mode"))
    if fn is None:
        sys.stderr.write(f"unknown mode {job.get('mode')!r}; expected convert|warm\n")
        return 1
    fn(cv, job)
    emit({"_done": True})
    return 0


def main():
    cv = Converter()  # one model for every job of this process
    try:
        for line in sys.stdin:
            if not line.strip():
                continue
            code = run_job(cv, line)
            if code:
                return code
    except SystemExit:
        raise
    except Exception:
        traceback.print_exc(file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
