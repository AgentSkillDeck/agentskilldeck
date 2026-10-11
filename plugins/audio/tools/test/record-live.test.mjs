// Live: the user's own voice with the real engines. The "user" is Supertonic
// (no microphone is ever opened); real faster-whisper checks the recordings.
//   LIVE_AUDIO=1  recorded lines (per line and one take) through record.mjs --from, then produce
//   LIVE_CLONE=1  a clone reference from an F2 render, then produce with voice: clone:testref
//                 (needs `setup.mjs --install-clone`)
// Run: LIVE_AUDIO=1 LIVE_CLONE=1 node --test --test-timeout 3600000 plugins/audio/tools/test/record-live.test.mjs
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main as record, REFERENCE_TEXT } from '../record.mjs';
import { main as produce } from '../produce.mjs';
import { runWorker, findPython } from '../lib/engine.mjs';
import { probeDuration, run } from '../lib/ffmpeg.mjs';

const LIVE_AUDIO = process.env.LIVE_AUDIO === '1';
const LIVE_CLONE = process.env.LIVE_CLONE === '1';
const work = mkdtempSync(join(tmpdir(), 'aa live record '));
after(() => { if (!process.env.KEEP_LIVE_OUT) rmSync(work, { recursive: true, force: true }); else process.stderr.write(`kept ${work}\n`); });
const env = { ...process.env, AGENTSKILLDECK_VOICES: join(work, 'voices') };
const OWN = 'This is my own voice';

async function call(fn, args) {
  let out = '';
  let err = '';
  const code = await fn(args, { env, interactive: false, stdout: (s) => { out += s; }, stderr: (s) => { err += s; process.stderr.write(s); } });
  return { code, out, err };
}

// Supertonic as the "user": one WAV per text, padded with room-like silence.
async function speak(items) {
  const dir = join(work, 'speak');
  const res = await runWorker({ mode: 'synth', out_dir: dir, items: items.map((it, i) => ({ id: `s${i}`, text: it.text, voice: it.voice, lang: 'en', speed: 1, seed: 3 })) }, { python: findPython({ env }), env });
  return res.map((r) => r.path);
}
async function padded(src, dest, { lead = 0.7, tail = 0.9 } = {}) {
  await run(['-i', src, '-af', `adelay=${Math.round(lead * 1000)}:all=1,apad=pad_dur=${tail},aresample=48000`, '-ac', '2', '-c:a', 'pcm_s16le', dest]);
  return dest;
}
async function joined(srcs, dest, gap = 1.0) {
  const inputs = srcs.flatMap((s) => ['-i', s]);
  const pads = srcs.map((_, i) => `[${i}:a]aresample=48000,apad=pad_dur=${gap}[a${i}]`).join(';');
  await run([...inputs, '-filter_complex', `${pads};${srcs.map((_, i) => `[a${i}]`).join('')}concat=n=${srcs.length}:v=0:a=1,adelay=600:all=1[o]`, '-map', '[o]', '-c:a', 'pcm_s16le', dest]);
  return dest;
}

function checkTimeline(out) {
  const tl = JSON.parse(readFileSync(join(out, 'timeline.json'), 'utf8'));
  let last = 0;
  for (const l of tl.lines) {
    assert.ok(l.start >= last - 1e-6 && l.end > l.start && l.end <= tl.duration_s + 1e-6, `line ${l.id} in order and in bounds`);
    last = l.start;
  }
  return tl;
}

const SCRIPT = `---
title: Morning (live record test)
preset: drama
cast:
  ME: { voice: record }
  ELI: { voice: M3 }
---
ME (happy): Good morning, Eli. Did you sleep well?
ELI: Not really. The storm kept me up.
ME: Then you need a big cup of coffee.
`;

