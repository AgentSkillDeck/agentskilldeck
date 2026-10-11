// Shared render steps for produce.mjs and audition.mjs: engine selection,
// content-addressed batch synthesis and ASR (one worker process per batch),
// and nonverbal clips from the bundled pack or a licensed search.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { runWorker, startWorker, draftSynth as defaultDraftSynth, SetupError, EngineError, EngineTextError, DEFAULT_STEPS, CLONE_PY, cloneVenvDir, venvPython } from './engine.mjs';
import { run, readWavInfo, isPcm16Mono, SR } from './ffmpeg.mjs';
import { parseVoice, loadCloneVoice } from './voices.mjs';
import { parseAstats } from './master.mjs';
import { resolveCue, genderOf } from './sounds/index.mjs';
import { UsageError } from './args.mjs';
import { PlanError } from './plan.mjs';

export const VOICES = ['F1', 'F2', 'F3', 'F4', 'F5', 'M1', 'M2', 'M3', 'M4', 'M5'];
export const INSTALL_HINT = 'Run `node scripts/setup.mjs --check`, then `node scripts/setup.mjs --install` (asks once, downloads ~550 MB), or pass --draft for a timing draft with the system voice.';
export const CLONE_INSTALL_HINT = 'The free voice-cloning engine (Chatterbox voice conversion) is not installed. Run `node scripts/setup.mjs --check`; once the user agrees (about 2.6 GB, asked once), `node scripts/setup.mjs --install-clone`. Or pass --draft for a timing draft.';

export const sha = (obj) => createHash('sha256').update(JSON.stringify(obj)).digest('hex');

// Exit codes (global constraints): 1 script/usage, 2 setup or service, 3 QA (set by the caller).
export function exitCodeFor(e) {
  if (e instanceof UsageError || e instanceof PlanError || e instanceof EngineTextError || e?.exitCode === 1) return 1;
  if (e instanceof SetupError || e instanceof EngineError || e?.name === 'ServiceError' || e?.exitCode === 2) return 2;
  return 2;
}

// Which voice engine renders this run. `engine` ({python, script}) overrides
// discovery (tests, AGENTSKILLDECK_ENGINE_SCRIPT); otherwise the venv must have
// supertonic + faster-whisper, unless the user asked for a draft.
// clone: the run has clone:<name> voices, so the clone engine (engine.clone =
// {python, script}) is needed too: `engine.clone`, AGENTSKILLDECK_CLONE_SCRIPT
// (+ AGENTSKILLDECK_CLONE_PYTHON), or the clone venv.
export async function selectEngine({ draft, engine, env = process.env, checkSetupImpl, clone = false, checkCloneImpl }) {
  if (draft) return { mode: 'draft' };
  let e;
  const script = engine?.script ?? env.AGENTSKILLDECK_ENGINE_SCRIPT;
  if (script) {
    const python = engine?.python ?? env.AGENTSKILLDECK_ENGINE_PYTHON ?? (script.endsWith('.py') ? undefined : process.execPath);
    e = { mode: 'engine', script, python };
  } else {
    const check = checkSetupImpl ?? (await import('../setup.mjs')).checkSetup;
    const s = await check({ env });
    if (!s.python || !s.supertonic || !s.whisper) {
      const missing = [!s.python && 'python', !s.supertonic && 'supertonic', !s.whisper && 'faster-whisper'].filter(Boolean).join(', ');
      throw new SetupError(`The voice engine is not installed (missing: ${missing}). ${INSTALL_HINT}`);
    }
    e = { mode: 'engine', python: s.python };
  }
  if (clone) e.clone = await selectClone({ engine, env, checkCloneImpl });
  return e;
}

// One clone worker for a whole run, started on the first conversion (a fully
// cached run starts none). The caller closes it.
export function openCloneSession(engine, env = process.env) {
  if (!engine?.clone) return null;
  engine.clone.session = startWorker({ python: engine.clone.python, script: engine.clone.script, env });
  return engine.clone.session;
}

async function selectClone({ engine, env, checkCloneImpl }) {
  if (engine?.clone) return { ...engine.clone };
  const script = env.AGENTSKILLDECK_CLONE_SCRIPT;
  if (script) return { script, python: env.AGENTSKILLDECK_CLONE_PYTHON ?? (script.endsWith('.py') ? venvPython(cloneVenvDir({ env })) : process.execPath) };
  const check = checkCloneImpl ?? (await import('../setup.mjs')).checkCloneSetup;
  const s = await check({ env });
  if (!s.ok) throw new SetupError(CLONE_INSTALL_HINT);
  return { script: CLONE_PY, python: s.python };
}

