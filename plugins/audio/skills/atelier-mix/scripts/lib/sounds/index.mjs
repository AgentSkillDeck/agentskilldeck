import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile, readFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ServiceError } from '../http.mjs';
import { attribution, isAllowed } from './license.mjs';
import { searchOpenverse } from './openverse.mjs';
import { searchCommons } from './commons.mjs';
import { searchArchive } from './archive.mjs';
import { searchFreesound } from './freesound.mjs';
import { generateBed } from './generate.mjs';
import { baseVoice } from '../native.mjs';

export { isAllowed, attribution } from './license.mjs';
export { generateBed } from './generate.mjs';

export const KINDS = ['sfx', 'music', 'ambience'];
export const NONVERBAL_TAGS = ['laugh', 'breath', 'sigh', 'gasp', 'sob', 'cough', 'scream'];
export const NONVERBAL_DIR = fileURLToPath(new URL('../../assets/nonverbal/', import.meta.url));
const AUDIO_EXT = /\.(wav|mp3|ogg|oga|flac|aiff?|m4a|opus)$/i;
const MUSIC_CONTROLS = new Set(['start', 'stop', 'swell', 'duck', 'out']);

const norm = (s) => String(s ?? '').toLowerCase().replace(AUDIO_EXT, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export const dedupeKey = (s) => `${norm(s.title)}|${norm(s.creator)}`;

function inRange(s, { minDuration, maxDuration }) {
  if (s.duration_s == null) return true; // unknown duration: keep, the mixer trims/loops anyway
  if (minDuration != null && s.duration_s < minDuration) return false;
  if (maxDuration != null && s.duration_s > maxDuration) return false;
  return true;
}

// Provider priority order. Internet Archive is opt-in only: its license metadata is
// unreliable (mirrored catalogue items carry wrong CC tags), so it is never a default.
export const SOURCES = ['openverse', 'commons', 'archive', 'freesound'];

export function defaultSources(freesoundToken) {
  return freesoundToken ? ['openverse', 'commons', 'freesound'] : ['openverse', 'commons'];
}

// "openverse,commons,archive" -> ['openverse', 'commons', 'archive'] (validated, deduped).
export function parseSources(str) {
  const list = [...new Set(String(str ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean))];
  if (!list.length) throw new Error(`--sources needs at least one of ${SOURCES.join(', ')}`);
  for (const s of list) if (!SOURCES.includes(s)) throw new Error(`Unknown sound source "${s}". Use a comma list of ${SOURCES.join(', ')}.`);
  return list;
}

// Search licensed sounds across providers, in priority order, until `limit` unique results are found.
// A failing provider never throws: it adds a warning (and its name to `failed`) and the next one is tried.
// `sources` picks providers (default: defaultSources(freesoundToken)); `sources` in the result lists those tried.
export async function searchSounds(query, { kind = 'sfx', limit = 5, minDuration, maxDuration, fetchImpl, cacheDir, freesoundToken, sources } = {}) {
  if (!KINDS.includes(kind)) throw new Error(`searchSounds: unknown kind "${kind}"`);
  const wanted = new Set(sources ?? defaultSources(freesoundToken));
  const all = {
    openverse: () => searchOpenverse(query, { kind, fetchImpl, cacheDir }),
    commons: () => searchCommons(query, { fetchImpl, cacheDir }),
    archive: () => searchArchive(query, { limit, fetchImpl, cacheDir }),
    freesound: () => searchFreesound(query, { token: freesoundToken, fetchImpl, cacheDir }),
  };
  const pre = [];
  if (wanted.has('freesound') && !freesoundToken) {
    wanted.delete('freesound');
    pre.push('freesound needs FREESOUND_TOKEN (or freesound_token in ~/.agentatelier/config.json); skipped');
  }
  const providers = SOURCES.filter((n) => wanted.has(n)).map((n) => [n, all[n]]);
  const results = [], warnings = [...pre], failed = [], seen = new Set();
  for (const [name, run] of providers) {
    if (results.length >= limit) break;
    let found;
    try { found = await run(); } catch (e) {
      failed.push(name);
      warnings.push(`${name} unavailable (${e instanceof ServiceError ? e.message.replace(`${name}: `, '') : e?.message ?? e}); trying the next source`);
      continue;
    }
    for (const s of found) {
      if (results.length >= limit) break;
      if (!isAllowed(s.license) || !s.download_url || !inRange(s, { minDuration, maxDuration })) continue;
      const k = dedupeKey(s);
      if (seen.has(k)) continue;
      seen.add(k);
      results.push(s);
    }
  }
  return { results, warnings, failed, sources: providers.map(([n]) => n) };
}

const slug = (s) => norm(s).replace(/ /g, '-').slice(0, 40) || 'sound';

function extFor(url, contentType) {
  const fromUrl = extname(new URL(url).pathname).toLowerCase();
  if (AUDIO_EXT.test(fromUrl)) return fromUrl;
  if (/ogg/.test(contentType)) return '.ogg';
  if (/wav/.test(contentType)) return '.wav';
  if (/flac/.test(contentType)) return '.flac';
  return '.mp3';
}

export const sidecarOf = (s) => ({
  title: s.title, creator: s.creator ?? '', license: s.license, license_url: s.license_url ?? '',
  source_url: s.source_url ?? '', attribution: s.attribution ?? attribution(s),
});

// Reads a response body, giving up as soon as it passes maxBytes.
async function readCapped(res, maxBytes, source) {
  if (!res.body?.getReader) {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) throw new ServiceError(source, `download size ${buf.length} bytes is over the ${maxBytes} byte limit`);
    return buf;
  }
  const reader = res.body.getReader();
  const parts = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new ServiceError(source, `download is over the ${maxBytes} byte limit`);
    }
    parts.push(Buffer.from(value));
  }
  return Buffer.concat(parts);
}

