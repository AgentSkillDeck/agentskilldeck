import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { searchSounds, fetchSound, resolveCue, dedupeKey, bundledNonverbal } from '../lib/sounds/index.mjs';
import { parseOpenverse, openverseUrl } from '../lib/sounds/openverse.mjs';
import { parseCommons } from '../lib/sounds/commons.mjs';
import { allowedDocs, pickFile, parseLength } from '../lib/sounds/archive.mjs';
import { parseFreesound } from '../lib/sounds/freesound.mjs';
import { generateBed, generateBreath } from '../lib/sounds/generate.mjs';

const fx = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const OV = fx('openverse-rain.json');
const COMMONS = fx('commons-rain.json');
const ARCHIVE = fx('archive-rain.json');
const ARCHIVE_META = fx('archive-meta-MountainAfterTheRainGorgesDuVerdon.json');
const FREESOUND = fx('freesound-rain.json');

const work = mkdtempSync(join(tmpdir(), 'aa sounds '));
after(() => rmSync(work, { recursive: true, force: true }));
let n = 0;
const freshCache = () => join(work, `cache-${n++}`);

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const audio = () => new Response(Buffer.from('ID3fake-mp3-bytes'), { status: 200, headers: { 'content-type': 'audio/mpeg' } });

// Route requests by host; records every URL so tests can assert what was (not) called.
function fakeFetch({ openverse = () => json(OV), commons = () => json(COMMONS), archive = () => json(ARCHIVE), meta = () => json(ARCHIVE_META), freesound = () => json(FREESOUND), download = audio } = {}) {
  const calls = [];
  const f = async (url) => {
    const u = String(url);
    calls.push(u);
    if (u.startsWith('https://api.openverse.org/')) return openverse(u);
    if (u.startsWith('https://commons.wikimedia.org/')) return commons(u);
    if (u.startsWith('https://archive.org/advancedsearch')) return archive(u);
    if (u.startsWith('https://archive.org/metadata/')) return meta(u);
    if (u.startsWith('https://freesound.org/apiv2/')) return freesound(u);
    return download(u);
  };
  f.calls = calls;
  return f;
}
const offlineFetch = () => { const f = async () => { throw new TypeError('fetch failed'); }; f.calls = []; return f; };
const hasFfmpeg = spawnSync(process.env.AGENTATELIER_FFMPEG || 'ffmpeg', ['-version']).status === 0;
const probe = (p) => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], { encoding: 'utf8' }).stdout.trim());

test('openverse results map to Sound with seconds, canonical license and TASL attribution', () => {
  const [s] = parseOpenverse(OV);
  assert.deepEqual(Object.keys(s).sort(), ['attribution', 'creator', 'download_url', 'duration_s', 'id', 'license', 'license_url', 'source', 'source_url', 'title'].sort());
  assert.equal(s.source, 'openverse');
  assert.equal(s.title, 'Rain, Moderate, C');
  assert.equal(s.duration_s, 60.116);
  assert.equal(s.license, 'CC BY 4.0');
  assert.equal(s.download_url, 'https://cdn.freesound.org/previews/401/401275_5121236-hq.mp3');
  assert.equal(s.attribution, '"Rain, Moderate, C" by InspectorJ (https://freesound.org/people/InspectorJ/sounds/401275), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)');
  const cc0 = parseOpenverse(OV).find((x) => x.license === 'CC0 1.0');
  assert.match(cc0.attribution, /CC0 1\.0 \(public domain dedication, no attribution required\)$/);
});

test('openverse URL filters to cc0,by and sets category only for music', () => {
  const sfx = new URL(openverseUrl('door creak', { kind: 'sfx' }));
  assert.equal(sfx.searchParams.get('license'), 'cc0,by');
  assert.equal(sfx.searchParams.get('category'), null);
  assert.equal(new URL(openverseUrl('piano', { kind: 'music' })).searchParams.get('category'), 'music');
});

