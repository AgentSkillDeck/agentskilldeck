import './fixtures/native-env.mjs';
// produce.mjs end to end with the fake engine (real WAVs, no Python) and
// generated/bundled audio only (--offline: no network).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../produce.mjs';
import { hasFfmpeg, probeDuration, run } from '../lib/ffmpeg.mjs';

const HAVE_FFMPEG = await hasFfmpeg();
const SKIP = HAVE_FFMPEG ? false : 'ffmpeg not found - skipping the produce end-to-end tests';
const FAKE = fileURLToPath(new URL('./fixtures/fake-engine.mjs', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'aa produce '));
after(() => rmSync(work, { recursive: true, force: true }));

const SCRIPT = `---
title: The Lighthouse
lang: en
preset: drama
cast:
  NARRATOR: { voice: F4 }
  ELI:      { voice: M3, speed: 1.05 }
  MAYA:     { voice: F2 }
---
[scene: Lighthouse, night]  [ambience: rain on the window | low]
NARRATOR: The lamp had burned for forty years.
ELI (scared): <breath> Did you hear that?
[sfx: wooden door creak]
MAYA (hushed): Don't. Move.
[pause 1.5]
MAYA (calm): (laughs softly) It's only the wind.
`;
const scriptFile = join(work, 'the lighthouse.audio.md');
writeFileSync(scriptFile, SCRIPT);

async function produce(args, { env = {}, ...ctx } = {}) {
  let out = '';
  let err = '';
  const log = join(work, `engine-${Math.random().toString(36).slice(2)}.log`);
  const code = await main(args, {
    engine: { python: process.execPath, script: FAKE },
    env: { ...process.env, FAKE_ENGINE_LOG: log, ...env },
    stdout: (s) => { out += s; }, stderr: (s) => { err += s; }, ...ctx,
  });
  const jobs = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) : [];
  return { code, out, err, jobs };
}
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const FILES = ['mix.wav', 'mix.mp3', 'stems/dialogue.wav', 'stems/dialogue-narrator.wav', 'stems/dialogue-eli.wav', 'stems/dialogue-maya.wav', 'stems/ambience.wav', 'timeline.json', 'captions.srt', 'captions.vtt', 'audio_meta.json', 'CREDITS.md', 'qa.json'];

test('usage and script errors exit 1 with a message', async () => {
  for (const args of [[], [scriptFile], [scriptFile, '--out'], [scriptFile, '--out', work, '--takes', '0'], [scriptFile, '--out', work, '--sources', 'spotify'], [scriptFile, '--out', work, '--bogus']]) {
    const r = await produce(args);
    assert.equal(r.code, 1, `${args.join(' ')}: ${r.err}`);
    assert.match(r.err, /Usage: node scripts\/produce\.mjs|must be|Unknown sound source|Expected one script/);
  }
  const missing = await produce([join(work, 'nope.audio.md'), '--out', join(work, 'o0')]);
  assert.equal(missing.code, 1);
  assert.match(missing.err, /Script not found/);
  const bad = join(work, 'bad.audio.md');
  writeFileSync(bad, '---\ncast:\n  ELI: { voice: M3 }\n---\nELI: Hi.\nBOB: Who?\n[pause soon]\n');
  const r = await produce([bad, '--out', join(work, 'o1')]);
  assert.equal(r.code, 1);
  assert.match(r.err, /bad\.audio\.md:6: Unknown speaker "BOB"/);
  assert.match(r.err, /bad\.audio\.md:7: Bad cue/);
  writeFileSync(bad, '---\ncast:\n  ELI: { voice: M3 }\n---\nELI (zonked): Hi.\n');
  const emo = await produce([bad, '--out', join(work, 'o2')]);
  assert.equal(emo.code, 1);
  assert.match(emo.err, /line 5: Unknown emotion "zonked"/);
  const preset = await produce([scriptFile, '--out', join(work, 'o3'), '--preset', 'opera']);
  assert.equal(preset.code, 1);
  assert.match(preset.err, /Unknown domain preset "opera"/);
});