// Audio file signatures: MP3 (ID3 or frame sync), Ogg, WAV, FLAC, AIFF, MP4/M4A, WebM.
export function looksLikeAudio(buf) {
  if (!buf || buf.length < 4) return false;
  const a = (o, s) => buf.toString('latin1', o, o + s.length) === s;
  if (a(0, 'ID3') || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return true;
  if (a(0, 'OggS') || a(0, 'fLaC')) return true;
  if (a(0, 'RIFF') && buf.length >= 12 && a(8, 'WAVE')) return true;
  if (a(0, 'FORM') && buf.length >= 12 && (a(8, 'AIFF') || a(8, 'AIFC'))) return true;
  if (buf.length >= 8 && a(4, 'ftyp')) return true;
  return buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
}

// Download a Sound into destDir and write `<file>.license.json`. Reuses an earlier download.
export async function fetchSound(sound, destDir, { fetchImpl = globalThis.fetch, timeoutMs = 30000, maxBytes = 50 * 1024 * 1024 } = {}) {
  if (!isAllowed(sound.license)) throw new ServiceError(sound.source ?? 'sound', `license "${sound.license}" is not allowed`);
  const base = `${slug(sound.title)}-${createHash('sha256').update(`${sound.source}:${sound.id}:${sound.download_url}`).digest('hex').slice(0, 8)}`;
  await mkdir(destDir, { recursive: true });
  for (const ext of ['.mp3', '.ogg', '.wav', '.flac', '.oga', '.m4a', '.opus', '.aif', '.aiff']) {
    const p = join(destDir, base + ext);
    if (existsSync(p) && existsSync(`${p}.license.json`)) return { path: p, sidecar: JSON.parse(await readFile(`${p}.license.json`, 'utf8')) };
  }
  if (!/^https:\/\//i.test(String(sound.download_url ?? ''))) throw new ServiceError(sound.source ?? 'download', `download URL is not https: ${sound.download_url}`);
  let res;
  try {
    res = await fetchImpl(sound.download_url, { signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': 'agentatelier' }, redirect: 'follow' });
  } catch (e) {
    throw new ServiceError(sound.source ?? 'download', e?.name === 'TimeoutError' ? `download timed out after ${timeoutMs} ms` : (e?.message ?? String(e)));
  }
  if (res.url && !/^https:\/\//i.test(res.url)) throw new ServiceError(sound.source ?? 'download', `download redirected off https: ${res.url}`);
  if (!res.ok) throw new ServiceError(sound.source ?? 'download', `download HTTP ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (/text\/html|application\/json/.test(type)) throw new ServiceError(sound.source ?? 'download', `download returned ${type}, not audio`);
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new ServiceError(sound.source ?? 'download', `download size ${declared} bytes is over the ${maxBytes} byte limit`);
  const buf = await readCapped(res, maxBytes, sound.source ?? 'download');
  if (buf.length === 0) throw new ServiceError(sound.source ?? 'download', 'download was empty');
  if (!looksLikeAudio(buf)) throw new ServiceError(sound.source ?? 'download', 'download is not audio (unknown file signature)');
  const path = join(destDir, base + extFor(sound.download_url, type));
  const sidecar = sidecarOf(sound);
  await writeFile(`${path}.part`, buf);
  await rename(`${path}.part`, path);
  await writeFile(`${path}.license.json`, JSON.stringify(sidecar, null, 2) + '\n');
  return { path, sidecar };
}

let creditsCache;
function nonverbalCredits() {
  if (creditsCache === undefined) {
    try { creditsCache = JSON.parse(readFileSync(join(NONVERBAL_DIR, 'CREDITS.json'), 'utf8')); } catch { creditsCache = null; }
  }
  return creditsCache;
}

export function genderOf(cue) {
  if (cue.gender === 'male' || cue.gender === 'female') return cue.gender;
  const raw = String(cue.voice ?? '').trim();
  const v = /^clone:/i.test(raw) ? String(baseVoice(raw) ?? '') : raw.toUpperCase(); // a clone: its base voice
  return v.startsWith('M') ? 'male' : 'female';
}

// Bundled clip for a nonverbal tag: {path, sidecar} or undefined.
export function bundledNonverbal(tag, gender, variant = 1) {
  const credits = nonverbalCredits();
  for (const v of [variant, variant === 1 ? 2 : 1]) {
    const rel = `${gender}/${tag}-${v}.mp3`;
    const path = join(NONVERBAL_DIR, rel);
    if (!existsSync(path)) continue;
    const c = credits?.files?.find((f) => f.file === rel);
    if (!c || !isAllowed(c.license)) continue; // an uncredited clip is never used
    const sidecar = { title: c.title, creator: c.creator ?? '', license: c.license, license_url: c.license_url ?? '', source_url: c.source_url ?? '', attribution: c.attribution ?? attribution(c) };
    return { path, sidecar };
  }
  return undefined;
}

function guessBed(value) {
  const v = String(value ?? '').toLowerCase();
  if (/rain|drizzle|storm|shower/.test(v)) return 'rain';
  if (/wind|breeze|gust|gale/.test(v)) return 'wind';
  if (/room|tone|silence|quiet|air|hum|office/.test(v)) return 'room-tone';
  if (/drone|pad|tone/.test(v)) return 'tone';
  if (/sea|wave|ocean|surf|river|stream|water/.test(v)) return 'pink';
  return 'brown';
}

const looksLikePath = (v) => AUDIO_EXT.test(v) || /^(\.{0,2}\/|~\/|[A-Za-z]:[\\/])/.test(v);

function resolveLocal(value, projectDir) {
  const expanded = value.startsWith('~/') ? join(homedir(), value.slice(2)) : value;
  const path = isAbsolute(expanded) ? expanded : resolve(projectDir ?? process.cwd(), expanded);
  if (!existsSync(path)) return undefined;
  let sidecar = null;
  try { sidecar = JSON.parse(readFileSync(`${path}.license.json`, 'utf8')); } catch { /* user-supplied file: their license */ }
  return { path, sidecar, source: 'local' };
}

// Resolve a cue to a playable file. Order: local file, bundled nonverbal (nv cues), licensed search,
// then the generator (ambience only). Never throws for a missing sound: returns {warning}.
// cue: {type: 'sfx'|'ambience'|'music', value, args?, seconds?} or {type: 'nv', tag, gender?|voice?, variant?}
export async function resolveCue(cue, { projectDir, offline = false, destDir, fetchImpl, cacheDir, freesoundToken, seconds, sources } = {}) {
  const out = destDir ?? join(projectDir ?? process.cwd(), 'assets');
  const notes = [];
  const withNotes = (r) => (notes.length ? { ...r, warning: notes.join('; ') } : r);
  try {
    if (cue.type === 'nv') {
      const tag = String(cue.tag ?? cue.value ?? '').toLowerCase();
      const gender = genderOf(cue);
      const hit = bundledNonverbal(tag, gender, Number(cue.variant) === 2 ? 2 : 1);
      if (hit) return { ...hit, source: 'bundled' };
      if (offline) return { warning: `no bundled <${tag}> clip for ${gender} voices and offline; the nonverbal becomes a pause` };
      const q = `${gender} ${tag}`;
      const { results, warnings } = await searchSounds(q, { kind: 'sfx', limit: 3, maxDuration: 4, fetchImpl, cacheDir, freesoundToken, sources });
      notes.push(...warnings);
      for (const s of results) {
        try { return withNotes({ ...(await fetchSound(s, out, { fetchImpl })), source: s.source }); } catch (e) { notes.push(`download failed for "${s.title}" (${e.message})`); }
      }
      return { warning: [...notes, `no licensed <${tag}> clip found; the nonverbal becomes a pause`].join('; ') };
    }

    const value = String(cue.value ?? '').trim();
    if (!value) return { warning: `${cue.type} cue has no value` };
    if (cue.type === 'ambience' && /^room[ -]?tone$/i.test(value)) {
      // Room tone is never searched: a recording of someone else's room is not a
      // clean floor. The generator makes it at the requested length.
      const want = [cue.seconds, seconds, cue.args?.[1]].map(Number).find((x) => x > 0) ?? 60;
      const secs = Math.ceil(want * 10) / 10;
      const file = join(out, `generated-room-tone-${secs}s.wav`);
      const gen = existsSync(file) && existsSync(`${file}.license.json`)
        ? { path: file, sidecar: JSON.parse(await readFile(`${file}.license.json`, 'utf8')) }
        : await generateBed('room-tone', secs, file);
      return { ...gen, source: 'generated' };
    }
    if (cue.type === 'music' && MUSIC_CONTROLS.has(value.toLowerCase())) return { warning: `music "${value}" is a control cue, not a sound to resolve` };
    const generatedAmbience = async (what) => {
      const bed = guessBed(what);
      const secs = Number(cue.seconds ?? seconds) > 0 ? Number(cue.seconds ?? seconds) : 60;
      const file = join(out, `generated-${bed}-${secs}s.wav`);
      const gen = existsSync(file) && existsSync(`${file}.license.json`)
        ? { path: file, sidecar: JSON.parse(await readFile(`${file}.license.json`, 'utf8')) }
        : await generateBed(bed, secs, file);
      notes.push(`used a generated ${bed} bed instead`);
      return withNotes({ ...gen, source: 'generated' });
    };
    if (looksLikePath(value)) {
      const local = resolveLocal(value, projectDir);
      if (local) return local;
      notes.push(`${cue.type} file not found: ${value}`);
      // A missing ambience file (e.g. a project's local sounds that were not
      // shipped) still gets a bed, guessed from the file name; sfx and music stay missing.
      if (cue.type === 'ambience') return generatedAmbience(value.split(/[\\/]/).pop().replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' '));
      return { warning: notes.join('; ') };
    }
    const kind = KINDS.includes(cue.type) ? cue.type : 'sfx';
    if (!offline) {
      const range = kind === 'sfx' ? { maxDuration: 30 } : kind === 'ambience' ? { minDuration: 8 } : { minDuration: 20 };
      const { results, warnings } = await searchSounds(value, { kind, limit: 3, ...range, fetchImpl, cacheDir, freesoundToken, sources });
      notes.push(...warnings);
      for (const s of results) {
        try { return withNotes({ ...(await fetchSound(s, out, { fetchImpl })), source: s.source }); } catch (e) { notes.push(`download failed for "${s.title}" (${e.message})`); }
      }
      if (!results.length) notes.push(`no licensed ${kind} found for "${value}"`);
    } else {
      notes.push(`offline: skipped the sound search for "${value}"`);
    }
    if (kind === 'ambience') return generatedAmbience(value);
    return { warning: notes.join('; ') || `no sound for ${kind} "${value}"` };
  } catch (e) {
    return { warning: [...notes, `${cue.type} cue could not be resolved (${e?.message ?? e})`].join('; ') };
  }
}

// Freesound token: explicit option, then FREESOUND_TOKEN, then ~/.agentatelier/config.json {freesound_token}.
export function freesoundTokenFromEnv(env = process.env) {
  if (env.FREESOUND_TOKEN) return env.FREESOUND_TOKEN;
  try {
    const cfg = JSON.parse(readFileSync(join(homedir(), '.agentatelier', 'config.json'), 'utf8'));
    return cfg.freesound_token || cfg.freesoundToken || undefined;
  } catch { return undefined; }
}

