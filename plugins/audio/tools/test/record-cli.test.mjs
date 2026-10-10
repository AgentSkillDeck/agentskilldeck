import './fixtures/native-env.mjs';
// record.mjs and the user's own voice in produce.mjs, end to end with the fake
// engine (and the fake clone worker). The "user" recordings are generated
// audio; the microphone is never opened (the live path uses an ffmpeg lavfi
// source through AGENTATELIER_RECORD_INPUT).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main as record } from '../record.mjs';
import { main as produceMain } from '../produce.mjs';
import { hasFfmpeg, readWavInfo, run } from '../lib/ffmpeg.mjs';

const SKIP = (await hasFfmpeg()) ? false : 'ffmpeg not found';
const FAKE = fileURLToPath(new URL('./fixtures/fake-engine.mjs', import.meta.url));
const FAKE_CLONE = fileURLToPath(new URL('./fixtures/fake-clone.mjs', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'aa record '));
after(() => rmSync(work, { recursive: true, force: true }));
const VOICES = join(work, 'voice store');
const OWN = 'This is my own voice';

const SCRIPT = `---
title: Kitchen
preset: drama
cast:
  ME: { voice: record }
  ELI: { voice: M3 }
---
ME (happy): (laughs) Good morning, Eli.
ELI: Morning. Coffee?
ME: Yes please, a big one.
`;
const scriptFile = join(work, 'kitchen scene.audio.md');
writeFileSync(scriptFile, SCRIPT);

async function call(fn, args, { env = {}, ...ctx } = {}) {
  let out = '';
  let err = '';
  const code = await fn(args, {
    engine: { python: process.execPath, script: FAKE, clone: { python: process.execPath, script: FAKE_CLONE } },
    env: { ...process.env, AGENTATELIER_VOICES: VOICES, ...env },
    interactive: false,
    stdout: (s) => { out += s; }, stderr: (s) => { err += s; }, ...ctx,
  });
  return { code, out, err };
}
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// Generated "speech": a voiced harmonic tone with syllable-like gaps and a
// quiet noise floor, padded with silence like a real take.
async function speech(path, { seconds = 2, f0 = 180, lead = 0.6, tail = 0.8 } = {}) {
  const v = `(sin(2*PI*${f0}*t)+0.5*sin(2*PI*${2 * f0}*t)+0.33*sin(2*PI*${3 * f0}*t))*gt(mod(t,0.5),0.08)`;
  const expr = `if(between(t,${lead},${lead + seconds}),0.08*${v},0)+0.0004*(random(0)-0.5)`;
  await run(['-f', 'lavfi', '-i', `aevalsrc=${expr.replaceAll(',', '\\,')}:s=48000:d=${lead + seconds + tail}`, '-c:a', 'pcm_s16le', path]);
  return path;
}