test('a final render without the engine installed exits 2 with the setup hint; --draft renders anyway', { skip: SKIP }, async () => {
  const noEngine = { engine: undefined, checkSetup: async () => ({ python: '/usr/bin/python3', supertonic: null, whisper: null }) };
  const r = await produce([scriptFile, '--out', join(work, 'nosetup'), '--offline'], noEngine);
  assert.equal(r.code, 2);
  assert.match(r.err, /missing: supertonic, faster-whisper/);
  assert.match(r.err, /setup\.mjs --install/);
  assert.match(r.err, /--draft/);
  const noFfmpeg = await produce([scriptFile, '--out', join(work, 'noff')], { hasFfmpeg: async () => false });
  assert.equal(noFfmpeg.code, 2);
  assert.match(noFfmpeg.err, /ffmpeg not found/);

  // Draft: the system voice is stubbed with a tone so the test runs anywhere.
  const draftSynth = async (item, out) => {
    await run(['-f', 'lavfi', '-i', 'sine=f=300:d=1.2', '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', out]);
    return { id: item.id, path: out, duration_s: await probeDuration(out), draft: true };
  };
  const out = join(work, 'draft');
  const d = await produce([scriptFile, '--out', out, '--offline', '--draft'], { ...noEngine, draftSynth });
  assert.equal(d.code, 0, d.err + d.out);
  assert.match(d.err, /warning: draft voice/);
  assert.match(d.out, /DRAFT VOICE/);
  const qa = readJson(join(out, 'qa.json'));
  assert.equal(qa.draft, true);
  assert.equal(qa.qa_skipped, true);
  assert.match(readFileSync(join(out, 'CREDITS.md'), 'utf8'), /Draft voice/);
  assert.deepEqual(d.jobs, [], 'the engine worker is never started for a draft');
});