const workerOpts = (engine, env, onProgress) => ({
  ...(engine.script ? { script: engine.script } : {}),
  ...(engine.python ? { python: engine.python } : {}),
  env, onProgress,
});

export const synthKey = (engine, it) => sha({ v: 1, engine: engine.mode, steps: DEFAULT_STEPS, text: it.text, voice: it.voice, lang: it.lang ?? 'en', speed: it.speed ?? 1, seed: it.seed ?? 0 });

// A converted take: the Supertonic take it came from, the reference audio and the seed.
export const cloneKey = (baseKey, refSha, seed) => sha({ v: 1, convert: 'chatterbox-vc-0.1.7', base: baseKey, ref: refSha, seed: seed ?? 0 });

// items: [{text, voice, lang, speed, seed}] → same order: {key, path, duration_s, cached}.
// Cached by the sha256 of the item JSON in <cacheDir>/synth/; misses go to one worker process.
// A clone:<name> item is rendered with the clone's base voice (in the same
// Supertonic batch), then converted to the reference's timbre by the clone
// worker (one process for the batch's misses), level-matched to the
// Supertonic take and stored at 44.1 kHz. Draft runs skip the conversion.
export async function synthBatch(items, opts = {}) {
  const { cacheDir, engine, env = process.env, onProgress } = opts;
  const forms = items.map((it) => parseVoice(it.voice));
  if (!forms.some((f) => f.kind === 'clone')) return synthPlain(items, opts);
  const voices = new Map();
  const cloneOf = (f) => {
    const k = `${f.name}@${f.base ?? ''}`;
    if (!voices.has(k)) voices.set(k, loadCloneVoice(f.name, { env, ...(f.base ? { base: f.base } : {}) }));
    return voices.get(k);
  };
  const base = items.map((it, i) => (forms[i].kind === 'clone' ? { ...it, voice: cloneOf(forms[i]).base } : it));
  const synth = await synthPlain(base, opts);
  if (engine.mode !== 'engine') return synth;
  if (!engine.clone) throw new SetupError(CLONE_INSTALL_HINT);
  const dir = join(cacheDir, 'synth');
  const keyOf = (i) => cloneKey(synth[i].key, cloneOf(forms[i]).ref_sha, items[i].seed);
  const done = new Map();
  const misses = new Map();
  items.forEach((it, i) => {
    if (forms[i].kind !== 'clone') return;
    const key = keyOf(i);
    const path = join(dir, `${key}.wav`);
    if (done.has(key) || misses.has(key)) return;
    if (existsSync(path) && existsSync(`${path}.json`)) done.set(key, { key, path, duration_s: JSON.parse(readFileSync(`${path}.json`, 'utf8')).duration_s, cached: true });
    else misses.set(key, { id: key, src_path: synth[i].path, ref_path: cloneOf(forms[i]).ref_path, seed: it.seed ?? 0 });
  });
  if (misses.size) {
    const tmp = join(dir, 'tmp-clone');
    mkdirSync(tmp, { recursive: true });
    let results;
    try {
      const job = { mode: 'convert', items: [...misses.values()].map((m) => ({ ...m, out: join(tmp, `${m.id}.wav`) })) };
      // A session (produce) keeps one converter process for the whole run.
      results = engine.clone.session ? await engine.clone.session.run(job, { onProgress }) : await runWorker(job, workerOpts(engine.clone, env, onProgress));
    } catch (e) {
      if (e instanceof SetupError) throw new SetupError(`${CLONE_INSTALL_HINT}\n${e.message}`);
      throw e;
    }
    for (const r of results) {
      const m = misses.get(r.id);
      if (!m) continue;
      const final = join(dir, `${r.id}.wav`);
      const fin = await finishConverted(r.path, m.src_path, final);
      writeFileSync(`${final}.json`, JSON.stringify({ duration_s: fin.duration_s }) + '\n');
      done.set(r.id, { key: r.id, path: final, duration_s: fin.duration_s, cached: false });
    }
    rmSync(tmp, { recursive: true, force: true });
  }
  return items.map((it, i) => {
    if (forms[i].kind !== 'clone') return synth[i];
    const r = done.get(keyOf(i));
    if (!r) throw new EngineError(`the clone engine returned no audio for "${it.text}"`);
    return r;
  });
}

