#!/usr/bin/env node
// Engine setup: `--check` reports what is installed; `--install` creates the venv,
// installs engine/requirements.txt and warms the models. The agent asks the user
// before the first --install (it downloads ~550 MB of models).
// `--install-clone` adds the optional free voice-cloning engine (Chatterbox voice
// conversion, MIT) in its own venv: ~1.5 GB of packages (torch) plus ~1.1 GB of
// weights. The agent asks once, the first time the user wants a clone voice.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findPython, runWorker, venvDir, venvPython, cloneVenvDir, which as whichOnPath, SetupError, CLONE_PY } from './lib/engine.mjs';

const USAGE = 'Usage: node setup.mjs --check | --install | --install-clone';
export const REQUIREMENTS = fileURLToPath(new URL('./engine/requirements.txt', import.meta.url));
export const CLONE_REQUIREMENTS = fileURLToPath(new URL('./engine/requirements-clone.txt', import.meta.url));
export const CLONE_SIZE_NOTE = 'about 1.5 GB of packages (PyTorch) plus 1.1 GB of model weights';
const ONNX = ['duration_predictor', 'text_encoder', 'vector_estimator', 'vocoder'];

function runCapture(cmd, args, env) {
  return new Promise((resolve) => {
    let out = '';
    let child;
    try { child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'ignore'], env: { ...env, PYTHONDONTWRITEBYTECODE: '1' } }); } catch { return resolve(null); }
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (c) => { out += c; });
    child.on('error', () => resolve(null));
    child.on('close', (code) => resolve(code === 0 ? out : null));
  });
}

// Package versions without importing the heavy libraries.
const PROBE = 'import json, importlib.metadata as m\n'
  + 'def v(n):\n    try: return m.version(n)\n    except Exception: return None\n'
  + 'print(json.dumps({"supertonic": v("supertonic"), "whisper": v("faster-whisper")}))';

async function defaultProbe(python, env) {
  const out = await runCapture(python, ['-B', '-c', PROBE], env);
  try { return JSON.parse(out); } catch { return { supertonic: null, whisper: null }; }
}

function modelCached(env, home) {
  const dir = join(env.SUPERTONIC_CACHE_DIR || join(home, '.cache', 'supertonic3'), 'onnx');
  try {
    const have = new Set(readdirSync(dir));
    return ONNX.every((f) => have.has(`${f}.onnx`));
  } catch {
    return false;
  }
}

export async function checkSetup({ env = process.env, home = homedir(), which = (n) => whichOnPath(n, env), probe = defaultProbe } = {}) {
  const dir = venvDir({ env, home });
  const python = findPython({ env, home });
  const venv = existsSync(venvPython(dir)) ? dir : null;
  const versions = python ? await probe(python, env) : {};
  const r = {
    python,
    venv,
    supertonic: versions?.supertonic ?? null,
    whisper: versions?.whisper ?? null,
    model_cached: modelCached(env, home),
    ffmpeg: which('ffmpeg'),
    ffprobe: which('ffprobe'),
  };
  r.ok = Boolean(r.python && r.supertonic && r.whisper && r.model_cached && r.ffmpeg && r.ffprobe);
  return r;
}

const CLONE_PROBE = 'import json, importlib.metadata as m\n'
  + 'def v(n):\n    try: return m.version(n)\n    except Exception: return None\n'
  + 'print(json.dumps({"chatterbox": v("chatterbox-tts"), "torch": v("torch")}))';

async function defaultCloneProbe(python, env) {
  const out = await runCapture(python, ['-B', '-c', CLONE_PROBE], env);
  try { return JSON.parse(out); } catch { return { chatterbox: null, torch: null }; }
}

function hfHub(env, home) {
  if (env.HF_HUB_CACHE) return env.HF_HUB_CACHE;
  if (env.HF_HOME) return join(env.HF_HOME, 'hub');
  return join(home, '.cache', 'huggingface', 'hub');
}

function cloneWeightsCached(env, home) {
  const snaps = join(hfHub(env, home), 'models--ResembleAI--chatterbox', 'snapshots');
  try { return readdirSync(snaps).some((d) => existsSync(join(snaps, d, 's3gen.safetensors'))); } catch { return false; }
}

// The optional clone engine. ok = the venv has chatterbox; the weights download on first use.
export async function checkCloneSetup({ env = process.env, home = homedir(), probe = defaultCloneProbe } = {}) {
  const dir = cloneVenvDir({ env, home });
  const py = venvPython(dir);
  const python = existsSync(py) ? py : null;
  const versions = python ? await probe(python, env) : {};
  const r = {
    optional: true,
    venv: python ? dir : null,
    python,
    chatterbox: versions?.chatterbox ?? null,
    torch: versions?.torch ?? null,
    model_cached: cloneWeightsCached(env, home),
  };
  r.ok = Boolean(r.python && r.chatterbox);
  return r;
}

// Loads ChatterboxVC once (downloads the weights).
async function defaultWarmClone(python) {
  await runWorker({ mode: 'warm' }, { python, script: CLONE_PY });
}

