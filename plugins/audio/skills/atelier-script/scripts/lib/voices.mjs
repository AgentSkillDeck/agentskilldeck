// The user's own voice: cast voice forms, the clone voice store, consent and
// pitch measurement.
//
// Cast voice forms (front matter `voice:`):
//   F1..F5, M1..M5   a Supertonic preset
//   record           the user speaks this character's lines (record.mjs)
//   clone:<name>     Supertonic renders the line with the clone's base voice,
//                    then Chatterbox voice conversion (engine/clone.py) gives it
//                    the timbre of the reference in ~/.agentatelier/voices/<name>/.
//                    clone:<name>@F2 forces the base voice.
// A clone voice is a folder: reference.wav (10-60 s, cleaned), voice.json
// {version, name, base, f0_median_hz, reference, duration_s, source, created}
// and consent.json {kind, statement, speaker?, at}. No consent file, no clone.
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Median pitch of each preset on the same sentence (seed 0, 10 steps): the
// casting guide's measured voice map.
export const VOICE_F0 = { F1: 188, F2: 207, F3: 179, F4: 196, F5: 158, M1: 141, M2: 89, M3: 96, M4: 120, M5: 89 };
export const PRESETS = Object.keys(VOICE_F0);
export const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;
export const DEFAULT_VOICE = 'M1';

// Exit 1: a script/usage problem (unknown clone, no consent).
export class CloneVoiceError extends Error {
  constructor(message) { super(message); this.name = 'CloneVoiceError'; this.exitCode = 1; }
}

export function parseVoice(v) {
  if (v === undefined || v === null || String(v).trim() === '') return { kind: 'preset', voice: DEFAULT_VOICE };
  const s = String(v).trim();
  const up = s.toUpperCase();
  if (PRESETS.includes(up)) return { kind: 'preset', voice: up };
  if (s.toLowerCase() === 'record') return { kind: 'record' };
  const m = /^clone:(.*)$/i.exec(s);
  if (m) {
    const [rawName, rawBase, extra] = m[1].split('@');
    const name = String(rawName ?? '').trim().toLowerCase();
    if (!NAME_RE.test(name) || extra !== undefined) return { kind: 'invalid', reason: `clone voice names are 1-40 letters, digits, - or _ (got "${s}")` };
    if (rawBase === undefined) return { kind: 'clone', name, base: null };
    const base = rawBase.trim().toUpperCase();
    if (!PRESETS.includes(base)) return { kind: 'invalid', reason: `the base voice after @ must be one of ${PRESETS.join(', ')} (got "${s}")` };
    return { kind: 'clone', name, base };
  }
  return { kind: 'invalid', reason: `unknown voice "${s}": use a preset (${PRESETS.join(', ')}), record, or clone:<name>` };
}

export function voicesDir({ env = process.env, home = homedir() } = {}) {
  return env.AGENTATELIER_VOICES || join(home, '.agentatelier', 'voices');
}

// --- consent ------------------------------------------------------------

export const CONSENT_FORMS = ['This is my own voice', "I have the speaker's consent: <name>"];
export const CONSENT_HELP = `Type one of these statements exactly:\n  "${CONSENT_FORMS[0]}"\n  "${CONSENT_FORMS[1]}"\nIt is stored with the recording. Cloning or recording someone without their consent is not allowed.`;

export function parseConsent(text) {
  const statement = String(text ?? '').trim();
  if (/^this is my own voice\.?$/i.test(statement)) return { kind: 'own', statement };
  const m = /^i have the speaker['’]s consent:\s*(.+?)\.?$/i.exec(statement);
  if (m && m[1].trim()) return { kind: 'speaker', speaker: m[1].trim(), statement };
  return null;
}

// Voice recordings and consent are personal data: owner-only directories
// (0700), tightened when they already exist.
export function privateDir(dir) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { chmodSync(dir, 0o700); } catch { /* not ours to change */ }
  return dir;
}

const readJson = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };
function writeJsonAtomic(file, obj) {
  writeFileSync(`${file}.part`, JSON.stringify(obj, null, 2) + '\n');
  renameSync(`${file}.part`, file);
}