// Converted audio comes back at the model's rate and level: match the
// Supertonic take's level (active RMS, within ±12 dB) and store 44.1 kHz mono s16.
async function finishConverted(conv, src, dest) {
  const [c, sdb] = [await activeRmsDb(conv), await activeRmsDb(src)];
  const gain = Number.isFinite(c) && Number.isFinite(sdb) ? Math.max(-12, Math.min(12, sdb - c)) : 0;
  const info = await readWavInfo(conv);
  if (isPcm16Mono(info) && Math.abs(gain) < 0.5) renameSync(conv, dest);
  else {
    await run(['-i', conv, '-af', `aresample=${SR},volume=${gain.toFixed(2)}dB`, '-ac', '1', '-ar', String(SR), '-c:a', 'pcm_s16le', `${dest}.part.wav`]);
    renameSync(`${dest}.part.wav`, dest);
  }
  const out = await readWavInfo(dest);
  return { path: dest, duration_s: Math.round((out.samples / out.sampleRate) * 10000) / 10000 };
}

async function synthPlain(items, { cacheDir, engine, env = process.env, draftSynth = defaultDraftSynth, onProgress, calibrate = false } = {}) {
  const dir = join(cacheDir, 'synth');
  mkdirSync(dir, { recursive: true });
  const out = new Map();
  const misses = new Map();
  for (const it of items) {
    const key = synthKey(engine, it);
    const path = join(dir, `${key}.wav`);
    const meta = `${path}.json`;
    if (!out.has(key) && existsSync(path) && existsSync(meta)) {
      out.set(key, { key, path, duration_s: JSON.parse(readFileSync(meta, 'utf8')).duration_s, cached: true });
    } else if (!out.has(key)) {
      misses.set(key, it);
    }
  }
  const save = (key, from, duration_s) => {
    const path = join(dir, `${key}.wav`);
    if (from !== path) renameSync(from, path);
    writeFileSync(`${path}.json`, JSON.stringify({ duration_s }) + '\n');
    out.set(key, { key, path, duration_s, cached: false });
  };
  if (misses.size && engine.mode === 'engine') {
    const tmp = join(dir, 'tmp');
    const results = await runWorker({
      mode: 'synth', out_dir: tmp, ...(calibrate ? { calibrate: true } : {}),
      items: [...misses].map(([key, it]) => ({ id: key, text: it.text, voice: it.voice, lang: it.lang ?? 'en', speed: it.speed ?? 1, seed: it.seed ?? 0 })),
    }, workerOpts(engine, env, onProgress));
    for (const r of results) save(r.id, r.path, r.duration_s);
    rmSync(tmp, { recursive: true, force: true });
  } else if (misses.size) {
    let i = 0;
    for (const [key, it] of misses) {
      const r = await draftSynth({ id: key, text: it.text, speed: it.speed ?? 1 }, join(dir, `${key}.wav`));
      save(key, r.path, r.duration_s);
      onProgress?.({ progress: ++i, total: misses.size });
    }
  }
  return items.map((it) => {
    const r = out.get(synthKey(engine, it));
    if (!r) throw new EngineError(`the engine returned no audio for "${it.text}"`);
    return r;
  });
}

// takes: [{key (synth key), path, lang}] → same order: {text, words: [{w, start, end, p}], cached}.
export async function asrBatch(takes, { cacheDir, engine, env = process.env, onProgress } = {}) {
  const dir = join(cacheDir, 'asr');
  mkdirSync(dir, { recursive: true });
  const keyOf = (t) => sha({ v: 1, synth: t.key, lang: t.lang ?? 'en' });
  const out = new Map();
  const misses = new Map();
  for (const t of takes) {
    const key = keyOf(t);
    const file = join(dir, `${key}.json`);
    if (out.has(key) || misses.has(key)) continue;
    if (existsSync(file)) out.set(key, { ...JSON.parse(readFileSync(file, 'utf8')), cached: true });
    else misses.set(key, t);
  }
  if (misses.size) {
    const results = await runWorker({ mode: 'asr', items: [...misses].map(([key, t]) => ({ id: key, path: t.path, lang: t.lang ?? 'en' })) }, workerOpts(engine, env, onProgress));
    for (const r of results) {
      const rec = { text: r.text ?? '', words: r.words ?? [] };
      writeFileSync(join(dir, `${r.id}.json`), JSON.stringify(rec) + '\n');
      out.set(r.id, { ...rec, cached: false });
    }
  }
  return takes.map((t) => out.get(keyOf(t)) ?? { text: '', words: [], cached: false });
}

