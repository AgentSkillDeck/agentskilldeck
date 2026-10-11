import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main, checkSetup, checkCloneSetup, CLONE_REQUIREMENTS } from '../setup.mjs';

const toolsDir = fileURLToPath(new URL('..', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'aa setup '));
after(() => rmSync(tmp, { recursive: true, force: true }));

function fakeHome({ venv = true, model = true } = {}) {
  const home = mkdtempSync(join(tmp, 'home-'));
  if (venv) { mkdirSync(join(home, '.agentskilldeck', 'venv', 'bin'), { recursive: true }); writeFileSync(join(home, '.agentskilldeck', 'venv', 'bin', 'python'), '', { mode: 0o755 }); }
  if (model) { mkdirSync(join(home, '.cache', 'supertonic3', 'onnx'), { recursive: true }); for (const f of ['duration_predictor', 'text_encoder', 'vector_estimator', 'vocoder']) writeFileSync(join(home, '.cache', 'supertonic3', 'onnx', `${f}.onnx`), 'x'); }
  return home;
}
const which = (n) => `/opt/bin/${n}`;
const probe = async () => ({ supertonic: '1.3.1', whisper: '1.2.1' });

test('checkSetup reports every field and ok when all present', async () => {
  const home = fakeHome();
  const r = await checkSetup({ env: { PATH: '' }, home, which, probe });
  assert.deepEqual(Object.keys(r), ['python', 'venv', 'supertonic', 'whisper', 'model_cached', 'ffmpeg', 'ffprobe', 'ok']);
  assert.equal(r.python, join(home, '.agentskilldeck', 'venv', 'bin', 'python'));
  assert.equal(r.venv, join(home, '.agentskilldeck', 'venv'));
  assert.equal(r.supertonic, '1.3.1');
  assert.equal(r.whisper, '1.2.1');
  assert.equal(r.model_cached, true);
  assert.equal(r.ffmpeg, '/opt/bin/ffmpeg');
  assert.equal(r.ok, true);
});

test('checkSetup is not ok when the model is not cached, ffprobe is missing, or the package is absent', async () => {
  assert.equal((await checkSetup({ env: {}, home: fakeHome({ model: false }), which, probe })).ok, false);
  assert.equal((await checkSetup({ env: {}, home: fakeHome(), which: (n) => (n === 'ffprobe' ? null : which(n)), probe })).ok, false);
  const r = await checkSetup({ env: {}, home: fakeHome(), which, probe: async () => ({ supertonic: null, whisper: '1.2.1' }) });
  assert.equal(r.supertonic, null);
  assert.equal(r.ok, false);
});

test('checkSetup without any python reports nulls', async () => {
  const r = await checkSetup({ env: { PATH: '' }, home: fakeHome({ venv: false }), which: () => null, probe });
  assert.equal(r.python, null);
  assert.equal(r.venv, null);
  assert.equal(r.supertonic, null);
  assert.equal(r.ok, false);
});

test('main --check prints JSON and exits 0 when ok, 2 when not', async () => {
  let out = '';
  const code = await main(['--check'], { env: {}, home: fakeHome(), which, probe, stdout: (s) => { out += s; } });
  assert.equal(code, 0);
  assert.equal(JSON.parse(out).ok, true);
  out = '';
  assert.equal(await main(['--check'], { env: {}, home: fakeHome({ venv: false }), which: () => null, probe, stdout: (s) => { out += s; } }), 2);
  assert.equal(JSON.parse(out).ok, false);
});

test('main without a mode is a usage error (exit 1)', async () => {
  let err = '';
  assert.equal(await main([], { stderr: (s) => { err += s; } }), 1);
  assert.match(err, /Usage/);
  assert.equal(await main(['--bogus'], { stderr: () => {} }), 1);
});

