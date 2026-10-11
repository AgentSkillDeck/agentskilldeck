import './fixtures/native-env.mjs';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runWorker, startWorker, findPython, draftSynth, assertEngineText, wavDuration, SetupError, EngineError } from '../lib/engine.mjs';

const fake = fileURLToPath(new URL('./fixtures/fake-synth.mjs', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'aa engine '));
after(() => rmSync(tmp, { recursive: true, force: true }));

const opts = (extra = {}) => ({ python: process.execPath, script: fake, ...extra });
const items = [
  { id: 'l1', text: 'Hello there.', voice: 'M1', lang: 'en', speed: 1, seed: 0 },
  { id: 'l2', text: 'Oh <laugh> fine.', voice: 'F2', lang: 'en', speed: 1.1, seed: 1 },
  { id: 'l3', text: 'Bye.', voice: 'F2', lang: 'en', speed: 1, seed: 2 },
];

test('runWorker frames JSON lines and returns results in order with default steps 10', async () => {
  const res = await runWorker({ mode: 'synth', items, out_dir: tmp }, opts());
  assert.deepEqual(res.map((r) => r.id), ['l1', 'l2', 'l3']);
  assert.equal(res[0].path, join(tmp, 'l1.t0.wav'), 'one file per take: <id>.t<seed>.wav');
  assert.equal(res[0].duration_s, 1.25);
  assert.equal(res[0].steps, 10);
});

test('runWorker reassembles lines split across chunks and ignores non-JSON stdout', async () => {
  const res = await runWorker({ mode: 'asr', items: items.map(({ id }) => ({ id, path: 'x.wav', lang: 'en' })), fake: { chunked: true, noise: true } }, opts());
  assert.equal(res.length, 3);
  assert.deepEqual(res[1].words[0], { w: 'hello', start: 0, end: 0.4, p: 0.9 });
});

test('runWorker reports progress from stderr JSON lines', async () => {
  const seen = [];
  await runWorker({ mode: 'synth', items, out_dir: tmp }, opts({ onProgress: (p) => seen.push(p) }));
  assert.deepEqual(seen, [{ progress: 1, total: 3 }, { progress: 2, total: 3 }, { progress: 3, total: 3 }]);
});

test('worker crash rejects with EngineError carrying the stderr tail', async () => {
  await assert.rejects(runWorker({ mode: 'synth', items, out_dir: tmp, fake: { crash: true } }, opts()), (e) => {
    assert.ok(e instanceof EngineError);
    assert.equal(e.code, 7);
    assert.match(e.message, /exited with code 7/);
    assert.match(e.message, /RuntimeError: onnx session failed/);
    assert.doesNotMatch(e.message, /noise line 0\b/, 'only the tail is kept');
    return true;
  });
});

test('worker exit 2 (engine not installed) rejects with SetupError', async () => {
  await assert.rejects(runWorker({ mode: 'synth', items, out_dir: tmp, fake: { setup: true } }, opts()), (e) => {
    assert.ok(e instanceof SetupError);
    assert.equal(e.exitCode, 2);
    assert.match(e.message, /supertonic/);
    return true;
  });
});

test('missing python throws SetupError', async () => {
  await assert.rejects(runWorker({ mode: 'synth', items: [] }, { python: null, findPythonImpl: () => null }), SetupError);
  await assert.rejects(runWorker({ mode: 'synth', items: [] }, { python: join(tmp, 'no-such-python') }), SetupError);
});

test('abort signal kills the worker process tree', async () => {
  const pidfile = join(tmp, 'grandchild.pid');
  const ac = new AbortController();
  const p = runWorker({ mode: 'synth', items, out_dir: tmp, fake: { hang: true, pidfile } }, opts({ signal: ac.signal }));
  for (let i = 0; i < 200 && !existsSync(pidfile); i++) await new Promise((r) => setTimeout(r, 20));
  const pid = Number(readFileSync(pidfile, 'utf8'));
  assert.ok(pid > 0);
  ac.abort();
  await assert.rejects(p, { name: 'AbortError' });
  let alive = true;
  for (let i = 0; i < 100 && alive; i++) {
    try { process.kill(pid, 0); await new Promise((r) => setTimeout(r, 20)); } catch { alive = false; }
  }
  assert.equal(alive, false, 'grandchild should be killed');
});