// <out>/recordings/consent.json: {version, speakers: {NAME: {kind, statement, speaker?, at}}}
export const projectConsentFile = (out) => join(out, 'recordings', 'consent.json');
export function projectConsent(out, speaker) {
  const c = readJson(projectConsentFile(out));
  const entry = c?.speakers?.[speaker];
  return entry && parseConsent(entry.statement) ? entry : null;
}
export function addProjectConsent(out, speaker, consent, { now = new Date() } = {}) {
  const file = projectConsentFile(out);
  privateDir(join(out, 'recordings'));
  const c = readJson(file) ?? { version: 1, speakers: {} };
  c.speakers = { ...(c.speakers ?? {}), [speaker]: { ...consent, at: now.toISOString() } };
  writeJsonAtomic(file, c);
  return c.speakers[speaker];
}

// --- clone voice store ----------------------------------------------------

export function readCloneVoice(name, opts = {}) {
  const dir = join(voicesDir(opts), name);
  const meta = readJson(join(dir, 'voice.json'));
  return meta ? { ...meta, dir } : null;
}

const fileSha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

// Everything produce needs to convert lines into this voice. Throws CloneVoiceError.
export function loadCloneVoice(name, { base, ...opts } = {}) {
  const hint = `Record a reference first: node scripts/record.mjs --reference --name ${name} (or --from <file>).`;
  if (!NAME_RE.test(String(name))) throw new CloneVoiceError(`bad clone voice name "${name}". ${hint}`);
  const v = readCloneVoice(name, opts);
  if (!v) throw new CloneVoiceError(`no clone voice "${name}" in ${voicesDir(opts)}. ${hint}`);
  const refPath = join(v.dir, v.reference ?? 'reference.wav');
  if (!existsSync(refPath)) throw new CloneVoiceError(`clone voice "${name}" has no reference audio (${refPath}). ${hint}`);
  const consent = readJson(join(v.dir, 'consent.json'));
  if (!consent || !parseConsent(consent.statement)) throw new CloneVoiceError(`clone voice "${name}" has no consent statement (${join(v.dir, 'consent.json')}); re-record the reference with record.mjs --reference --name ${name} to give it.`);
  const b = base ?? v.base;
  if (!PRESETS.includes(b)) throw new CloneVoiceError(`clone voice "${name}" has no valid base voice in voice.json (got ${JSON.stringify(v.base)}).`);
  return { name, dir: v.dir, base: b, f0_median_hz: v.f0_median_hz ?? null, ref_path: refPath, ref_sha: fileSha(refPath), consent };
}

// Stores a cleaned reference (copied) and its metadata. Returns voice.json.
export function writeCloneVoice(name, { reference, f0_median_hz, base, duration_s, source, consent }, opts = {}) {
  if (!NAME_RE.test(String(name))) throw new CloneVoiceError(`bad clone voice name "${name}": use 1-40 lowercase letters, digits, - or _.`);
  if (!consent || !parseConsent(consent.statement)) throw new CloneVoiceError(`a clone voice needs a consent statement. ${CONSENT_HELP}`);
  privateDir(voicesDir(opts));
  const dir = privateDir(join(voicesDir(opts), name));
  copyFileSync(reference, join(dir, 'reference.wav.part'));
  renameSync(join(dir, 'reference.wav.part'), join(dir, 'reference.wav'));
  writeJsonAtomic(join(dir, 'consent.json'), { ...consent, at: new Date().toISOString() });
  const meta = {
    version: 1, name, base: base ?? nearestVoice(f0_median_hz) ?? DEFAULT_VOICE,
    f0_median_hz: Number.isFinite(f0_median_hz) ? Math.round(f0_median_hz * 10) / 10 : null,
    reference: 'reference.wav', duration_s, source, created: new Date().toISOString(),
  };
  writeJsonAtomic(join(dir, 'voice.json'), meta);
  return meta;
}

// --- pitch --------------------------------------------------------------

// The preset nearest in perceived pitch (log distance); ties go to the first.
export function nearestVoice(f0) {
  if (!Number.isFinite(f0) || f0 <= 0) return null;
  let best = null;
  let bestD = Infinity;
  for (const [v, ref] of Object.entries(VOICE_F0)) {
    const d = Math.abs(Math.log(f0 / ref));
    if (d < bestD - 1e-9) { best = v; bestD = d; }
  }
  return best;
}