test('main --install runs venv, pip, warm-up in order, prints steps and records install_ok', async () => {
  const home = fakeHome({ venv: false, model: false });
  const calls = [];
  let out = '';
  const run = async (cmd, args) => {
    calls.push([cmd, ...args]);
    if (args[0] === '-m' && args[1] === 'venv') { mkdirSync(join(args[2], 'bin'), { recursive: true }); writeFileSync(join(args[2], 'bin', 'python'), '', { mode: 0o755 }); }
  };
  const warm = async (python) => {
    calls.push(['warm', python]);
    const onnx = join(home, '.cache', 'supertonic3', 'onnx'); // the real warm-up downloads the model
    mkdirSync(onnx, { recursive: true });
    for (const f of ['duration_predictor', 'text_encoder', 'vector_estimator', 'vocoder']) writeFileSync(join(onnx, `${f}.onnx`), 'x');
  };
  const code = await main(['--install'], { env: {}, home, which, probe, run, warm, stdout: (s) => { out += s; }, stderr: () => {} });
  assert.equal(code, 0, out);
  const venv = join(home, '.agentskilldeck', 'venv');
  assert.deepEqual(calls[0], ['/opt/bin/python3', '-m', 'venv', venv]);
  assert.equal(calls[1][0], join(venv, 'bin', 'python'));
  assert.deepEqual(calls[1].slice(1, 4), ['-m', 'pip', 'install']);
  assert.ok(calls.some((c) => c.includes('-r') && c.at(-1).endsWith(join('engine', 'requirements.txt'))));
  assert.deepEqual(calls.at(-1), ['warm', join(venv, 'bin', 'python')]);
  assert.match(out, /\[1\/4\]/);
  assert.match(out, /\[4\/4\]/);
  assert.deepEqual(JSON.parse(readFileSync(join(home, '.agentskilldeck', 'config.json'), 'utf8')), { install_ok: true });
});

test('main --install exits 2 with the failing step when pip fails', async () => {
  const home = fakeHome({ venv: false });
  let err = '';
  const run = async (cmd, args) => {
    if (args[0] === '-m' && args[1] === 'venv') { mkdirSync(join(args[2], 'bin'), { recursive: true }); writeFileSync(join(args[2], 'bin', 'python'), '', { mode: 0o755 }); return; }
    if (args.includes('pip')) throw new Error('pip exited with code 1');
  };
  const code = await main(['--install'], { env: {}, home, which, probe, run, warm: async () => {}, stdout: () => {}, stderr: (s) => { err += s; } });
  assert.equal(code, 2);
  assert.match(err, /pip/);
});

function cloneHome({ venv = true, model = true } = {}) {
  const home = fakeHome();
  if (venv) { mkdirSync(join(home, '.agentskilldeck', 'venv-clone', 'bin'), { recursive: true }); writeFileSync(join(home, '.agentskilldeck', 'venv-clone', 'bin', 'python'), '', { mode: 0o755 }); }
  if (model) { const snap = join(home, '.cache', 'huggingface', 'hub', 'models--ResembleAI--chatterbox', 'snapshots', 'abc'); mkdirSync(snap, { recursive: true }); writeFileSync(join(snap, 's3gen.safetensors'), 'x'); }
  return home;
}
const cloneProbe = async () => ({ chatterbox: '0.1.7', torch: '2.9.0' });

test('checkCloneSetup reports the optional clone venv, its packages and the cached weights', async () => {
  const home = cloneHome();
  const r = await checkCloneSetup({ env: {}, home, probe: cloneProbe });
  assert.deepEqual(r, { optional: true, venv: join(home, '.agentskilldeck', 'venv-clone'), python: join(home, '.agentskilldeck', 'venv-clone', 'bin', 'python'), chatterbox: '0.1.7', torch: '2.9.0', model_cached: true, ok: true });
  const none = await checkCloneSetup({ env: {}, home: fakeHome(), probe: cloneProbe });
  assert.equal(none.venv, null);
  assert.equal(none.python, null);
  assert.equal(none.chatterbox, null);
  assert.equal(none.ok, false);
  const other = await checkCloneSetup({ env: { AGENTSKILLDECK_CLONE_VENV: join(home, 'elsewhere') }, home, probe: cloneProbe });
  assert.equal(other.venv, null, 'AGENTSKILLDECK_CLONE_VENV moves the venv');
  const noWeights = await checkCloneSetup({ env: {}, home: cloneHome({ model: false }), probe: cloneProbe });
  assert.equal(noWeights.model_cached, false);
  assert.equal(noWeights.ok, true, 'the weights download on first use');
});

