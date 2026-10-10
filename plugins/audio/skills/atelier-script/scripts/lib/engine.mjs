// Node bridge to the Python engine worker (engine/synth.py) plus the draft-voice
// fallback. The worker loads Supertonic/faster-whisper once per process, reads one
// JSON job on stdin and writes one JSON result per line on stdout.
import { spawn } from 'node:child_process';
import { accessSync, constants, existsSync, mkdirSync, openSync, readSync, closeSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NATIVE_STACK, CANDIDATE_TAGS, nativeOk, baseVoice, loadNativeTable } from './native.mjs';

export const SYNTH_PY = fileURLToPath(new URL('../engine/synth.py', import.meta.url));
export const CLONE_PY = fileURLToPath(new URL('../engine/clone.py', import.meta.url));
export const DEFAULT_STEPS = 10;
const TAIL_LINES = 20;

// Setup is missing (no python, no venv packages, no ffmpeg). Maps to exit 2.
export class SetupError extends Error {
  constructor(message) { super(message); this.name = 'SetupError'; this.exitCode = 2; }
}

// The worker ran but failed. Maps to exit 2 (service error); message ends with the stderr tail.
export class EngineError extends Error {
  constructor(message, { code = null, stderr = '' } = {}) {
    super(message); this.name = 'EngineError'; this.exitCode = 2; this.code = code; this.stderr = stderr;
  }
}

function isExecutable(p) {
  try { accessSync(p, constants.X_OK); return true; } catch { return false; }
}

export function which(name, env = process.env) {
  for (const dir of String(env.PATH ?? '').split(delimiter)) {
    if (!dir) continue;
    const p = join(dir, name);
    if (isExecutable(p)) return p;
  }
  return null;
}

export function venvDir({ env = process.env, home = homedir() } = {}) {
  return env.AGENTATELIER_VENV || join(home, '.agentatelier', 'venv');
}

// The optional clone engine (Chatterbox voice conversion) has its own venv:
// AGENTATELIER_CLONE_VENV, else ~/.agentatelier/venv-clone.
export function cloneVenvDir({ env = process.env, home = homedir() } = {}) {
  return env.AGENTATELIER_CLONE_VENV || join(home, '.agentatelier', 'venv-clone');
}

export function venvPython(dir) {
  return process.platform === 'win32' ? join(dir, 'Scripts', 'python.exe') : join(dir, 'bin', 'python');
}

// Venv first (AGENTATELIER_VENV, then ~/.agentatelier/venv), then python3 on PATH.
export function findPython({ env = process.env, home = homedir() } = {}) {
  const dirs = [env.AGENTATELIER_VENV, join(home, '.agentatelier', 'venv')].filter(Boolean);
  for (const d of dirs) {
    const p = venvPython(d);
    if (isExecutable(p)) return p;
  }
  return which('python3', env) ?? which('python', env);
}

// Text that must never reach the engine. A script problem, so it maps to exit 1.
export class EngineTextError extends Error {
  constructor(message) { super(message); this.name = 'EngineTextError'; this.exitCode = 1; }
}