test('live: recorded lines from files, per line and as one take, then a clean render', { skip: LIVE_AUDIO ? false : 'set LIVE_AUDIO=1', timeout: 1_800_000 }, async () => {
  const script = join(work, 'morning.audio.md');
  writeFileSync(script, SCRIPT);
  const [a, b] = await speak([{ text: 'Good morning, Eli. Did you sleep well?', voice: 'F1' }, { text: 'Then you need a big cup of coffee.', voice: 'F1' }]);
  const out = join(work, 'per line');
  const r8 = await call(record, [script, '--speaker', 'ME', '--out', out, '--line', '8', '--from', await padded(a, join(work, 'me8.wav')), '--consent', OWN]);
  assert.equal(r8.code, 0, r8.out);
  const r10 = await call(record, [script, '--speaker', 'ME', '--out', out, '--line', '10', '--from', await padded(b, join(work, 'me10.wav'))]);
  assert.equal(r10.code, 0, r10.out);
  const p = await call(produce, [script, '--out', out, '--offline', '--json']);
  assert.equal(p.code, 0, p.out);
  const s = JSON.parse(p.out);
  assert.equal(s.qa.failed, 0);
  const tl = checkTimeline(out);
  assert.equal(tl.lines.filter((l) => l.voice === 'record').length, 2);
  assert.ok(Math.abs((await probeDuration(join(out, 'mix.wav'))) - tl.duration_s) < 0.05);

  // One take of both lines, split by the word times.
  const take = await joined([a, b], join(work, 'take.wav'));
  const o2 = join(work, 'one take');
  const t = await call(record, [script, '--speaker', 'ME', '--out', o2, '--one-take', '--from', take, '--consent', OWN, '--json']);
  assert.equal(t.code, 0, t.out);
  const recs = JSON.parse(readFileSync(join(o2, 'recordings', 'recordings.json'), 'utf8')).lines;
  assert.ok(recs.L8.wer <= 0.15 && recs.L10.wer <= 0.15, JSON.stringify(recs));
  const p2 = await call(produce, [script, '--out', o2, '--offline']);
  assert.equal(p2.code, 0, p2.out);
  checkTimeline(o2);
});

test('live: clone:testref (reference = a Supertonic F2 render) renders QA clean with a sound timeline', { skip: LIVE_CLONE ? false : 'set LIVE_CLONE=1 (needs setup.mjs --install-clone)', timeout: 3_600_000 }, async () => {
  const [refRaw] = await speak([{ text: REFERENCE_TEXT, voice: 'F2' }]);
  const ref = await padded(refRaw, join(work, 'reference.wav'));
  const r = await call(record, ['--reference', '--name', 'testref', '--from', ref, '--consent', OWN, '--json']);
  assert.equal(r.code, 0, r.err);
  const v = JSON.parse(r.out);
  assert.ok(['F2', 'F4', 'F1'].includes(v.base), `an F2 reference picks a bright female base, got ${v.base} (${v.f0_median_hz} Hz)`);
  const script = join(work, 'clone.audio.md');
  writeFileSync(script, `---
title: Clone (live test)
preset: drama
cast:
  ME: { voice: clone:testref }
---
ME: Hello, this is my own voice, made on my own machine.
ME (happy): <laugh> I can hardly believe how close it sounds.
ME (calm): Every word you hear was checked by a transcript.
`);
  const out = join(work, 'clone out');
  const t0 = Date.now();
  const p = await call(produce, [script, '--out', out, '--offline', '--json']);
  process.stderr.write(`clone produce: ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
  assert.equal(p.code, 0, p.out);
  const s = JSON.parse(p.out);
  assert.equal(s.qa.failed, 0);
  const qa = JSON.parse(readFileSync(join(out, 'qa.json'), 'utf8'));
  assert.ok(qa.ok);
  for (const l of qa.lines) process.stderr.write(`  ${l.id} wer ${l.wer} takes ${l.takes} heard "${l.heard}"\n`);
  const tl = checkTimeline(out);
  assert.ok(tl.lines.every((l) => l.voice === 'clone:testref'));
  assert.equal(tl.lines.filter((l) => l.kind === 'nv').length, 0, 'the laugh went native on the base voice and through the converter, not spliced');
  assert.ok(Math.abs((await probeDuration(join(out, 'mix.wav'))) - tl.duration_s) < 0.05);
  assert.match(readFileSync(join(out, 'CREDITS.md'), 'utf8'), /Chatterbox/);
});