// Streams the child's output to our stderr so pip progress is visible.
function runLoud(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 2, 2], env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.slice(0, 3).join(' ')} exited with code ${code}`))));
  });
}

// One-word synth (downloads/loads Supertonic) and its transcription (downloads whisper base.en).
async function defaultWarm(python) {
  const dir = mkdtempSync(join(tmpdir(), 'agentatelier-warm-'));
  try {
    const [s] = await runWorker({ mode: 'synth', out_dir: dir, items: [{ id: 'warm', text: 'Hello.', voice: 'M1', lang: 'en', speed: 1, seed: 0 }] }, { python });
    await runWorker({ mode: 'asr', items: [{ id: 'warm', path: s.path, lang: 'en' }] }, { python });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function recordInstall(home, key = 'install_ok') {
  const dir = join(home, '.agentatelier');
  const file = join(dir, 'config.json');
  let cfg = {};
  try { cfg = JSON.parse(readFileSync(file, 'utf8')); } catch { /* new or unreadable: start fresh */ }
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, JSON.stringify({ ...cfg, [key]: true }, null, 2) + '\n');
}

async function installClone({ env, home, which, run, warmClone, cloneProbe, stdout }) {
  const dir = cloneVenvDir({ env, home });
  const vpy = venvPython(dir);
  stdout(`Installing the free voice-cloning engine (Chatterbox voice conversion by Resemble AI, MIT): ${CLONE_SIZE_NOTE}.\n`);
  stdout('[1/4] Finding Python 3\n');
  if (!existsSync(vpy)) {
    const base = which('python3') ?? which('python');
    if (!base) throw new SetupError('python3 not found on PATH; install Python 3.10+ first (macOS: `brew install python`).');
    stdout(`[2/4] Creating venv at ${dir}\n`);
    await run(base, ['-m', 'venv', dir]);
  } else {
    stdout(`[2/4] Venv exists at ${dir}\n`);
  }
  stdout('[3/4] Installing chatterbox-tts 0.1.7 (with PyTorch) and setuptools<81\n');
  await run(vpy, ['-m', 'pip', 'install', '--disable-pip-version-check', '-r', CLONE_REQUIREMENTS]);
  stdout('[4/4] Loading the voice converter once (downloads the weights)\n');
  await warmClone(vpy);
  recordInstall(home, 'clone_install_ok');
  const r = await checkCloneSetup({ env, home, probe: cloneProbe });
  stdout(JSON.stringify(r, null, 2) + '\n');
  stdout('Every converted line carries Resemble AI\'s PerTh imperceptible watermark (kept on). Clone only your own voice, or a voice whose owner agreed.\n');
  return r.ok ? 0 : 2;
}

async function install({ env, home, which, probe, run, warm, stdout }) {
  const dir = venvDir({ env, home });
  const vpy = venvPython(dir);
  stdout('[1/4] Finding Python 3\n');
  if (!existsSync(vpy)) {
    const base = which('python3') ?? which('python');
    if (!base) throw new SetupError('python3 not found on PATH; install Python 3.10+ first (macOS: `brew install python`).');
    stdout(`[2/4] Creating venv at ${dir}\n`);
    await run(base, ['-m', 'venv', dir]);
  } else {
    stdout(`[2/4] Venv exists at ${dir}\n`);
  }
  stdout('[3/4] Installing engine packages (supertonic, faster-whisper, soundfile, numpy)\n');
  await run(vpy, ['-m', 'pip', 'install', '--disable-pip-version-check', '-r', REQUIREMENTS]);
  stdout('[4/4] Warming the models (first run downloads ~550 MB)\n');
  await warm(vpy);
  recordInstall(home);
  const r = await checkSetup({ env, home, which, probe });
  stdout(JSON.stringify(r, null, 2) + '\n');
  if (!r.ffmpeg || !r.ffprobe) {
    stdout('ffmpeg/ffprobe missing: install with `brew install ffmpeg` (macOS) or `sudo apt install ffmpeg` (Linux).\n');
  }
  return r.ok ? 0 : 2;
}

export async function main(argv, {
  env = process.env, home = homedir(), which, probe = defaultProbe, run = runLoud, warm = defaultWarm,
  cloneProbe = defaultCloneProbe, warmClone = defaultWarmClone,
  stdout = (s) => process.stdout.write(s), stderr = (s) => process.stderr.write(s),
} = {}) {
  if (argv.includes('--help') || argv.includes('-h')) { stdout(`${USAGE}\n`); return 0; }
  const look = which ?? ((n) => whichOnPath(n, env));
  const mode = argv.length === 1 ? argv[0] : null;
  if (mode !== '--check' && mode !== '--install' && mode !== '--install-clone') { stderr(USAGE + '\n'); return 1; }
  try {
    if (mode === '--check') {
      // The clone engine is optional: reported, never part of `ok`.
      const r = await checkSetup({ env, home, which: look, probe });
      const clone = await checkCloneSetup({ env, home, probe: cloneProbe });
      stdout(JSON.stringify({ ...r, clone }, null, 2) + '\n');
      return r.ok ? 0 : 2;
    }
    if (mode === '--install-clone') return await installClone({ env, home, which: look, run, warmClone, cloneProbe, stdout });
    return await install({ env, home, which: look, probe, run, warm, stdout });
  } catch (e) {
    stderr(`setup: ${e?.message ?? e}\n`);
    return 2;
  }
}

// Compare real paths so the script also runs when invoked through a symlink.
const isMain = (() => { try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; } })();

if (isMain) {
  process.exitCode = await main(process.argv.slice(2));
}
