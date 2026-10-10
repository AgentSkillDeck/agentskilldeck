// Live engine tests: real Supertonic + faster-whisper through the venv.
// Run with: LIVE_AUDIO=1 node --test plugins/audio/tools/test/engine-live.test.mjs
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runWorker, findPython, draftSynth, which } from '../lib/engine.mjs';

const LIVE = process.env.LIVE_AUDIO === '1';
const skip = LIVE ? false : 'set LIVE_AUDIO=1 to run the live engine tests';
const out = mkdtempSync(join(tmpdir(), 'aa live engine '));
after(() => rmSync(out, { recursive: true, force: true }));

const TAG_WORDS = /\b(laugh\w*|breath\w*|rest|sigh\w*)\b/i;

function ffprobeDuration(path) {
  return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], { encoding: 'utf8' }).trim());
}

function ffprobeStream(path) {
  return JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate,channels,codec_name', '-of', 'json', path], { encoding: 'utf8' })).streams[0];
}

let synthResults;
const items = [
  { id: 'plain', text: 'The door opened slowly.', voice: 'M1', lang: 'en', speed: 1, seed: 0 },
  { id: 'laugh-model', text: 'Oh, that is funny. <laugh> I did not expect it.', voice: 'F2', lang: 'en', speed: 1, seed: 1 },
  // T2/T3 split "<breath> Did you hear that?" at the tag and synthesise only the
  // text segment; the breath is spliced in from a sample. Simulated here because
  // T2/T3 land in a parallel lane; the full path is checked live in T8.
  { id: 'after-breath', text: 'Did you hear that?', voice: 'M3', lang: 'en', speed: 1, seed: 0 },
];

test('live: synth 3 items (incl. <laugh> model case) as 44.1 kHz mono 16-bit WAV', { skip, timeout: 300_000 }, async () => {
  assert.ok(findPython(), 'python/venv missing: run setup.mjs --install');
  const progress = [];
  synthResults = await runWorker({ mode: 'synth', items, out_dir: out }, { onProgress: (p) => progress.push(p) });
  assert.deepEqual(synthResults.map((r) => r.id), items.map((i) => i.id));
  assert.equal(progress.at(-1).progress, 3);
  for (const r of synthResults) {
    const s = ffprobeStream(r.path);
    assert.equal(s.sample_rate, '44100');
    assert.equal(s.channels, 1);
    assert.equal(s.codec_name, 'pcm_s16le');
    assert.ok(r.duration_s > 0.5, `${r.id} duration ${r.duration_s}`);
    assert.ok(Math.abs(r.duration_s - ffprobeDuration(r.path)) <= 0.05, `${r.id}: ${r.duration_s} vs ffprobe ${ffprobeDuration(r.path)}`);
  }
});

test('live: ASR returns words with timestamps and no tag word is heard', { skip, timeout: 300_000 }, async () => {
  assert.ok(synthResults, 'synth test must run first');
  const res = await runWorker({ mode: 'asr', items: synthResults.map((r) => ({ id: r.id, path: r.path, lang: 'en' })) });
  const byId = Object.fromEntries(res.map((r) => [r.id, r]));
  for (const r of res) {
    assert.ok(r.words.length > 0, `${r.id}: no words`);
    for (const w of r.words) {
      assert.equal(typeof w.w, 'string');
      assert.ok(w.end >= w.start && w.p >= 0 && w.p <= 1, JSON.stringify(w));
    }
    assert.doesNotMatch(r.text, TAG_WORDS, `${r.id} heard a tag word: "${r.text}"`);
  }
  assert.match(byId.plain.text, /door/i);
  assert.match(byId['after-breath'].text, /hear/i);
});

test('live: same seed reproduces, different seed gives a different take', { skip, timeout: 300_000 }, async () => {
  const base = { text: 'Nobody was there.', voice: 'F1', lang: 'en', speed: 1 };
  const [a, b, c] = await runWorker({ mode: 'synth', out_dir: join(out, 'seeds'), items: [{ ...base, id: 'a', seed: 5 }, { ...base, id: 'b', seed: 5 }, { ...base, id: 'c', seed: 6 }] });
  const md5 = (p) => createHash('md5').update(readFileSync(p)).digest('hex');
  assert.equal(md5(a.path), md5(b.path));
  assert.notEqual(md5(a.path), md5(c.path));
  assert.match(c.path, /c\.t6\.wav$/, 'each take has its own file');
});

test('live: draftSynth with the system voice writes a 44.1 kHz mono WAV marked draft', { skip: skip || ((process.platform === 'darwin' ? which('say') : which('espeak-ng')) ? false : 'no system voice'), timeout: 60_000 }, async () => {
  const r = await draftSynth({ id: 'draft', text: 'This is a timing draft.', speed: 1 }, join(out, 'draft', 'draft.wav'));
  assert.equal(r.draft, true);
  assert.equal(ffprobeStream(r.path).sample_rate, '44100');
  assert.ok(Math.abs(r.duration_s - ffprobeDuration(r.path)) <= 0.05);
});