// Supertonic rewrites [ ] | / # _ to spaces (the tag becomes a spoken word) and
// speaks unknown tags. Only plain text plus free-standing native tags that the
// voice's row in the native-tag table allows (lib/native.mjs) may reach the
// engine, stacked no longer than NATIVE_STACK; the planner guarantees that, and
// this is the last gate before the worker. `calibrate` (calibrate.mjs only)
// lets every candidate tag through, to measure it.
export { NATIVE_STACK, stackOf } from './native.mjs';
export const ENGINE_TAGS = CANDIDATE_TAGS.map((t) => `<${t}>`);
const MAX_RUN = Object.fromEntries(Object.entries(NATIVE_STACK).map(([t, v]) => [`<${t}>`, typeof v === 'object' ? Math.max(...Object.values(v)) : v]));
export function assertEngineText(text, { voice, table, calibrate = false, env } = {}) {
  const t = String(text ?? '');
  const bad = t.match(/[[\]()*/|#_]/);
  if (bad) throw new EngineTextError(`engine text must not contain "${bad[0]}": ${JSON.stringify(t)}`);
  for (const m of t.matchAll(/<[^>]*>?/g)) {
    const before = t[m.index - 1];
    const after = t[m.index + m[0].length];
    // Free-standing: whitespace, punctuation or another tag on either side (stacks are joined: "<laugh><laugh>").
    const rest = t.slice(m.index + m[0].length);
    const free = (before === undefined || /[\s>]/.test(before)) && (after === undefined || /[\s.,!?;:]/.test(after) || ENGINE_TAGS.some((g) => rest.startsWith(g)));
    const candidate = ENGINE_TAGS.includes(m[0]);
    const allowed = candidate && (calibrate || nativeOk(voice, m[0].slice(1, -1), table, { env }));
    if (!allowed || !free) {
      const why = !candidate ? '' : !allowed ? ` (not native for voice ${baseVoice(voice, { env }) ?? voice}: see assets/native-tags.json)` : ' glued to a word';
      throw new EngineTextError(`engine text must not contain the tag "${m[0]}"${why}: ${JSON.stringify(t)}`);
    }
  }
  for (const [tag, max] of Object.entries(MAX_RUN)) {
    const run = new RegExp(`(?:${tag}\\s*){${max}}${tag}`);
    if (run.test(t)) throw new EngineTextError(`engine text must not stack more than ${max} ${tag} tags: ${JSON.stringify(t)}`);
  }
  if (ENGINE_TAGS.reduce((s, tag) => s.replaceAll(tag, ''), t).includes('>')) throw new EngineTextError(`engine text must not contain ">": ${JSON.stringify(t)}`);
}

function abortError(signal) {
  const e = new Error('engine worker aborted');
  e.name = 'AbortError';
  e.cause = signal?.reason;
  return e;
}

function killTree(child, sig) {
  try {
    if (process.platform !== 'win32') process.kill(-child.pid, sig);
    else child.kill(sig);
  } catch {
    try { child.kill(sig); } catch { /* already gone */ }
  }
}

// runWorker(job, {python, onProgress, signal}) → results[] (one per stdout JSON line).
// `script` overrides the worker path (tests use a fake worker run by node).
export async function runWorker(job, { python, onProgress, signal, script = SYNTH_PY, env = process.env, findPythonImpl = findPython, nativeTable } = {}) {
  if (signal?.aborted) throw abortError(signal);
  const py = python === undefined ? findPythonImpl({ env }) : (python ?? findPythonImpl({ env }));
  if (!py) throw new SetupError('No Python found for the audio engine. Run `node scripts/setup.mjs --check`, then `--install`.');
  if (job.mode === 'synth') for (const it of job.items ?? []) assertEngineText(it.text, { voice: it.voice, env, calibrate: job.calibrate === true, table: nativeTable ?? loadNativeTable({ env }) });
  const payload = JSON.stringify({ steps: DEFAULT_STEPS, ...job });

  return new Promise((resolve, reject) => {
    const results = [];
    const tail = [];
    let outBuf = '';
    let errBuf = '';
    let settled = false;
    let killTimer;
    const finish = (fn, v) => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      signal?.removeEventListener('abort', onAbort);
      fn(v);
    };
    const keep = (line) => { tail.push(line); if (tail.length > TAIL_LINES) tail.shift(); };

    let child;
    try {
      child = spawn(py, script.endsWith('.py') ? ['-B', script] : [script], {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: process.platform !== 'win32', // own process group, so abort can kill the whole tree
        env: { ...env, PYTHONDONTWRITEBYTECODE: '1', PYTHONUNBUFFERED: '1' },
      });
    } catch (e) {
      return finish(reject, new SetupError(`Cannot start the audio engine (${py}): ${e.message}`));
    }

    function onAbort() {
      killTree(child, 'SIGTERM');
      killTimer = setTimeout(() => killTree(child, 'SIGKILL'), 2000);
      killTimer.unref?.();
      finish(reject, abortError(signal));
    }
    signal?.addEventListener('abort', onAbort, { once: true });

    const onOutLine = (line) => {
      if (!line.trim()) return;
      let obj;
      try { obj = JSON.parse(line); } catch { keep(line); return; }
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) { if (!obj._done) results.push(obj); }
      else keep(line);
    };
    const onErrLine = (line) => {
      if (!line.trim()) return;
      if (line.startsWith('{')) {
        try {
          const obj = JSON.parse(line);
          if (obj && typeof obj.progress === 'number') { onProgress?.({ progress: obj.progress, total: obj.total }); return; }
        } catch { /* not JSON: keep as log */ }
      }
      keep(line);
    };
    const splitter = (getBuf, setBuf, onLine) => (chunk) => {
      const parts = (getBuf() + chunk).split('\n');
      setBuf(parts.pop());
      for (const l of parts) onLine(l.replace(/\r$/, ''));
    };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', splitter(() => outBuf, (v) => { outBuf = v; }, onOutLine));
    child.stderr.on('data', splitter(() => errBuf, (v) => { errBuf = v; }, onErrLine));
    child.stdin.on('error', () => { /* worker exited before reading; reported on close */ });

    child.on('error', (e) => {
      finish(reject, e.code === 'ENOENT' || e.code === 'EACCES'
        ? new SetupError(`Cannot start the audio engine (${py}): ${e.message}. Run \`node scripts/setup.mjs --install\`.`)
        : new EngineError(`engine worker failed to start: ${e.message}`));
    });
    child.on('close', (code, sig) => {
      if (outBuf) onOutLine(outBuf);
      if (errBuf) onErrLine(errBuf);
      const stderr = tail.join('\n');
      if (code === 0) return finish(resolve, results);
      if (code === 2) return finish(reject, new SetupError(`The audio engine is not installed in ${py} (exit 2). Run \`node scripts/setup.mjs --install\`.\n${stderr}`));
      finish(reject, new EngineError(`engine worker exited with code ${code ?? sig}\n${stderr}`, { code: code ?? sig, stderr }));
    });

    child.stdin.end(payload);
  });
}

