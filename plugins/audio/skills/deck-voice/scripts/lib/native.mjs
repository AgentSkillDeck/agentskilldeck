// Native engine tags, per voice. Supertonic performs some nonverbal tags in the
// speaker's own voice when they are stacked (a single tag is effectively
// silent). Measured (owner listening, then the placement test of 2026-10-11:
// 6 tags x 5 positions x 3 spacings on M3 and F4, insertion QA), only the laugh
// is reliable: 28/28 clean in every position and spacing, against hmm 18/28,
// cough 17/28, breath 16/28, groan 6/28, yawn 2/28 (and sigh spoken when
// stacked). So the shipped table allows laugh only; every other tag is a
// sample for every voice. The decision stays a table (assets/native-tags.json:
// calibrate.mjs rows plus owner_overrides, which always win) so a future
// engine can be re-measured without code changes.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseVoice, readCloneVoice } from './voices.mjs';

// Stack sizes: the number of engine tags sent for one written tag. Laughs have
// a size (1 small, 2 normal, 3 big). The one place to retune counts.
export const NATIVE_STACK = { laugh: { 1: 2, 2: 3, 3: 4 }, cough: 3, yawn: 3, hmm: 3, breath: 3, sigh: 3, groan: 3 };
export const stackOf = (tag, level) => { const v = NATIVE_STACK[tag]; return typeof v === 'object' ? v[level] ?? v[2] : v; };
// Tags that may ever reach the engine (when the voice's row allows them).
export const CANDIDATE_TAGS = Object.keys(NATIVE_STACK);

export const NATIVE_TABLE_PATH = fileURLToPath(new URL('../assets/native-tags.json', import.meta.url));

const cache = new Map();
// The table in force: AGENTSKILLDECK_NATIVE_TAGS=<file> overrides the bundled one.
export function loadNativeTable({ env = process.env, path } = {}) {
  const file = path ?? env.AGENTSKILLDECK_NATIVE_TAGS ?? NATIVE_TABLE_PATH;
  if (!cache.has(file)) {
    let table;
    try { table = JSON.parse(readFileSync(file, 'utf8')); } catch { table = {}; }
    cache.set(file, table);
  }
  return cache.get(file);
}

// The synth voice a row belongs to: "M3" → M3; a clone ("clone:me") uses its
// base voice's row, read from ~/.agentskilldeck/voices/me/voice.json
// (AGENTSKILLDECK_VOICES overrides the store), or the explicit "clone:me@F2";
// a recorded voice ("record") and an unknown clone have none (null); no voice
// is the engine default M1.
export function baseVoice(voice, { env = process.env } = {}) {
  const p = parseVoice(voice);
  if (p.kind === 'preset') return p.voice;
  if (p.kind === 'clone') return p.base ?? readCloneVoice(p.name, { env })?.base ?? null;
  if (p.kind === 'record') return null;
  return String(voice).trim().toUpperCase();
}

// {ok, source, pass?, total?}: the owner's override for this voice, then the
// owner's override for every voice ("*"), then the calibration result.
// No row means no native tag: the sample is the safe default.
export function nativeVerdict(voice, tag, table = loadNativeTable(), opts = {}) {
  const v = baseVoice(voice, opts);
  const o = table.owner_overrides ?? {};
  const row = v ? table[v]?.[tag] : undefined;
  const measured = row ? { pass: row.pass, total: row.total } : {};
  if (v && typeof o[v]?.[tag] === 'boolean') return { ok: o[v][tag], source: 'owner', ...measured };
  if (!v) return { ok: false, source: 'none' };
  if (typeof o['*']?.[tag] === 'boolean') return { ok: o['*'][tag], source: 'owner', ...measured };
  if (row) return { ok: row.ok === true, source: 'calibration', ...measured };
  return { ok: false, source: 'none' };
}

export const nativeOk = (voice, tag, table, opts) => CANDIDATE_TAGS.includes(tag) && nativeVerdict(voice, tag, table, opts).ok;