test('usage errors exit 1 with a message', async () => {
  for (const [args, re] of [
    [[], /Expected one script file/],
    [[scriptFile, '--out', work], /--speaker NAME is required/],
    [[scriptFile, '--speaker', 'ME'], /--out <dir> is required/],
    [['--reference'], /--reference needs --name/],
    [['--reference', '--name', '../x'], /--name must be/],
    [[scriptFile, '--speaker', 'ME', '--out', work, '--from', 'notes.txt'], /--from must be one of/],
    [[scriptFile, '--speaker', 'ME', '--out', work, '--line', 'seven'], /--line takes script line numbers/],
    [[scriptFile, '--speaker', 'ELI', '--out', work, '--consent', OWN], /cast as voice M3.*voice: record/s],
    [[scriptFile, '--speaker', 'BOB', '--out', work, '--consent', OWN], /not in the cast/],
    [[scriptFile, '--speaker', 'ME', '--out', work, '--line', '9', '--consent', OWN], /not ME's.*8, 10/s],
  ]) {
    const r = await call(record, args);
    assert.equal(r.code, 1, `${args.join(' ')}: ${r.err}`);
    assert.match(r.err, re);
  }
});

test('consent gate: nothing is recorded without a typed statement; produce refuses record voices without it', { skip: SKIP }, async () => {
  const out = join(work, 'no consent');
  const take = await speech(join(work, 'me8.wav'));
  const r = await call(record, [scriptFile, '--speaker', 'ME', '--out', out, '--line', '8', '--from', take]);
  assert.equal(r.code, 1);
  assert.match(r.err, /needs a consent statement.*--consent/s);
  assert.match(r.err, /This is my own voice/);
  assert.equal(existsSync(join(out, 'recordings', 'L8.wav')), false);
  const bad = await call(record, [scriptFile, '--speaker', 'ME', '--out', out, '--line', '8', '--from', take, '--consent', 'sure']);
  assert.equal(bad.code, 1);
  assert.match(bad.err, /not one of the accepted statements/);
  const p = await call(produceMain, [scriptFile, '--out', out, '--offline']);
  assert.equal(p.code, 1);
  assert.match(p.err, /No consent statement for the recorded speaker ME/);
  assert.match(p.err, /record\.mjs ".*kitchen scene\.audio\.md" --speaker ME/);
  // Typed at the prompt (interactive): a wrong statement is asked again.
  const answers = ['yes', "I have the speaker's consent: Sam Lee"];
  const typed = await call(record, [scriptFile, '--speaker', 'ME', '--out', out, '--line', '8', '--from', take], { interactive: true, ask: async () => answers.shift(), env: { FAKE_ENGINE_ASR_TEXT: 'Good morning, Eli.' } });
  assert.equal(typed.code, 0, typed.err);
  assert.equal(readJson(join(out, 'recordings', 'consent.json')).speakers.ME.speaker, 'Sam Lee');
  assert.equal(readJson(join(out, 'recordings', 'consent.json')).speakers.ME.via, 'prompt', 'how the statement was given is on record');
  assert.equal(statSync(join(out, 'recordings')).mode & 0o777, 0o700, 'recordings are owner-only');
});

test('live capture is refused without a terminal (the agent shell), before any consent is stored', async () => {
  const out = join(work, 'no tty');
  const r = await call(record, [scriptFile, '--speaker', 'ME', '--out', out, '--line', '8', '--consent', OWN]);
  assert.equal(r.code, 1);
  assert.match(r.err, /Live recording needs a terminal.*--from <file>/s);
  assert.equal(existsSync(join(out, 'recordings', 'consent.json')), false);
  const ref = await call(record, ['--reference', '--name', 'nottyref', '--consent', OWN]);
  assert.equal(ref.code, 1);
  assert.match(ref.err, /Live recording needs a terminal/);
});

test('--from per line: cleaned, transcribed, checked and stored; produce lists the missing lines', { skip: SKIP }, async () => {
  const out = join(work, 'per line');
  const take = await speech(join(work, 'me8b.wav'), { seconds: 1.6 });
  const r = await call(record, [scriptFile, '--speaker', 'ME', '--out', out, '--line', '8', '--from', take, '--consent', OWN], { env: { FAKE_ENGINE_ASR_TEXT: 'Good morning, Eli.' } });
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /L8 ok/);
  const info = await readWavInfo(join(out, 'recordings', 'L8.wav'));
  assert.equal(info.sampleRate, 44100);
  assert.equal(info.channels, 1);
  assert.ok(info.samples / info.sampleRate < 2.3, 'leading/trailing silence trimmed');
  const doc = readJson(join(out, 'recordings', 'recordings.json'));
  const e = doc.lines.L8;
  assert.equal(e.speaker, 'ME');
  assert.equal(e.text, 'Good morning, Eli.');
  assert.equal(e.path, join('recordings', 'L8.wav'));
  assert.equal(e.ok, true);
  assert.equal(e.wer, 0);
  assert.equal(e.consent, 'recordings/consent.json');
  assert.equal(e.source, 'file');
  assert.equal(readJson(join(out, 'recordings', 'consent.json')).speakers.ME.kind, 'own');
  assert.equal(readJson(join(out, 'recordings', 'consent.json')).speakers.ME.via, 'flag');
  // Line 10 is not recorded yet: produce exits 1 naming it and the command.
  const p = await call(produceMain, [scriptFile, '--out', out, '--offline']);
  assert.equal(p.code, 1);
  assert.match(p.err, /Missing recordings for ME: L10\. Record them: node scripts\/record\.mjs .* --speaker ME --out ".*per line" --line 10/);
  // A misread fails the check (exit 3, kept on disk) with the re-record command.
  const t10 = await speech(join(work, 'me10.wav'));
  const miss = await call(record, [scriptFile, '--speaker', 'ME', '--out', out, '--line', '10', '--from', t10], { env: { FAKE_ENGINE_ASR_TEXT: 'No thanks, a small tea.' } });
  assert.equal(miss.code, 3);
  assert.match(miss.out, /L10 FAILED/);
  assert.match(miss.out, /Re-record the failed lines: node scripts\/record\.mjs .* --line 10/);
  assert.ok(existsSync(join(out, 'recordings', 'L10.wav')));
  const log = join(work, 'per-line-engine.log');
  const failedRender = await call(produceMain, [scriptFile, '--out', out, '--offline'], { env: { FAKE_ENGINE_LOG: log } });
  assert.equal(failedRender.code, 3, 'a failing recording fails QA');
  const jobs = readFileSync(log, 'utf8').trim().split('\n');
  assert.ok(jobs.includes('synth 1'), `only ELI is synthesised: ${jobs}`);
  assert.match(failedRender.out, /re-record: node scripts\/record\.mjs/);
  const keep = await call(record, [scriptFile, '--speaker', 'ME', '--out', out, '--line', '10', '--from', t10, '--keep-failed'], { env: { FAKE_ENGINE_ASR_TEXT: 'Yes please, a big one, ha.' } });
  assert.equal(keep.code, 0, keep.out);
  assert.equal(readJson(join(out, 'recordings', 'recordings.json')).lines.L10.accepted, true);

  // The full render: recordings in place of synthesis, everything else unchanged.
  const done = await call(produceMain, [scriptFile, '--out', out, '--offline']);
  assert.equal(done.code, 0, done.err + done.out);
  const tl = readJson(join(out, 'timeline.json'));
  const mine = tl.lines.filter((l) => l.speaker === 'ME');
  assert.equal(mine.length, 2);
  assert.ok(mine.every((l) => l.voice === 'record' && l.words.length > 0));
  assert.ok(existsSync(join(out, 'stems', 'dialogue-me.wav')));
  const qa = readJson(join(out, 'qa.json'));
  assert.ok(qa.lines.filter((l) => l.speaker === 'ME').every((l) => l.recorded && l.ok));
  assert.match(qa.lines.find((l) => l.n === 10).notes.join(' '), /kept by the speaker/);
  const credits = readFileSync(join(out, 'CREDITS.md'), 'utf8');
  assert.match(credits, /ME: recorded by the speaker/);
  assert.match(credits, /Supertonic/);
  // An edited line no longer matches its recording.
  const edited = join(work, 'kitchen edited.audio.md');
  writeFileSync(edited, SCRIPT.replace('a big one', 'a small one'));
  const changed = await call(produceMain, [edited, '--out', out, '--offline']);
  assert.equal(changed.code, 1);
  assert.match(changed.err, /L10 \(the line changed since it was recorded\)/);
});