// A worker that stays up for several jobs (engine/clone.py): one JSON job per
// stdin line; its results, then {"_done": true}, on stdout. The process starts
// on the first job and ends at close(). Jobs run one at a time.
// startWorker({python, script, env}) → {run(job, {onProgress}) → results[], close(), started}
export function startWorker({ python, script, env = process.env }) {
  let child = null;
  let queue = Promise.resolve();
  let current = null; // {results, resolve, reject, onProgress}
  const tail = [];
  const keep = (line) => { tail.push(line); if (tail.length > TAIL_LINES) tail.shift(); };
  let outBuf = '';
  let errBuf = '';
  let exited = null;
  const fail = (e) => { if (current) { const c = current; current = null; c.reject(e); } };
  function spawnChild() {
    if (!python) throw new SetupError('No Python found for the worker.');
    child = spawn(python, script.endsWith('.py') ? ['-B', script] : [script], {
      stdio: ['pipe', 'pipe', 'pipe'], env: { ...env, PYTHONDONTWRITEBYTECODE: '1', PYTHONUNBUFFERED: '1' },
    });
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdin.on('error', () => {});
    child.stdout.on('data', (c) => {
      const parts = (outBuf + c).split('\n');
      outBuf = parts.pop();
      for (const line of parts) {
        if (!line.trim()) continue;
        let obj;
        try { obj = JSON.parse(line); } catch { keep(line); continue; }
        if (!current) continue;
        if (obj?._done) { const c2 = current; current = null; c2.resolve(c2.results); } else current.results.push(obj);
      }
    });
    child.stderr.on('data', (c) => {
      const parts = (errBuf + c).split('\n');
      errBuf = parts.pop();
      for (const line of parts) {
        if (line.startsWith('{')) {
          try { const o = JSON.parse(line); if (typeof o.progress === 'number') { current?.onProgress?.({ progress: o.progress, total: o.total }); continue; } } catch { /* log */ }
        }
        if (line.trim()) keep(line);
      }
    });
    child.on('error', (e) => { exited = e; fail(e.code === 'ENOENT' || e.code === 'EACCES' ? new SetupError(`Cannot start the worker (${python}): ${e.message}`) : new EngineError(`worker failed to start: ${e.message}`)); });
    child.on('close', (code, sig) => {
      exited = exited ?? { code, sig };
      const stderr = tail.join('\n');
      fail(code === 2 ? new SetupError(`The worker's packages are not installed in ${python} (exit 2).\n${stderr}`) : new EngineError(`worker exited with code ${code ?? sig}\n${stderr}`, { code: code ?? sig, stderr }));
    });
  }
  const api = {
    get started() { return child !== null; },
    run(job, { onProgress } = {}) {
      const p = queue.then(() => new Promise((resolve, reject) => {
        if (exited) return reject(new EngineError(`worker is no longer running\n${tail.join('\n')}`));
        if (!child) {
          try { spawnChild(); } catch (e) { return reject(e); }
        }
        current = { results: [], resolve, reject, onProgress };
        child.stdin.write(JSON.stringify(job) + '\n');
      }));
      queue = p.catch(() => {});
      return p;
    },
    async close() {
      await queue;
      if (!child || exited) return;
      await new Promise((resolve) => {
        const t = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* gone */ } }, 10_000);
        t.unref?.();
        child.once('close', () => { clearTimeout(t); resolve(); });
        child.stdin.end();
      });
    },
  };
  return api;
}