test('NC and SA items are filtered out (Commons BY-SA, Archive NC/ND/SA/BY-2.5, Freesound BY-NC)', () => {
  const commons = parseCommons(COMMONS);
  // Generic Commons "Public domain" (no PDM/CC0 mark) is rejected; see the next test.
  assert.deepEqual(commons.map((s) => s.license).sort(), ['CC0 1.0']);
  assert.ok(commons.every((s) => !/SA/.test(s.license)));
  assert.ok(!commons[0].download_url.includes('?'));

  const docs = allowedDocs(ARCHIVE);
  assert.ok(docs.length > 0);
  for (const d of docs) assert.match(d.licenseurl, /publicdomain|licenses\/by\/[34]\.0/);
  assert.ok(!docs.some((d) => d.identifier.startsWith('tidal-')), 'mirrored commercial catalogue is never trusted');
  assert.ok(ARCHIVE.response.docs.some((d) => /by-nc|by-sa|by-nd/.test(d.licenseurl)), 'fixture really contains restricted items');

  const fs = parseFreesound(FREESOUND);
  assert.deepEqual(fs.map((s) => s.license), ['CC0 1.0', 'CC BY 4.0']);
});

test('archive helpers pick an mp3 file and parse lengths', () => {
  assert.equal(pickFile(ARCHIVE_META).name, 'FRANCE_0046.mp3');
  assert.equal(parseLength('00:32'), 32);
  assert.equal(parseLength('1:02:03'), 3723);
  assert.equal(parseLength('32.05'), 32.05);
});

test('de-duplication by title and creator keeps the first (higher-priority) copy', async () => {
  const dupes = parseOpenverse(OV).filter((s) => s.title === 'Heavy Rain');
  assert.equal(dupes.length, 2, 'fixture has the same title+creator twice');
  assert.equal(dedupeKey({ title: 'Rain, Moderate.wav', creator: 'InspectorJ' }), dedupeKey({ title: 'rain moderate', creator: 'inspectorj' }));
  const f = fakeFetch();
  const { results, warnings } = await searchSounds('rain', { kind: 'ambience', limit: 10, fetchImpl: f, cacheDir: freshCache() });
  assert.deepEqual(warnings, []);
  assert.equal(results.filter((s) => s.title === 'Heavy Rain' && s.creator === 'lebaston100').length, 1);
  const keys = results.map(dedupeKey);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(results[0].source, 'openverse');
  assert.ok(results.some((s) => s.source === 'commons'), 'falls through to Commons to fill the limit');
});

test('providers are tried in order and later ones are skipped once the limit is met', async () => {
  const f = fakeFetch();
  const { results } = await searchSounds('rain', { kind: 'sfx', limit: 3, fetchImpl: f, cacheDir: freshCache() });
  assert.equal(results.length, 3);
  assert.ok(f.calls.every((u) => u.startsWith('https://api.openverse.org/')));
});

test('duration filters apply', async () => {
  const { results } = await searchSounds('rain', { kind: 'sfx', limit: 5, maxDuration: 50, fetchImpl: fakeFetch(), cacheDir: freshCache() });
  assert.ok(results.length > 0);
  assert.ok(results.every((s) => s.duration_s == null || s.duration_s <= 50));
});

test('freesound is used only when a token is set, and only cc0/by', async () => {
  const noTok = fakeFetch({ openverse: () => json({ results: [] }), commons: () => json({}), archive: () => json({ response: { docs: [] } }) });
  await searchSounds('rain', { limit: 5, fetchImpl: noTok, cacheDir: freshCache() });
  assert.ok(!noTok.calls.some((u) => u.includes('freesound.org')));
  const tok = fakeFetch({ openverse: () => json({ results: [] }), commons: () => json({}), archive: () => json({ response: { docs: [] } }) });
  const { results } = await searchSounds('rain', { limit: 5, fetchImpl: tok, cacheDir: freshCache(), freesoundToken: 'T0K' });
  const call = tok.calls.find((u) => u.includes('freesound.org'));
  assert.ok(call);
  assert.equal(new URL(call).searchParams.get('filter'), 'license:("Creative Commons 0" OR "Attribution")');
  assert.deepEqual(results.map((s) => s.source), ['freesound', 'freesound']);
});