// Overall RMS of a clip (dB).
export async function rmsDb(path) {
  const { stderr } = await run(['-i', path, '-af', 'astats=metadata=0', '-f', 'null', '-']);
  return parseAstats(stderr).rms;
}

// RMS (dB) of the sounding part of a clip only: stretches more than
// ACTIVE_RANGE_DB under the clip's own peak (the engine's lead-in and tail,
// pauses between sentences) are removed first, so a short line padded with
// silence is not measured as quieter than it sounds. The floor is relative to
// the peak, so the measure does not depend on the clip's level. Falls back to
// the overall RMS when nothing is left.
const ACTIVE_RANGE_DB = 30;
export async function activeRmsDb(path) {
  const { stderr: s0 } = await run(['-i', path, '-af', 'astats=metadata=0', '-f', 'null', '-']);
  const whole = parseAstats(s0);
  if (!Number.isFinite(whole.peak) || whole.peak < -100) return whole.rms;
  const floor = Math.max(-90, whole.peak - ACTIVE_RANGE_DB).toFixed(1);
  const strip = `silenceremove=start_periods=1:start_threshold=${floor}dB:stop_periods=-1:stop_threshold=${floor}dB:stop_duration=0.1`;
  const { stderr } = await run(['-i', path, '-af', `${strip},astats=metadata=0`, '-f', 'null', '-']);
  let active;
  try { active = parseAstats(stderr).rms; } catch { active = NaN; } // everything was under the floor
  return Number.isFinite(active) && active > -120 ? active : whole.rms;
}

// A spliced breath/laugh sits this far under the speech of its line (both
// measured with activeRmsDb), clamped to ±12 dB of correction.
export const NV_HEADROOM_DB = 4.5;
export function nvMatchGain(nvDb, speechDb) {
  if (!Number.isFinite(nvDb) || !Number.isFinite(speechDb)) return 0;
  return Math.round(Math.max(-12, Math.min(12, speechDb - NV_HEADROOM_DB - nvDb)) * 100) / 100;
}

// Decode any clip to 44.1 kHz mono s16 WAV (exact sample counts for the layout).
export async function toWav(src, dest) {
  if (!existsSync(dest)) {
    mkdirSync(join(dest, '..'), { recursive: true });
    await run(['-i', src, '-ac', '1', '-ar', String(SR), '-c:a', 'pcm_s16le', `${dest}.part.wav`]);
    renameSync(`${dest}.part.wav`, dest);
  }
  const info = await readWavInfo(dest);
  return { path: dest, duration_s: info.samples / info.sampleRate };
}

// A nonverbal clip for {tag, voice}: bundled pack first (copied into
// <out>/assets/nonverbal with its license sidecar), then a licensed search.
// Returns {path (wav), duration_s, asset, warning?} or {warning}.
export async function nonverbalClip(item, { outDir, cacheDir, offline, variant = 1, sources, fetchImpl, freesoundToken, projectDir }) {
  const cue = { type: 'nv', tag: item.tag, voice: item.base_voice ?? item.voice, variant };
  const r = await resolveCue(cue, { projectDir, offline, destDir: join(outDir, 'assets'), fetchImpl, freesoundToken, sources });
  if (!r.path) return { warning: `${item.id}: ${r.warning ?? `no <${item.tag}> clip`}` };
  let assetPath = r.path;
  if (r.source === 'bundled') {
    const gender = genderOf(cue);
    assetPath = join(outDir, 'assets', 'nonverbal', `${gender}-${basename(r.path)}`);
    if (!existsSync(assetPath)) {
      mkdirSync(join(outDir, 'assets', 'nonverbal'), { recursive: true });
      copyFileSync(r.path, assetPath);
      writeFileSync(`${assetPath}.license.json`, JSON.stringify(r.sidecar, null, 2) + '\n');
    }
  }
  const wav = await toWav(r.path, join(cacheDir, 'nv', `${sha({ src: r.path }).slice(0, 16)}.wav`));
  return {
    ...wav,
    asset: { type: 'nv', path: assetPath, source: r.source, ...(r.sidecar ?? {}) },
    ...(r.warning ? { warning: `${item.id}: ${r.warning}` } : {}),
  };
}
