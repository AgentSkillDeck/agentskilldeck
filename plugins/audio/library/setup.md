# Setup: ask once, then install

The engine runs on the user's machine: Supertonic 3 for voices, faster-whisper for QA, ffmpeg for everything audio. Nothing is installed without the user's say-so.

## 1. Check

```sh
node scripts/setup.mjs --check
```

Prints JSON and exits 0 when everything is ready, 2 when something is missing:

```json
{ "python": "/Users/me/.agentatelier/venv/bin/python", "venv": "/Users/me/.agentatelier/venv",
  "supertonic": "1.3.1", "whisper": "1.2.1", "model_cached": true,
  "ffmpeg": "/opt/homebrew/bin/ffmpeg", "ffprobe": "/opt/homebrew/bin/ffprobe", "ok": true }
```

Run it at the start of the first audio task in a conversation. If it exits 0, go straight to the work.

## 2. Ask once

If anything is missing, ask the user one question, with the facts:

> To render voices on this machine I need to install a Python environment at `~/.agentatelier/venv` with Supertonic 3 and faster-whisper, and download about 550 MB of models (400 MB voice, 150 MB speech recognition). It runs offline afterwards and nothing is sent anywhere. Install now? If not, I can make a draft with the system voice for timing only.

- **Yes:** run the install (step 3).
- **No:** use `--draft` renders for this conversation and do not ask again in it. Say clearly that draft output uses the system voice and is not a final.
- Once installed, `~/.agentatelier/config.json` records `"install_ok": true`. Later conversations see `--check` pass and never ask.

If only ffmpeg is missing, do not install the Python side yet; ask the user to install ffmpeg first (below). The tools never run a system package manager themselves.

## 3. Install

```sh
node scripts/setup.mjs --install
```

Four steps, with progress on stderr: find Python 3, create the venv (if needed), `pip install` the pinned packages (`supertonic==1.3.1`, `faster-whisper==1.2.1`, `soundfile`, `numpy`), then warm the models by synthesising and transcribing one word (this is the ~550 MB download). It prints the final check and exits 0 when ready, 2 otherwise. Expect several minutes on the first run.

Install ffmpeg (needed for every render, draft included):
- macOS: `brew install ffmpeg`
- Debian or Ubuntu: `sudo apt install ffmpeg`
- Windows: `winget install Gyan.FFmpeg`

Python 3.10 or later is required; on macOS, `brew install python` if `python3` is missing.

## Optional: the free clone engine

Only when the user wants a clone of their own voice (`voice: clone:<name>`, see [your-voice](your-voice.md)). `--check` reports it under `"clone"` (`"optional": true`); its absence never fails the check. A render with a clone voice and no clone engine exits 2 with this hint. Ask once, with the facts:

> To clone your voice on this machine I need to install a second Python environment at `~/.agentatelier/venv-clone` with Chatterbox voice conversion (Resemble AI, MIT): about 1.5 GB of packages (PyTorch) and 1.1 GB of model weights. It runs offline afterwards, nothing is uploaded, and every converted line carries an imperceptible watermark that marks it as AI-generated. Install now?

```sh
node scripts/setup.mjs --install-clone
```

It creates the venv, installs `chatterbox-tts==0.1.7` and `setuptools<81` (the watermarker needs `pkg_resources`), then loads the converter once (the weight download). `~/.agentatelier/config.json` records `"clone_install_ok": true`. If the user declines, cast a preset or `voice: record` instead. It runs on Apple-silicon GPUs (MPS), CUDA or the CPU; set `AGENTATELIER_CLONE_DEVICE=cpu` to force the CPU.

## Overrides

| Variable | Effect |
|---|---|
| `AGENTATELIER_VENV` | use a different venv directory |
| `AGENTATELIER_CLONE_VENV` | use a different clone venv (default `~/.agentatelier/venv-clone`) |
| `AGENTATELIER_VOICES` | where clone voices live (default `~/.agentatelier/voices`) |
| `AGENTATELIER_CLONE_DEVICE` | `mps`, `cuda` or `cpu` for the clone engine |
| `SUPERTONIC_CACHE_DIR` | where the voice model lives (default `~/.cache/supertonic3`) |
| `AGENTATELIER_FFMPEG` | ffmpeg binary used by the sound generator |
| `FREESOUND_TOKEN` | optional Freesound API token for more sound effects |

## Draft fallback

`produce.mjs --draft` uses macOS `say` or Linux `espeak-ng` at the planned speed, so it works before the engine is installed (ffmpeg is still needed). Drafts are for timing and structure only: `qa.json` has `"draft": true` and the output says "draft voice". Never deliver a draft as final unless the user explicitly accepts it. A final render (no `--draft`) with setup missing exits 2 with the `setup.mjs --install` hint instead of silently falling back.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `python3 not found` | install Python 3.10 or later, then re-run `--install` |
| `pip` fails on a package | re-run `--install`; if it still fails, show the user the last lines of the error |
| `model_cached: false` after install | the download was interrupted; re-run `--install` |
| `ffmpeg: null` | install ffmpeg (above) |
| everything installed but `ok: false` | check `AGENTATELIER_VENV` is not pointing at an old venv |

Exit codes of every script: 0 ok, 1 usage or script error, 2 setup missing or service error, 3 QA failed (outputs kept).