test('end to end (offline): every output exists, durations agree, nv segment present, QA clean', { skip: SKIP, timeout: 120_000 }, async () => {
  const out = join(work, 'out dir');
  const r = await produce([scriptFile, '--out', out, '--offline', '--json']);
  assert.equal(r.code, 0, r.err);
  for (const f of FILES) assert.ok(existsSync(join(out, f)), `missing ${f}`);
  assert.deepEqual(r.jobs, ['synth 4', 'asr 4'], 'one worker process per stage, all segments batched');
  assert.match(r.err, /\[1\/8\] parse[\s\S]*\[4\/8\] qa round 1[\s\S]*\[8\/8\] deliver/);

  const summary = JSON.parse(r.out);
  assert.equal(summary.exit, 0);
  assert.equal(summary.ok, true);
  assert.ok(Math.abs(summary.loudness.I - -16) <= 1, `LUFS ${summary.loudness.I}`);

  const tl = readJson(join(out, 'timeline.json'));
  assert.equal(tl.version, 1);
  assert.equal(tl.title, 'The Lighthouse');
  const mixDur = await probeDuration(join(out, 'mix.wav'));
  assert.ok(Math.abs(mixDur - tl.duration_s) < 0.05, `mix ${mixDur} vs timeline ${tl.duration_s}`);
  for (const stem of ['stems/dialogue.wav', 'stems/dialogue-eli.wav', 'stems/ambience.wav']) {
    assert.ok(Math.abs(await probeDuration(join(out, stem)) - tl.duration_s) < 0.05, stem);
  }
  let prev = 0;
  for (const l of tl.lines) {
    assert.ok(l.start >= prev - 1e-6 && l.end > l.start && l.end <= tl.duration_s, `${l.id} ${l.start}-${l.end}`);
    for (const w of l.words) assert.ok(w.start >= l.start - 1e-6 && w.end <= l.end + 1e-6, `${l.id} word ${w.w} ${w.start}-${w.end} in ${l.start}-${l.end}`);
    prev = l.end;
  }
  const nv = tl.lines.filter((l) => l.kind === 'nv');
  assert.deepEqual(nv.map((l) => [l.speaker, l.tag]), [['ELI', 'breath']], 'auto: the breath is spliced, the laugh stays inline');
  assert.ok(tl.lines.some((l) => l.speaker === 'MAYA' && l.inline_nv?.includes('laugh') && !l.text.includes('<')));
  const eli = tl.lines.find((l) => l.speaker === 'ELI' && l.kind === 'speech');
  assert.equal(eli.text, 'Did you hear that?');
  assert.equal(eli.emotion, 'scared');
  assert.ok(nv[0].end <= eli.start + 1e-6, 'the breath is spliced before the words');
  assert.deepEqual(tl.scenes.map((s) => s.name), ['Lighthouse, night']);
  assert.ok(tl.cues.some((c) => c.type === 'ambience' && c.path.startsWith('assets/')));
  assert.ok(tl.assets.some((a) => a.type === 'nv' && a.path.startsWith('assets/nonverbal/') && a.license === 'CC0 1.0'));
  for (const a of tl.assets) assert.ok(existsSync(join(out, `${a.path}.license.json`)), `sidecar for ${a.path}`);
  // [pause 1.5] is honoured.
  const maya = tl.lines.filter((l) => l.speaker === 'MAYA');
  assert.ok(maya[1].start - maya[0].end >= 1.5, 'pause between the two MAYA lines');

  const srt = readFileSync(join(out, 'captions.srt'), 'utf8');
  assert.match(srt, /ELI: Did you hear that\?/);
  assert.doesNotMatch(srt, /breath|laugh/i);
  assert.match(readFileSync(join(out, 'captions.vtt'), 'utf8'), /^WEBVTT\n\n[\s\S]*<v MAYA>It's only the wind\./);

  const meta = readJson(join(out, 'audio_meta.json'));
  assert.equal(meta.total_duration_s, tl.duration_s);
  assert.deepEqual(meta.voices.map((v) => v.id), ['NARRATOR', 'ELI', 'MAYA']);
  for (const v of meta.voices) assert.ok(existsSync(join(out, v.path)));
  assert.deepEqual(meta.voices[1].words.map((w) => w.text), ['Did', 'you', 'hear', 'that?']);
  assert.equal(meta.bgm, null);
  assert.ok(meta.sfx.some((s) => s.id === 'ambience'));

  const qa = readJson(join(out, 'qa.json'));
  assert.equal(qa.ok, true);
  assert.equal(qa.draft, false);
  assert.equal(qa.lines.length, 4);
  assert.ok(qa.lines.every((l) => l.ok && l.takes === 1 && l.seed === 0));
  assert.equal(qa.mastering.ok, true);
  assert.ok(qa.warnings.some((w) => /door creak/.test(w)), 'the unresolved offline sfx is a qa.json warning');
  const credits = readFileSync(join(out, 'CREDITS.md'), 'utf8');
  assert.match(credits, /Supertonic/);
  assert.match(credits.trim().split('\n').at(-1), /^Generated sounds: no attribution required/);

  // Second run: everything comes from <out>/.cache, the engine is not started.
  const again = await produce([scriptFile, '--out', out, '--offline']);
  assert.equal(again.code, 0, again.err);
  assert.deepEqual(again.jobs, []);
  assert.match(again.err, /synth: 4 segments \(4 cached\)/);
});

test('QA retakes: a heard tag word triggers seed+1 retakes; with --takes 1 the line is flagged and exit is 3', { skip: SKIP, timeout: 120_000 }, async () => {
  const out = join(work, 'retake');
  const r = await produce([scriptFile, '--out', out, '--offline'], { env: { FAKE_ENGINE_TAG_TAKE0: '1' } });
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(r.jobs, ['synth 4', 'asr 4', 'synth 4', 'asr 4'], 'retakes are batched too');
  const qa = readJson(join(out, 'qa.json'));
  assert.ok(qa.lines.every((l) => l.ok && l.takes === 2 && l.seed === 1), JSON.stringify(qa.lines));
  assert.match(r.out, /4 retakes/);

  const flagged = join(work, 'flagged');
  const f = await produce([scriptFile, '--out', flagged, '--offline', '--takes', '1'], { env: { FAKE_ENGINE_TAG_TAKE0: '1' } });
  assert.equal(f.code, 3);
  assert.match(f.out, /QA FAILED/);
  assert.match(f.out, /spoken tag "breath"/);
  for (const file of FILES) assert.ok(existsSync(join(flagged, file)), `outputs are kept: ${file}`);
  const fq = readJson(join(flagged, 'qa.json'));
  assert.equal(fq.ok, false);
  assert.ok(fq.lines.every((l) => l.flagged && l.takes === 1));
});

test('auto nonverbals: a <cough> spoken on every take falls back to a spliced sample for that line only', { skip: SKIP, timeout: 120_000 }, async () => {
  const dir = join(work, 'auto cough');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'cough.audio.md');
  writeFileSync(file, `---\ntitle: Cough\npreset: drama\ncast:\n  ELI: { voice: M3 }\n  MAYA: { voice: F2 }\n---\nELI (tired): <cough> Long day.\nMAYA (happy): <laugh> Go home, then.\n`);
  const out = join(dir, 'out');
  const r = await produce([file, '--out', out, '--offline', '--takes', '2'], { env: { FAKE_ENGINE_SPEAK_COUGH: '1' } });
  assert.equal(r.code, 0, r.err);
  // take 0 for both lines, one cough retake, then the spliced re-render of the cough line.
  assert.deepEqual(r.jobs, ['synth 2', 'asr 2', 'synth 1', 'asr 1', 'synth 1', 'asr 1']);
  const qa = readJson(join(out, 'qa.json'));
  const eli = qa.lines.find((l) => l.speaker === 'ELI');
  const maya = qa.lines.find((l) => l.speaker === 'MAYA');
  assert.equal(eli.ok, true);
  assert.equal(eli.nv_fallback, true);
  assert.equal(eli.text, 'Long day.');
  assert.ok(!maya.nv_fallback);
  assert.equal(maya.text, '<laugh><laugh><laugh> Go home, then.', 'the laugh stays inline for the engine, stacked');
  const tl = readJson(join(out, 'timeline.json'));
  assert.deepEqual(tl.lines.filter((l) => l.kind === 'nv').map((l) => [l.speaker, l.tag]), [['ELI', 'cough']]);
  assert.match(r.err, /fallback/);
});