test('--one-take splits one file into the speaker\'s lines by the ASR word times', { skip: SKIP }, async () => {
  const out = join(work, 'one take');
  const take = await speech(join(work, 'take.wav'), { seconds: 4.6, lead: 0.5 });
  // The cleaned take starts ~0.15 s before the speech (the trim keeps a little air).
  const words = [['Good', 0.15, 0.45], ['morning,', 0.45, 0.9], ['Eli.', 0.9, 1.3], ['Yes', 2.9, 3.2], ['please,', 3.2, 3.6], ['a', 3.7, 3.8], ['big', 3.8, 4.1], ['one.', 4.1, 4.6]]
    .map(([w, start, end]) => ({ w, start, end, p: 0.9 }));
  const asr = join(work, 'take-asr.json');
  writeFileSync(asr, JSON.stringify({ text: words.map((w) => w.w).join(' '), words }));
  const r = await call(record, [scriptFile, '--speaker', 'ME', '--out', out, '--one-take', '--from', take, '--consent', OWN, '--json'], { env: { FAKE_ENGINE_ASR_JSON: asr } });
  assert.equal(r.code, 0, r.err + r.out);
  const s = JSON.parse(r.out);
  assert.equal(s.recorded, 2);
  const doc = readJson(join(out, 'recordings', 'recordings.json'));
  assert.equal(doc.lines.L8.heard, 'Good morning, Eli.');
  assert.equal(doc.lines.L10.heard, 'Yes please, a big one.');
  assert.equal(doc.lines.L8.mode, 'one-take');
  assert.ok(doc.lines.L8.duration_s > 1.1 && doc.lines.L8.duration_s < 2.2, `L8 ${doc.lines.L8.duration_s}`);
  assert.ok(doc.lines.L10.duration_s > 1.6 && doc.lines.L10.duration_s < 3, `L10 ${doc.lines.L10.duration_s}`);
  assert.ok(doc.lines.L10.asr.words[0].start < 0.5, 'word times are relative to the cut');
  // --from with several lines and no --one-take reads it as one take too.
  const implied = await call(record, [scriptFile, '--speaker', 'ME', '--out', out, '--from', take], { env: { FAKE_ENGINE_ASR_JSON: asr } });
  assert.equal(implied.code, 0);
  assert.match(implied.err, /reading it as one take/);
  // A line that was not read is reported (exit 3) with the per-line command.
  const short = join(work, 'take-short.json');
  writeFileSync(short, JSON.stringify({ text: 'Good morning, Eli.', words: words.slice(0, 3) }));
  const missing = await call(record, [scriptFile, '--speaker', 'ME', '--out', join(work, 'one take 2'), '--one-take', '--from', take, '--consent', OWN], { env: { FAKE_ENGINE_ASR_JSON: short } });
  assert.equal(missing.code, 3);
  assert.match(missing.out, /L10 MISSING/);
  assert.match(missing.out, /--line 10/);
});