test('an already-aborted signal rejects without spawning', async () => {
  await assert.rejects(runWorker({ mode: 'synth', items }, opts({ signal: AbortSignal.abort() })), { name: 'AbortError' });
});

test('runWorker refuses synth text the engine would speak as words', async () => {
  for (const bad of ['<breath> Did you hear that?', 'ok [laugh]', '(sighs) no', '*laughs*', 'a/b', 'a | b', '#1', 'snake_case', 'fine<sigh>', '<gasp> oh', 'worked<laugh>', '<sigh/> no']) {
    await assert.rejects(runWorker({ mode: 'synth', items: [{ id: 'x', text: bad, voice: 'M1' }] }, opts()), /engine text/, bad);
  }
  assert.doesNotThrow(() => assertEngineText('Oh, that is funny. <laugh> I did not expect it.'));
  assert.doesNotThrow(() => assertEngineText('<laugh> Right.'));
  assert.doesNotThrow(() => assertEngineText('<cough> Long day. <laugh> Fine.'), 'auto mode keeps <cough> inline too');
  assert.throws(() => assertEngineText('<sigh> Long day.'), /engine text/, 'sigh is never native (spoken as the word, stacked or not)');
  assert.throws(() => assertEngineText('<sigh> <sigh> <sigh> Long day.'), /engine text/, 'a stacked sigh neither');
  assert.doesNotThrow(() => assertEngineText('Ha. <laugh> <laugh> <laugh> <laugh> Stop.'), 'a stacked laugh of up to four tags');
  assert.throws(() => assertEngineText('Ha. <laugh> <laugh> <laugh> <laugh> <laugh> Stop.'), /engine text/, 'five laughs in a row');
  assert.doesNotThrow(() => assertEngineText('Fine. <cough> <cough> <cough> Sorry. <yawn> <yawn> <yawn> <hmm> <hmm> <hmm> So.'));
  assert.throws(() => assertEngineText('<cough> <cough> <cough> <cough> Fine.'), /engine text/, 'four coughs in a row');
  assert.throws(() => assertEngineText('<breath> <breath> <breath> Go.'), /engine text/, 'breath is never native');
  assert.throws(() => assertEngineText('<groan> <groan> <groan> Ugh.'), /engine text/, 'groan is never native');
});

test('findPython prefers AGENTSKILLDECK_VENV, then ~/.agentskilldeck/venv, then python3 on PATH', () => {
  const home = join(tmp, 'home');
  const venv = join(tmp, 'custom venv');
  const bin = join(tmp, 'pathbin');
  for (const d of [join(home, '.agentskilldeck', 'venv', 'bin'), join(venv, 'bin'), bin]) mkdirSync(d, { recursive: true });
  for (const f of [join(home, '.agentskilldeck', 'venv', 'bin', 'python'), join(venv, 'bin', 'python'), join(bin, 'python3')]) writeFileSync(f, '', { mode: 0o755 });
  assert.equal(findPython({ env: { AGENTSKILLDECK_VENV: venv, PATH: bin }, home }), join(venv, 'bin', 'python'));
  assert.equal(findPython({ env: { PATH: bin }, home }), join(home, '.agentskilldeck', 'venv', 'bin', 'python'));
  assert.equal(findPython({ env: { PATH: bin }, home: join(tmp, 'nohome') }), join(bin, 'python3'));
  assert.equal(findPython({ env: { PATH: '' }, home: join(tmp, 'nohome') }), null);
});