// Duration of a PCM WAV from its header (data chunk size / byte rate).
export function wavDuration(path) {
  const fd = openSync(path, 'r');
  try {
    const head = Buffer.alloc(12);
    readSync(fd, head, 0, 12, 0);
    if (head.toString('ascii', 0, 4) !== 'RIFF' || head.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`not a WAV file: ${path}`);
    let pos = 12;
    let byteRate = 0;
    const hdr = Buffer.alloc(8);
    while (readSync(fd, hdr, 0, 8, pos) === 8) {
      const id = hdr.toString('ascii', 0, 4);
      const size = hdr.readUInt32LE(4);
      if (id === 'fmt ') {
        const fmt = Buffer.alloc(16);
        readSync(fd, fmt, 0, 16, pos + 8);
        byteRate = fmt.readUInt32LE(8);
      } else if (id === 'data') {
        if (!byteRate) throw new Error(`WAV without fmt chunk: ${path}`);
        return Math.round((size / byteRate) * 10000) / 10000;
      }
      pos += 8 + size + (size % 2);
    }
    throw new Error(`WAV without data chunk: ${path}`);
  } finally {
    closeSync(fd);
  }
}

function runCmd(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (c) => { err = (err + c).slice(-2000); });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new EngineError(`${cmd} exited with code ${code}\n${err}`, { code, stderr: err }))));
  });
}

// Timing-draft voice: macOS `say` or Linux `espeak-ng`, converted to 44.1 kHz mono
// 16-bit WAV. Never a final render; the result is marked draft: true.
export async function draftSynth(item, out, { platform = process.platform, run = runCmd, which: whichImpl = (n) => which(n) } = {}) {
  const text = String(item.text ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const rate = String(Math.round(175 * (item.speed ?? 1)));
  const say = platform === 'darwin' ? whichImpl('say') : null;
  const espeak = say ? null : whichImpl('espeak-ng');
  if (!say && !espeak) throw new SetupError('No draft voice available: needs macOS `say` or `espeak-ng`.');
  const ffmpeg = whichImpl('ffmpeg');
  if (!ffmpeg) throw new SetupError('ffmpeg not found; install it (macOS: `brew install ffmpeg`, Linux: `apt install ffmpeg`).');
  mkdirSync(dirname(out), { recursive: true });
  const tmpBase = join(tmpdir(), `agentatelier-draft-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const raw = `${tmpBase}.wav`; // say: AIFF is big-endian only, so LEI16 needs a WAVE container
  const textFile = `${tmpBase}.txt`; // text via a file: a line starting with "-" is never read as an option
  writeFileSync(textFile, text);
  try {
    if (say) await run(say, ['-r', rate, '-o', raw, '--data-format=LEI16@44100', '-f', textFile]);
    else await run(espeak, ['-s', rate, '-w', raw, '-f', textFile]);
    await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', raw, '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', out]);
  } finally {
    rmSync(raw, { force: true });
    rmSync(textFile, { force: true });
  }
  if (!existsSync(out)) throw new EngineError(`draft voice produced no file: ${out}`);
  return { id: item.id, path: out, duration_s: wavDuration(out), draft: true };
}