test('live per-line capture (lavfi source in place of the mic) stops on silence and stores the line', { skip: SKIP }, async () => {
  const out = join(work, 'live');
  const input = ['-re', '-f', 'lavfi', '-i', 'aevalsrc=if(between(t\\,0.3\\,1.5)\\,0.2*sin(2*PI*190*t)\\,0):s=44100:d=20'];
  const r = await call(record, [scriptFile, '--speaker', 'ME', '--out', out, '--line', '8', '--consent', OWN], { env: { FAKE_ENGINE_ASR_TEXT: 'Good morning, Eli.', AGENTATELIER_RECORD_INPUT: JSON.stringify(input) } });
  assert.equal(r.code, 0, r.err);
  assert.match(r.err, /Line 8 \(ME, happy\):\n {2}\(laugh\) Good morning, Eli\./);
  assert.match(r.err, /stops by itself after 1\.2 s of silence/);
  const e = readJson(join(out, 'recordings', 'recordings.json')).lines.L8;
  assert.equal(e.source, 'mic');
  assert.ok(e.duration_s < 3, `trimmed take ${e.duration_s}`);
});

test('--reference stores a cleaned 10-60 s reference with consent and a base voice by pitch', { skip: SKIP }, async () => {
  const ref = await speech(join(work, 'ref.wav'), { seconds: 12, f0: 200 });
  const none = await call(record, ['--reference', '--name', 'testme', '--from', ref]);
  assert.equal(none.code, 1);
  assert.match(none.err, /consent statement/);
  const r = await call(record, ['--reference', '--name', 'TestMe', '--from', ref, '--consent', OWN, '--json']);
  assert.equal(r.code, 0, r.err);
  const s = JSON.parse(r.out);
  assert.equal(s.voice, 'clone:testme');
  assert.equal(s.base, 'F4', `200 Hz is nearest F4 (196 Hz): ${s.f0_median_hz}`);
  assert.ok(Math.abs(s.f0_median_hz - 200) < 4);
  const dir = join(VOICES, 'testme');
  const meta = readJson(join(dir, 'voice.json'));
  assert.equal(meta.base, 'F4');
  assert.equal(meta.source, 'file');
  assert.ok(meta.duration_s >= 11.5 && meta.duration_s <= 13);
  assert.equal(readJson(join(dir, 'consent.json')).kind, 'own');
  assert.equal(readJson(join(dir, 'consent.json')).via, 'flag');
  assert.equal(statSync(dir).mode & 0o777, 0o700, 'the clone voice folder is owner-only');
  assert.equal((await readWavInfo(join(dir, 'reference.wav'))).sampleRate, 44100);
  const again = await call(record, ['--reference', '--name', 'testme', '--from', ref, '--consent', OWN]);
  assert.equal(again.code, 1);
  assert.match(again.err, /already exists.*--force/s);
  const short = await speech(join(work, 'short.wav'), { seconds: 5 });
  const tooShort = await call(record, ['--reference', '--name', 'shorty', '--from', short, '--consent', OWN]);
  assert.equal(tooShort.code, 1);
  assert.match(tooShort.err, /needs 10-60 s/);
  assert.equal(existsSync(join(VOICES, 'shorty')), false);
  const long = await speech(join(work, 'long.wav'), { seconds: 70 });
  const capped = await call(record, ['--reference', '--name', 'longer', '--from', long, '--consent', OWN, '--json']);
  assert.equal(capped.code, 0, capped.err);
  assert.ok(JSON.parse(capped.out).duration_s <= 60.05);
});