test('main --check reports the clone engine but its absence does not fail the check', async () => {
  let out = '';
  const code = await main(['--check'], { env: {}, home: fakeHome(), which, probe, cloneProbe, stdout: (s) => { out += s; } });
  assert.equal(code, 0);
  const j = JSON.parse(out);
  assert.equal(j.ok, true);
  assert.equal(j.clone.ok, false);
  assert.equal(j.clone.optional, true);
});

test('main --install-clone creates the clone venv, installs requirements-clone.txt, warms the converter and records it', async () => {
  const home = fakeHome();
  const calls = [];
  let out = '';
  const run = async (cmd, args) => {
    calls.push([cmd, ...args]);
    if (args[0] === '-m' && args[1] === 'venv') { mkdirSync(join(args[2], 'bin'), { recursive: true }); writeFileSync(join(args[2], 'bin', 'python'), '', { mode: 0o755 }); }
  };
  const warmClone = async (python) => { calls.push(['warm-clone', python]); };
  const code = await main(['--install-clone'], { env: {}, home, which, probe, cloneProbe, run, warmClone, stdout: (s) => { out += s; }, stderr: () => {} });
  assert.equal(code, 0, out);
  const venv = join(home, '.agentskilldeck', 'venv-clone');
  assert.deepEqual(calls[0], ['/opt/bin/python3', '-m', 'venv', venv]);
  assert.deepEqual(calls[1].slice(0, 4), [join(venv, 'bin', 'python'), '-m', 'pip', 'install']);
  assert.equal(calls[1].at(-1), CLONE_REQUIREMENTS);
  assert.deepEqual(readFileSync(CLONE_REQUIREMENTS, 'utf8').trim().split('\n'), ['chatterbox-tts==0.1.7', 'setuptools<81']);
  assert.deepEqual(calls.at(-1), ['warm-clone', join(venv, 'bin', 'python')]);
  assert.match(out, /\[1\/4\]/);
  assert.match(out, /PerTh/);
  assert.equal(JSON.parse(readFileSync(join(home, '.agentskilldeck', 'config.json'), 'utf8')).clone_install_ok, true);
  let err = '';
  const failing = async (cmd, args) => { if (args.includes('pip')) throw new Error('pip exited with code 1'); return run(cmd, args); };
  assert.equal(await main(['--install-clone'], { env: {}, home: fakeHome(), which, probe, cloneProbe, run: failing, warmClone, stdout: () => {}, stderr: (s) => { err += s; } }), 2);
  assert.match(err, /pip/);
});

// Spawn through the real and a symlinked tools dir (skill installs expose tools via symlinks).
const linkRoot = mkdtempSync(join(tmp, 'link '));
const linkedTools = join(linkRoot, 'tools');
symlinkSync(toolsDir, linkedTools, 'dir');

for (const [label, dir] of [['real path', toolsDir], ['symlinked dir', linkedTools]]) {
  test(`setup.mjs --check runs as a CLI via ${label}`, () => {
    const home = fakeHome({ venv: false, model: false });
    const r = spawnSync(process.execPath, [join(dir, 'setup.mjs'), '--check'], {
      encoding: 'utf8', timeout: 20_000,
      env: { HOME: home, PATH: '', AGENTSKILLDECK_VENV: join(home, 'none'), PYTHONDONTWRITEBYTECODE: '1' },
    });
    assert.equal(r.status, 2, r.stderr);
    const j = JSON.parse(r.stdout);
    assert.equal(j.ok, false);
    assert.equal(j.python, null);
  });
}