test('a 429 from Openverse falls back to the next source with a warning, then skips Openverse', async () => {
  const f = fakeFetch({ openverse: () => json({ detail: 'Request was throttled.' }, 429) });
  const cacheDir = freshCache();
  const { results, warnings, failed } = await searchSounds('rain', { kind: 'sfx', limit: 3, fetchImpl: f, cacheDir });
  assert.ok(results.length > 0);
  assert.ok(results.every((s) => s.source !== 'openverse'));
  assert.deepEqual(failed, ['openverse']);
  assert.match(warnings[0], /openverse unavailable \(HTTP 429\)/);
  assert.equal(f.calls.filter((u) => u.includes('openverse')).length, 1, 'no retry burns more of the anonymous quota');
  await searchSounds('thunder', { kind: 'sfx', limit: 3, fetchImpl: f, cacheDir });
  assert.equal(f.calls.filter((u) => u.includes('openverse')).length, 1, 'backoff: Openverse skipped after a 429');
});

test('fetchSound downloads and writes the license sidecar; a second call reuses it', async () => {
  const [s] = parseOpenverse(OV);
  const dest = join(work, 'assets dir');
  const f = fakeFetch();
  const r = await fetchSound(s, dest, { fetchImpl: f });
  assert.ok(r.path.endsWith('.mp3'));
  assert.ok(existsSync(r.path));
  const side = JSON.parse(await readFile(`${r.path}.license.json`, 'utf8'));
  assert.deepEqual(Object.keys(side).sort(), ['attribution', 'creator', 'license', 'license_url', 'source_url', 'title']);
  assert.equal(side.license, 'CC BY 4.0');
  assert.deepEqual(r.sidecar, side);
  const again = await fetchSound(s, dest, { fetchImpl: f });
  assert.equal(again.path, r.path);
  assert.equal(f.calls.length, 1);
  await assert.rejects(fetchSound({ ...s, id: 'x', license: 'CC BY-NC 4.0' }, dest, { fetchImpl: f }), /not allowed/);
  await assert.rejects(fetchSound({ ...s, id: 'y' }, dest, { fetchImpl: async () => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }) }), /not audio/);
});

test('resolveCue: a local file path wins and a missing one warns without throwing', async () => {
  const proj = join(work, 'my project');
  const f = fakeFetch();
  const local = join(proj, 'door.wav');
  (await import('node:fs')).mkdirSync(proj, { recursive: true });
  writeFileSync(local, 'RIFF');
  const r = await resolveCue({ type: 'sfx', value: './door.wav' }, { projectDir: proj, fetchImpl: f });
  assert.equal(r.source, 'local');
  assert.equal(r.path, local);
  assert.equal(f.calls.length, 0);
  const miss = await resolveCue({ type: 'sfx', value: 'sounds/none.mp3' }, { projectDir: proj, fetchImpl: f });
  assert.match(miss.warning, /not found/);
  assert.equal(miss.path, undefined);
});

test('resolveCue: a missing local ambience file becomes a generated bed (guessed from its name) with a warning; sfx/music stay missing', { skip: !hasFfmpeg && 'ffmpeg not installed' }, async () => {
  const proj = join(work, 'missing local');
  const amb = await resolveCue({ type: 'ambience', value: './sounds/heavy-rain-loop.mp3' }, { projectDir: proj, offline: true, seconds: 5 });
  assert.equal(amb.source, 'generated');
  assert.match(amb.path, /generated-rain-5s\.wav$/);
  assert.match(amb.warning, /ambience file not found: \.\/sounds\/heavy-rain-loop\.mp3.*generated rain bed/);
  const music = await resolveCue({ type: 'music', value: './sounds/theme.mp3' }, { projectDir: proj, offline: true });
  assert.equal(music.path, undefined);
  assert.match(music.warning, /music file not found/);
});