test('clone:<name> renders with the base voice, converts with the clone worker, QA on the converted audio', { skip: SKIP }, async () => {
  const dir = join(VOICES, 'grace');
  mkdirSync(dir, { recursive: true });
  await speech(join(dir, 'reference.wav'), { seconds: 3 });
  writeFileSync(join(dir, 'voice.json'), JSON.stringify({ version: 1, name: 'grace', base: 'F2', reference: 'reference.wav' }));
  writeFileSync(join(dir, 'consent.json'), JSON.stringify({ kind: 'own', statement: OWN }));
  const script = join(work, 'clone.audio.md');
  writeFileSync(script, '---\npreset: drama\ncast:\n  GRACE: { voice: clone:grace }\n  ELI: { voice: M3 }\n---\nGRACE (happy): <laugh> Hello there, Eli.\nELI: Hi Grace.\nGRACE: It has been a long time.\n');
  const out = join(work, 'clone out');
  const log = join(work, 'clone.log');
  const elog = join(work, 'clone-engine.log');
  const r = await call(produceMain, [script, '--out', out, '--offline'], { env: { FAKE_CLONE_LOG: log, FAKE_ENGINE_LOG: elog } });
  assert.equal(r.code, 0, r.err + r.out);
  assert.match(r.err, /clone voices: grace \(base F2\)/);
  // The base voice's row applies (looked up in this env's voice store): the laugh goes native, not spliced.
  const tlLaugh = readJson(join(out, 'timeline.json'));
  assert.equal(tlLaugh.lines.filter((l) => l.speaker === 'GRACE' && l.kind === 'nv').length, 0, 'no spliced laugh for the clone');
  assert.match(readJson(join(out, 'qa.json')).lines.find((l) => l.speaker === 'GRACE').text, /<laugh>/);
  assert.deepEqual(readFileSync(log, 'utf8').trim().split('\n'), ['start', 'convert 2 grace'], 'one clone process for the batch');
  assert.ok(readFileSync(elog, 'utf8').includes('synth 3'), 'clone lines are synthesised in the same Supertonic batch');
  const qa = readJson(join(out, 'qa.json'));
  assert.ok(qa.ok);
  assert.ok(qa.lines.filter((l) => l.speaker === 'GRACE').every((l) => l.voice === 'clone:grace' && l.ok));
  const tl = readJson(join(out, 'timeline.json'));
  assert.ok(tl.lines.filter((l) => l.speaker === 'GRACE').every((l) => l.voice === 'clone:grace'));
  const credits = readFileSync(join(out, 'CREDITS.md'), 'utf8');
  assert.match(credits, /Chatterbox/);
  assert.match(credits, /PerTh/);
  assert.match(credits, /GRACE: cloned voice "grace"/);
  // Cached: a second run converts nothing.
  const again = await call(produceMain, [script, '--out', out, '--offline'], { env: { FAKE_CLONE_LOG: log } });
  assert.equal(again.code, 0);
  assert.equal(readFileSync(log, 'utf8').trim().split('\n').length, 2, 'a fully cached run starts no clone worker');
  // Retakes: take 0 of every line fails QA, so a second round converts again, in the same process.
  const rlog = join(work, 'clone-retake.log');
  const re = await call(produceMain, [script, '--out', join(work, 'clone retakes'), '--offline'], { env: { FAKE_CLONE_LOG: rlog, FAKE_ENGINE_TAG_TAKE0: '1' } });
  assert.equal(re.code, 0, re.err + re.out);
  const rl = readFileSync(rlog, 'utf8').trim().split('\n');
  assert.equal(rl.filter((l) => l === 'start').length, 1, `one clone process for the whole run: ${rl}`);
  assert.ok(rl.filter((l) => l.startsWith('convert')).length >= 2, `take 0 and the retake round both converted: ${rl}`);

  // Unknown clone (exit 1), no consent (exit 1), clone engine not installed (exit 2).
  const unknown = join(work, 'unknown.audio.md');
  writeFileSync(unknown, '---\ncast:\n  X: { voice: clone:nobody }\n---\nX: Hi.\n');
  const u = await call(produceMain, [unknown, '--out', join(work, 'u'), '--offline']);
  assert.equal(u.code, 1);
  assert.match(u.err, /no clone voice "nobody".*record\.mjs --reference --name nobody/s);
  rmSync(join(dir, 'consent.json'));
  const nc = await call(produceMain, [script, '--out', join(work, 'nc'), '--offline']);
  assert.equal(nc.code, 1);
  assert.match(nc.err, /no consent statement/);
  writeFileSync(join(dir, 'consent.json'), JSON.stringify({ kind: 'own', statement: OWN }));
  const noEngine = await call(produceMain, [script, '--out', join(work, 'ne'), '--offline'], { engine: { python: process.execPath, script: FAKE }, checkCloneSetup: async () => ({ ok: false }) });
  assert.equal(noEngine.code, 2);
  assert.match(noEngine.err, /setup\.mjs --install-clone/);
  // A draft needs no clone engine.
  const draft = await call(produceMain, [script, '--out', join(work, 'draft'), '--offline', '--draft'], { engine: undefined, checkCloneSetup: async () => ({ ok: false }) });
  assert.equal(draft.code, 0, draft.err);
  assert.match(draft.out, /drafted with the system voice, not converted/);
});