function wavBytes(samples, rate = 44100) {
  const b = Buffer.alloc(44 + samples * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + samples * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(samples * 2, 40);
  return b;
}

test('wavDuration reads the data chunk of a PCM WAV', () => {
  const f = join(tmp, 'tone.wav');
  writeFileSync(f, wavBytes(22050));
  assert.equal(wavDuration(f), 0.5);
});

test('draftSynth on macOS uses say to LEI16@44100 WAV then ffmpeg to mono WAV, marked draft', async () => {
  const calls = [];
  const out = join(tmp, 'draft dir', 'd1.wav');
  let spoken;
  const run = async (cmd, args) => {
    calls.push([cmd, ...args]);
    if (cmd.endsWith('say')) spoken = readFileSync(args[args.indexOf('-f') + 1], 'utf8');
    if (cmd.endsWith('ffmpeg')) writeFileSync(args.at(-1), wavBytes(44100));
  };
  const res = await draftSynth({ id: 'd1', text: 'Oh <laugh> hi there.', speed: 1.2 }, out, { platform: 'darwin', run, which: (n) => `/bin/${n}` });
  assert.deepEqual(res, { id: 'd1', path: out, duration_s: 1, draft: true });
  assert.equal(calls[0][0], '/bin/say');
  assert.ok(calls[0].includes('--data-format=LEI16@44100'));
  assert.match(calls[0][calls[0].indexOf('-o') + 1], /\.wav$/, 'LEI16 is rejected for AIFF by say');
  assert.equal(spoken, 'Oh hi there.', 'tags are not spoken by the draft voice');
  assert.ok(!calls[0].includes('Oh hi there.'), 'text goes through a file (-f), never as an argument');
  assert.equal(calls[0][calls[0].indexOf('-r') + 1], '210');
  assert.equal(calls[1][0], '/bin/ffmpeg');
  assert.ok(calls[1].join(' ').includes('-ac 1 -ar 44100 -c:a pcm_s16le'));
});

test('draftSynth on Linux uses espeak-ng -w', async () => {
  const calls = [];
  const out = join(tmp, 'd2.wav');
  const run = async (cmd, args) => {
    calls.push([cmd, ...args]);
    if (cmd.endsWith('ffmpeg')) writeFileSync(args.at(-1), wavBytes(44100 * 2));
  };
  const res = await draftSynth({ id: 'd2', text: '-v Hi.' }, out, { platform: 'linux', run, which: (n) => (n === 'say' ? null : `/usr/bin/${n}`) });
  assert.equal(res.draft, true);
  assert.equal(res.duration_s, 2);
  assert.equal(calls[0][0], '/usr/bin/espeak-ng');
  assert.ok(calls[0].includes('-w'));
  assert.ok(calls[0].includes('-f') && !calls[0].includes('-v Hi.'), 'a leading "-" in the text is never parsed as an option');
});

test('draftSynth without a system voice or ffmpeg throws SetupError', async () => {
  await assert.rejects(draftSynth({ id: 'x', text: 'Hi.' }, join(tmp, 'x.wav'), { platform: 'linux', which: () => null, run: async () => {} }), SetupError);
  await assert.rejects(draftSynth({ id: 'x', text: 'Hi.' }, join(tmp, 'x.wav'), { platform: 'darwin', which: (n) => (n === 'say' ? '/usr/bin/say' : null), run: async () => {} }), SetupError);
});

test('startWorker keeps one process for several jobs and ends it at close()', async () => {
  const fakeClone = fileURLToPath(new URL('./fixtures/fake-clone.mjs', import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), 'aa session '));
  try {
    const log = join(dir, 'log');
    const w = startWorker({ python: process.execPath, script: fakeClone, env: { ...process.env, FAKE_CLONE_LOG: log } });
    assert.equal(w.started, false, 'nothing starts before the first job');
    const a = await w.run({ mode: 'warm' });
    assert.deepEqual(a, [{ id: 'warm', device: 'cpu' }]);
    const b = await w.run({ mode: 'warm' });
    assert.equal(b.length, 1);
    await w.close();
    assert.deepEqual(readFileSync(log, 'utf8').trim().split('\n'), ['start', 'warm 0', 'warm 0']);
    await assert.rejects(w.run({ mode: 'warm' }), /no longer running/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