test('fetchSound rejects a download that redirected off https', async () => {
  const s = { source: 'openverse', id: 'r1', title: 'Redirected', creator: 'A', license: 'CC0 1.0', download_url: 'https://cdn.example.org/r1.mp3' };
  const redirected = async () => { const r = audio(); Object.defineProperty(r, 'url', { value: 'http://evil.example.org/r1.mp3' }); return r; };
  await assert.rejects(fetchSound(s, join(work, 'dl-redirect'), { fetchImpl: redirected }), /redirected off https/);
  const fine = async () => { const r = audio(); Object.defineProperty(r, 'url', { value: 'https://cdn2.example.org/r1.mp3' }); return r; };
  assert.ok((await fetchSound({ ...s, id: 'r2' }, join(work, 'dl-redirect'), { fetchImpl: fine })).path);
});

test('resolveCue: search result is downloaded into <project>/assets with a sidecar', async () => {
  const proj = join(work, 'proj search');
  const r = await resolveCue({ type: 'ambience', value: 'rain' }, { projectDir: proj, fetchImpl: fakeFetch(), cacheDir: freshCache() });
  assert.equal(r.source, 'openverse');
  assert.ok(r.path.startsWith(join(proj, 'assets')));
  assert.ok(existsSync(`${r.path}.license.json`));
  assert.equal(r.warning, undefined);
});

test('resolveCue: sfx with every source down returns {warning} and never throws', async () => {
  const r = await resolveCue({ type: 'sfx', value: 'door creak' }, { projectDir: work, fetchImpl: offlineFetch(), cacheDir: freshCache() });
  assert.equal(r.path, undefined);
  assert.match(r.warning, /openverse unavailable/);
  assert.match(r.warning, /no licensed sfx/);
  const off = await resolveCue({ type: 'music', value: 'slow piano' }, { projectDir: work, offline: true });
  assert.match(off.warning, /offline/);
  const ctl = await resolveCue({ type: 'music', value: 'swell' }, { projectDir: work });
  assert.match(ctl.warning, /control cue/);
});

test('resolveCue: offline ambience → generator', { skip: !hasFfmpeg && 'ffmpeg not installed' }, async () => {
  const proj = join(work, 'offline proj');
  const f = offlineFetch();
  const r = await resolveCue({ type: 'ambience', value: 'sea waves, wind', args: ['low'] }, { projectDir: proj, offline: true, fetchImpl: f, seconds: 3 });
  assert.equal(r.source, 'generated');
  assert.equal(f.calls.length, 0);
  assert.match(r.warning, /offline/);
  assert.equal(r.sidecar.license, 'generated');
  assert.ok(Math.abs(probe(r.path) - 3) < 0.05);
});

test('resolveCue: Openverse 429 + other sources empty → ambience generator with a warning', { skip: !hasFfmpeg && 'ffmpeg not installed' }, async () => {
  const f = fakeFetch({ openverse: () => json({ detail: 'throttled' }, 429), commons: () => json({}), archive: () => json({ response: { docs: [] } }) });
  const r = await resolveCue({ type: 'ambience', value: 'rain on a tin roof', seconds: 2 }, { projectDir: join(work, 'p429'), fetchImpl: f, cacheDir: freshCache() });
  assert.equal(r.source, 'generated');
  assert.match(r.path, /generated-rain-2s\.wav$/);
  assert.match(r.warning, /openverse unavailable \(HTTP 429\)/);
});

test('generateBed writes every kind at the requested length with a "generated" sidecar', { skip: !hasFfmpeg && 'ffmpeg not installed' }, async () => {
  for (const kind of ['room-tone', 'rain', 'wind', 'brown', 'pink', 'tone']) {
    const out = join(work, 'beds', `${kind}.wav`);
    const r = await generateBed(kind, 1.5, out);
    assert.ok(Math.abs(probe(out) - 1.5) < 0.05, kind);
    assert.equal(r.sidecar.license, 'generated');
    assert.match(r.sidecar.attribution, /no attribution required/);
    assert.ok(existsSync(`${out}.license.json`));
  }
  await assert.rejects(generateBed('thunder', 1, join(work, 'x.wav')), /unknown kind/);
});