test('--no-qa skips the ASR stage and estimates word times', { skip: SKIP, timeout: 120_000 }, async () => {
  const out = join(work, 'noqa');
  const r = await produce([scriptFile, '--out', out, '--offline', '--no-qa']);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(r.jobs, ['synth 4']);
  const qa = readJson(join(out, 'qa.json'));
  assert.equal(qa.qa_skipped, true);
  assert.deepEqual(qa.lines, []);
  assert.ok(readJson(join(out, 'timeline.json')).lines.find((l) => l.kind === 'speech').words.length > 0);
});

// audition.mjs: one mp3 per voice + audition.md, same engine seams.
test('audition: one mp3 per voice and audition.md; usage errors exit 1; no engine exits 2', { skip: SKIP, timeout: 120_000 }, async () => {
  const { main: audition } = await import('../audition.mjs');
  const call = async (args, ctx = {}) => {
    let out = '';
    let err = '';
    const log = join(work, `aud-${Math.random().toString(36).slice(2)}.log`);
    const code = await audition(args, { engine: { python: process.execPath, script: FAKE }, env: { ...process.env, FAKE_ENGINE_LOG: log }, stdout: (s) => { out += s; }, stderr: (s) => { err += s; }, ...ctx });
    return { code, out, err, jobs: existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [] };
  };
  const dir = join(work, 'audition out');
  const r = await call(['<breath> Did you hear that?', '--voices', 'F2,m3', '--emotion', 'scared', '--out', dir]);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(r.jobs, ['synth 2'], 'all voices in one worker process');
  for (const v of ['F2', 'M3']) {
    assert.ok(existsSync(join(dir, `${v}.mp3`)), v);
    assert.ok(await probeDuration(join(dir, `${v}.mp3`)) > 1.5, `${v} includes the spliced breath`);
  }
  const md = readFileSync(join(dir, 'audition.md'), 'utf8');
  assert.match(md, /^# Audition/);
  assert.match(md, /\| F2 \| F2\.mp3 \| [\d.]+ s \| female, brightest/);
  assert.match(md, /\| M3 \| M3\.mp3 \|/);
  assert.match(md, /Delivery: scared/);
  const all = await call(['Hello.', '--out', join(work, 'aud all')]);
  assert.equal(all.code, 0, all.err);
  assert.equal(readFileSync(join(work, 'aud all', 'audition.md'), 'utf8').match(/\.mp3/g).length, 10);
  for (const args of [[], ['Hi'], ['Hi', '--out', dir, '--voices', 'X9'], ['Hi', '--out', dir, '--emotion', 'zonked'], ['Hi', '--out', dir, '--seed', 'x']]) {
    const bad = await call(args);
    assert.equal(bad.code, 1, args.join(' '));
    assert.match(bad.err, /Usage: node scripts\/audition\.mjs/);
  }
  const missing = await call(['Hi', '--out', dir], { engine: undefined, checkSetup: async () => ({ python: null }) });
  assert.equal(missing.code, 2);
  assert.match(missing.err, /setup\.mjs --install/);
});