// Median f0 (Hz) of the voiced frames: YIN on a ~8 kHz box-decimated copy,
// 50 ms frames every 20 ms, 60-400 Hz, frames more than 25 dB under the
// loudest frame skipped. null when fewer than 5 frames are voiced.
export function medianF0(samples, sampleRate, { fmin = 60, fmax = 400, threshold = 0.15 } = {}) {
  const k = Math.max(1, Math.floor(sampleRate / 8000));
  const sr = sampleRate / k;
  const n = Math.floor(samples.length / k);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < k; j++) s += samples[i * k + j];
    x[i] = s / k;
  }
  const W = Math.round(sr * 0.05);
  const hop = Math.round(sr * 0.02);
  const tauMin = Math.max(2, Math.floor(sr / fmax));
  const tauMax = Math.ceil(sr / fmin);
  if (n < W + tauMax) return null;
  const frames = [];
  let loudest = 0;
  for (let start = 0; start + W + tauMax <= n; start += hop) {
    let e = 0;
    for (let i = 0; i < W; i++) e += x[start + i] * x[start + i];
    const rms = Math.sqrt(e / W);
    frames.push({ start, rms });
    if (rms > loudest) loudest = rms;
  }
  if (loudest <= 1e-5) return null;
  const floor = loudest * 10 ** (-25 / 20);
  const d = new Float64Array(tauMax + 1);
  const f0s = [];
  for (const { start, rms } of frames) {
    if (rms < floor) continue;
    for (let tau = 1; tau <= tauMax; tau++) {
      let s = 0;
      for (let i = 0; i < W; i++) { const dd = x[start + i] - x[start + i + tau]; s += dd * dd; }
      d[tau] = s;
    }
    // Cumulative mean normalised difference.
    let run = 0;
    let found = -1;
    const cm = new Float64Array(tauMax + 1);
    cm[0] = 1;
    for (let tau = 1; tau <= tauMax; tau++) {
      run += d[tau];
      cm[tau] = run > 0 ? (d[tau] * tau) / run : 1;
    }
    for (let tau = tauMin; tau <= tauMax; tau++) {
      if (cm[tau] < threshold) {
        while (tau + 1 <= tauMax && cm[tau + 1] < cm[tau]) tau++;
        found = tau;
        break;
      }
    }
    if (found < 0) continue;
    // Parabolic interpolation around the minimum.
    let t = found;
    if (found > 1 && found < tauMax) {
      const a = cm[found - 1], b = cm[found], c = cm[found + 1];
      const den = a - 2 * b + c;
      if (den !== 0) t = found + (a - c) / (2 * den);
    }
    f0s.push(sr / t);
  }
  if (f0s.length < 5) return null;
  f0s.sort((a, b) => a - b);
  const mid = f0s.length >> 1;
  return f0s.length % 2 ? f0s[mid] : (f0s[mid - 1] + f0s[mid]) / 2;
}

// 16-bit PCM WAV → {samples: Float32Array (mono mix), sampleRate}.
export function readPcm16(path) {
  const b = readFileSync(path);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`not a WAV file: ${path}`);
  let pos = 12;
  let fmt = null;
  while (pos + 8 <= b.length) {
    const id = b.toString('ascii', pos, pos + 4);
    const size = b.readUInt32LE(pos + 4);
    if (id === 'fmt ') fmt = { format: b.readUInt16LE(pos + 8), channels: b.readUInt16LE(pos + 10), sampleRate: b.readUInt32LE(pos + 12), bits: b.readUInt16LE(pos + 22) };
    else if (id === 'data') {
      if (!fmt || fmt.format !== 1 || fmt.bits !== 16) throw new Error(`not a 16-bit PCM WAV: ${path}`);
      const end = Math.min(b.length, pos + 8 + size);
      const frames = Math.floor((end - pos - 8) / (2 * fmt.channels));
      const samples = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        let s = 0;
        for (let c = 0; c < fmt.channels; c++) s += b.readInt16LE(pos + 8 + (i * fmt.channels + c) * 2);
        samples[i] = s / fmt.channels / 32768;
      }
      return { samples, sampleRate: fmt.sampleRate };
    }
    pos += 8 + size + (size % 2);
  }
  throw new Error(`WAV without data chunk: ${path}`);
}

export function writePcm16(path, samples, sampleRate) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0, 'ascii'); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii'); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii'); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  writeFileSync(path, buf);
}