test('resolveCue: nv cues use the bundled pack by voice gender', async () => {
  const f = fakeFetch();
  for (const [cue, gender] of [[{ type: 'nv', tag: 'laugh', voice: 'M3' }, 'male'], [{ type: 'nv', tag: 'breath', voice: 'F2' }, 'female'], [{ type: 'nv', tag: 'sigh', gender: 'male', variant: 2 }, 'male']]) {
    const r = await resolveCue(cue, { projectDir: work, fetchImpl: f, offline: true });
    assert.equal(r.source, 'bundled', JSON.stringify(cue));
    assert.ok(r.path.includes(`/nonverbal/${gender}/${cue.tag}-`));
    assert.ok(r.sidecar.license && r.sidecar.title);
  }
  assert.equal(f.calls.length, 0);
  const unknown = await resolveCue({ type: 'nv', tag: 'yodel', voice: 'F1' }, { projectDir: work, offline: true });
  assert.match(unknown.warning, /pause/);
});

test('bundled nonverbal pack: 2 clips per tag per gender, credited, CC0/PDM or generated, small mono mp3', () => {
  const credits = fx('../../assets/nonverbal/CREDITS.json');
  for (const gender of ['female', 'male']) for (const tag of ['laugh', 'breath', 'sigh', 'gasp', 'sob', 'cough', 'scream']) for (const v of [1, 2]) {
    const rel = `${gender}/${tag}-${v}.mp3`;
    const c = credits.files.find((x) => x.file === rel);
    const hit = bundledNonverbal(tag, gender, v);
    if (!c) { assert.ok(credits.gaps.some((g) => g.file === rel), `${rel} missing and not recorded as a gap`); continue; }
    assert.ok(hit, rel);
    assert.match(c.license, /^(CC0 1\.0|Public Domain Mark 1\.0|generated)$/, rel);
    if (c.license === 'generated') assert.ok(['breath', 'sigh'].includes(tag), `${rel}: only breath/sigh may be generated`);
    else assert.ok(c.source_url && c.creator !== undefined && c.title, rel);
    const size = readFileSync(hit.path).length;
    assert.ok(size <= 40 * 1024, `${rel} is ${size} bytes`);
    if (hasFfmpeg) {
      const p = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=channels,codec_name,bit_rate:format=duration', '-of', 'json', hit.path], { encoding: 'utf8' });
      const j = JSON.parse(p.stdout);
      assert.equal(j.streams[0].codec_name, 'mp3', rel);
      assert.equal(j.streams[0].channels, 1, `${rel} is mono`);
      assert.ok(Number(j.format.duration) <= 1.55, `${rel} is ${j.format.duration} s`);
    }
  }
});

test('generateBreath (pack fallback for breath/sigh) is short and not silent', { skip: !hasFfmpeg && 'ffmpeg not installed' }, async () => {
  for (const tag of ['breath', 'sigh']) {
    const out = join(work, 'gen-nv', `${tag}.mp3`);
    await generateBreath(tag, out, { gender: 'male' });
    const d = probe(out);
    assert.ok(d > 0.5 && d <= 1.5, `${tag} ${d}`);
    const st = spawnSync(process.env.AGENTATELIER_FFMPEG || 'ffmpeg', ['-hide_banner', '-i', out, '-af', 'astats=measure_perchannel=none:measure_overall=RMS_level', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
    assert.ok(Number(st.match(/RMS level dB: (-?[\d.]+)/)[1]) > -40, tag);
  }
});

// Ruling (T6 review): Internet Archive license metadata is unreliable, so it is
// opt-in only. Default sources: openverse, commons (+ freesound with a token).
test('sources: archive is off by default and used only when listed', async () => {
  const empty = { openverse: () => json({ results: [] }), commons: () => json({}) };
  const def = fakeFetch(empty);
  const r = await searchSounds('rain', { limit: 5, fetchImpl: def, cacheDir: freshCache() });
  assert.ok(!def.calls.some((u) => u.includes('archive.org')), 'archive not called by default');
  assert.deepEqual(r.sources, ['openverse', 'commons']);
  const opt = fakeFetch(empty);
  const r2 = await searchSounds('rain', { limit: 5, sources: ['openverse', 'commons', 'archive'], fetchImpl: opt, cacheDir: freshCache() });
  assert.ok(opt.calls.some((u) => u.includes('archive.org/advancedsearch')));
  assert.ok(r2.results.some((s) => s.source === 'archive'));
  const only = fakeFetch();
  const r3 = await searchSounds('rain', { limit: 2, sources: ['commons'], fetchImpl: only, cacheDir: freshCache() });
  assert.ok(only.calls.every((u) => u.startsWith('https://commons.wikimedia.org/')));
  assert.ok(r3.results.every((s) => s.source === 'commons'));
});

test('sources: freesound is in the defaults with a token, and skipped with a warning when listed without one', async () => {
  const { defaultSources, parseSources } = await import('../lib/sounds/index.mjs');
  assert.deepEqual(defaultSources(), ['openverse', 'commons']);
  assert.deepEqual(defaultSources('T0K'), ['openverse', 'commons', 'freesound']);
  assert.deepEqual(parseSources('openverse, Archive'), ['openverse', 'archive']);
  assert.throws(() => parseSources('openverse,spotify'), /Unknown sound source "spotify"/);
  assert.throws(() => parseSources(' , '), /at least one/);
  const f = fakeFetch({ openverse: () => json({ results: [] }), commons: () => json({}) });
  const r = await searchSounds('rain', { limit: 5, sources: ['commons', 'freesound'], fetchImpl: f, cacheDir: freshCache() });
  assert.ok(!f.calls.some((u) => u.includes('freesound.org')));
  assert.ok(r.warnings.some((w) => /freesound needs FREESOUND_TOKEN/.test(w)));
  assert.deepEqual(r.sources, ['commons']);
});

test('resolveCue passes sources through to the search', { skip: !hasFfmpeg && 'ffmpeg not installed' }, async () => {
  const f = fakeFetch({ openverse: () => json({ results: [] }), commons: () => json({}), archive: () => json({ response: { docs: [] } }) });
  await resolveCue({ type: 'sfx', value: 'door creak' }, { projectDir: join(work, 'psrc'), sources: ['openverse'], fetchImpl: f, cacheDir: freshCache() });
  assert.ok(f.calls.length > 0 && f.calls.every((u) => u.startsWith('https://api.openverse.org/')));
});

test('Commons: generic "Public domain" is rejected unless PDM- or CC0-marked; HTML is stripped from Artist', () => {
  const page = (license, url) => ({ query: { pages: { 1: { pageid: 1, index: 1, title: 'File:Rain and thunder.ogg', videoinfo: [{ url: 'https://upload.wikimedia.org/x/Rain.ogg?utm=1', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Rain.ogg', duration: 19, extmetadata: { ObjectName: { value: 'Rain and thunder' }, Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:Caesar">User:Caesar</a>' }, LicenseShortName: { value: license }, ...(url ? { LicenseUrl: { value: url } } : {}) } }] } } } });
  assert.deepEqual(parseCommons(page('Public domain')), []);
  const pdm = parseCommons(page('Public domain', 'https://creativecommons.org/publicdomain/mark/1.0/'));
  assert.equal(pdm[0].license, 'Public Domain Mark 1.0');
  assert.equal(pdm[0].creator, 'User:Caesar');
  assert.equal(pdm[0].download_url, 'https://upload.wikimedia.org/x/Rain.ogg');
  assert.equal(parseCommons(page('Public domain', 'https://creativecommons.org/publicdomain/zero/1.0/'))[0].license, 'CC0 1.0');
});

test('fetchSound rejects non-https URLs, oversized Content-Length and non-audio bytes', async () => {
  const { looksLikeAudio } = await import('../lib/sounds/index.mjs');
  const dest = join(work, 'dl-guard');
  const s = { source: 'openverse', id: 'g1', title: 'Guard', creator: 'A', license: 'CC0 1.0', download_url: 'https://cdn.example.org/g1.mp3' };
  await assert.rejects(fetchSound({ ...s, download_url: 'http://cdn.example.org/g1.mp3' }, dest, { fetchImpl: async () => audio() }), /not https/);
  let bodyRead = false;
  const big = async () => new Response(new ReadableStream({ pull(c) { bodyRead = true; c.enqueue(new Uint8Array(10)); c.close(); } }, { highWaterMark: 0 }), { status: 200, headers: { 'content-type': 'audio/mpeg', 'content-length': String(500 * 1024 * 1024) } });
  await assert.rejects(fetchSound({ ...s, id: 'g2' }, dest, { fetchImpl: big }), /over the .* byte limit/);
  assert.equal(bodyRead, false, 'rejected from the header, before buffering');
  const lying = async () => new Response(Buffer.alloc(4096, 0x49), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
  await assert.rejects(fetchSound({ ...s, id: 'g3' }, dest, { fetchImpl: lying, maxBytes: 1024 }), /byte limit/);
  const notAudio = async () => new Response('this is a text file pretending', { status: 200, headers: { 'content-type': 'audio/mpeg' } });
  await assert.rejects(fetchSound({ ...s, id: 'g4' }, dest, { fetchImpl: notAudio }), /not audio/);
  for (const sig of ['ID3\x03\0', 'OggS', 'fLaC', 'RIFF\0\0\0\0WAVE', 'FORM\0\0\0\0AIFF', '\0\0\0\x20ftypM4A ']) assert.ok(looksLikeAudio(Buffer.from(sig, 'latin1')), sig);
  assert.ok(looksLikeAudio(Buffer.from([0xff, 0xfb, 0x90, 0x00])), 'mp3 frame sync');
  assert.ok(!looksLikeAudio(Buffer.from('<!DOCTYPE html>')));
});

test('resolveCue: room tone goes straight to the generator at the requested length (no search)', { skip: !hasFfmpeg && 'ffmpeg not installed' }, async () => {
  const f = fakeFetch();
  const r = await resolveCue({ type: 'ambience', value: 'room tone', args: ['head', '0.75'] }, { projectDir: join(work, 'prt'), seconds: 2.5, fetchImpl: f, cacheDir: freshCache() });
  assert.equal(f.calls.length, 0);
  assert.equal(r.source, 'generated');
  assert.equal(r.warning, undefined);
  assert.ok(Math.abs(probe(r.path) - 2.5) < 0.05);
  const fromArg = await resolveCue({ type: 'ambience', value: 'Room tone', args: ['tail', '2'] }, { projectDir: join(work, 'prt'), fetchImpl: f });
  assert.ok(Math.abs(probe(fromArg.path) - 2) < 0.05);
});

test('generator finds ffmpeg through lib/ffmpeg.mjs discovery and reports a missing binary as a ServiceError', async () => {
  const gen = await import('../lib/sounds/generate.mjs');
  const ff = await import('../lib/ffmpeg.mjs');
  assert.equal(gen.ffmpegPath(), ff.ffmpegPath());
  const prev = process.env.AGENTATELIER_FFMPEG;
  process.env.AGENTATELIER_FFMPEG = join(work, 'no such ffmpeg');
  try {
    await assert.rejects(generateBed('rain', 1, join(work, 'nogen', 'x.wav')), (e) => e.name === 'ServiceError');
  } finally {
    if (prev === undefined) delete process.env.AGENTATELIER_FFMPEG; else process.env.AGENTATELIER_FFMPEG = prev;
  }
});

test('http cache: the dir is made 0700, and a dir owned by someone else is never used', async () => {
  const { cacheDirUsable } = await import('../lib/http.mjs');
  const { statSync, mkdirSync, chmodSync } = await import('node:fs');
  const dir = join(work, 'cache-perm');
  mkdirSync(dir, { mode: 0o755 });
  chmodSync(dir, 0o755);
  assert.equal(await cacheDirUsable(dir), true);
  assert.equal(statSync(dir).mode & 0o777, 0o700);
  if (process.getuid?.() !== 0) {
    // /var/root (macOS) or / is owned by root, never by the test user.
    assert.equal(await cacheDirUsable('/'), false);
  }
});
