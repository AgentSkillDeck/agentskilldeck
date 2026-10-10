// Voice forms (preset / record / clone:<name>), the clone voice store, consent
// statements, pitch measurement and the base-voice pick.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseVoice, voicesDir, VOICE_F0, nearestVoice, medianF0, parseConsent, writeCloneVoice, readCloneVoice,
  loadCloneVoice, readPcm16, writePcm16, projectConsent, addProjectConsent, CloneVoiceError,
} from '../lib/voices.mjs';

const tmp = mkdtempSync(join(tmpdir(), 'aa voices '));
after(() => rmSync(tmp, { recursive: true, force: true }));

test('parseVoice: presets, record, clone:<name> with an optional @base', () => {
  assert.deepEqual(parseVoice('F2'), { kind: 'preset', voice: 'F2' });
  assert.deepEqual(parseVoice(' m3 '), { kind: 'preset', voice: 'M3' });
  assert.deepEqual(parseVoice(undefined), { kind: 'preset', voice: 'M1' });
  assert.deepEqual(parseVoice('record'), { kind: 'record' });
  assert.deepEqual(parseVoice('Record'), { kind: 'record' });
  assert.deepEqual(parseVoice('clone:me'), { kind: 'clone', name: 'me', base: null });
  assert.deepEqual(parseVoice('clone:Grandma-2'), { kind: 'clone', name: 'grandma-2', base: null });
  assert.deepEqual(parseVoice('clone:me@f4'), { kind: 'clone', name: 'me', base: 'F4' });
  for (const bad of ['X9', 'F6', 'clone:', 'clone:../etc', 'clone:a b', 'clone:me@Z1', './style.json', 'clone:-x']) {
    assert.equal(parseVoice(bad).kind, 'invalid', bad);
    assert.ok(parseVoice(bad).reason, bad);
  }
});

test('voicesDir honours AGENTATELIER_VOICES, else ~/.agentatelier/voices', () => {
  assert.equal(voicesDir({ env: { AGENTATELIER_VOICES: '/x/v' }, home: '/h' }), '/x/v');
  assert.equal(voicesDir({ env: {}, home: '/h' }), join('/h', '.agentatelier', 'voices'));
});

test('consent statements: own voice, or a named speaker; anything else is refused', () => {
  assert.deepEqual(parseConsent('This is my own voice'), { kind: 'own', statement: 'This is my own voice' });
  assert.equal(parseConsent('  this is my own voice.  ').kind, 'own');
  assert.deepEqual(parseConsent("I have the speaker's consent: Ana Ruiz"), { kind: 'speaker', speaker: 'Ana Ruiz', statement: "I have the speaker's consent: Ana Ruiz" });
  assert.equal(parseConsent('I have the speaker’s consent: Bo.').speaker, 'Bo');
  for (const bad of ['', 'yes', 'I agree', "I have the speaker's consent:", 'This is my voice', undefined]) assert.equal(parseConsent(bad), null, String(bad));
});

test('nearestVoice picks the preset closest in pitch (log distance)', () => {
  assert.equal(nearestVoice(207), 'F2');
  assert.equal(nearestVoice(215), 'F2');
  assert.equal(nearestVoice(160), 'F5');
  assert.equal(nearestVoice(122), 'M4');
  assert.equal(nearestVoice(95), 'M3');
  assert.equal(nearestVoice(70), 'M2');
  assert.equal(nearestVoice(null), null);
  assert.deepEqual(Object.keys(VOICE_F0), ['F1', 'F2', 'F3', 'F4', 'F5', 'M1', 'M2', 'M3', 'M4', 'M5']);
});

// A voiced harmonic tone at f0 with silent gaps, like speech with pauses.
function voiced(f0, sr = 44100, seconds = 3) {
  const n = Math.round(sr * seconds);
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    if (Math.floor(t * 2) % 3 === 2) continue; // every third half-second is silent
    let v = 0;
    for (let h = 1; h <= 6; h++) v += Math.sin(2 * Math.PI * f0 * h * t + h) / h;
    s[i] = 0.3 * v;
  }
  return s;
}

test('medianF0 measures the pitch of voiced frames and ignores silence', () => {
  for (const f0 of [95, 140, 207]) {
    const got = medianF0(voiced(f0), 44100);
    assert.ok(Math.abs(got - f0) < 3, `${f0} → ${got}`);
  }
  assert.equal(medianF0(new Float32Array(44100), 44100), null, 'silence has no pitch');
});

test('readPcm16/writePcm16 round-trip a mono WAV', () => {
  const p = join(tmp, 'tone.wav');
  const s = voiced(150, 16000, 1);
  writePcm16(p, s, 16000);
  const r = readPcm16(p);
  assert.equal(r.sampleRate, 16000);
  assert.equal(r.samples.length, s.length);
  assert.ok(Math.abs(r.samples[100] - s[100]) < 1e-3);
});

test('clone voice store: write, read, load; missing voice or consent is a clear exit-1 error', () => {
  const env = { AGENTATELIER_VOICES: join(tmp, 'store') };
  const ref = join(tmp, 'ref.wav');
  writePcm16(ref, voiced(200, 44100, 2), 44100);
  assert.equal(readCloneVoice('me', { env }), null);
  assert.throws(() => loadCloneVoice('me', { env }), (e) => e instanceof CloneVoiceError && e.exitCode === 1 && /record\.mjs --reference --name me/.test(e.message));
  const v = writeCloneVoice('me', { reference: ref, f0_median_hz: 204.5, duration_s: 2, source: 'file', consent: parseConsent('This is my own voice') }, { env });
  assert.equal(v.base, 'F2');
  const dir = join(env.AGENTATELIER_VOICES, 'me');
  assert.ok(existsSync(join(dir, 'reference.wav')));
  const meta = JSON.parse(readFileSync(join(dir, 'voice.json'), 'utf8'));
  assert.equal(meta.name, 'me');
  assert.equal(meta.base, 'F2');
  assert.equal(meta.reference, 'reference.wav');
  assert.equal(JSON.parse(readFileSync(join(dir, 'consent.json'), 'utf8')).kind, 'own');
  const loaded = loadCloneVoice('me', { env });
  assert.equal(loaded.base, 'F2');
  assert.equal(loaded.ref_path, join(dir, 'reference.wav'));
  assert.match(loaded.ref_sha, /^[0-9a-f]{64}$/);
  // An explicit base wins over the measured one.
  assert.equal(loadCloneVoice('me', { env, base: 'M4' }).base, 'M4');
  rmSync(join(dir, 'consent.json'));
  assert.throws(() => loadCloneVoice('me', { env }), /no consent/);
  writeFileSync(join(dir, 'consent.json'), JSON.stringify({ kind: 'own', statement: 'This is my own voice' }));
  assert.equal(loadCloneVoice('me', { env }).name, 'me');
});

test('project consent is per speaker in <out>/recordings/consent.json', () => {
  const out = join(tmp, 'proj');
  assert.equal(projectConsent(out, 'ME'), null);
  addProjectConsent(out, 'ME', parseConsent('This is my own voice'));
  addProjectConsent(out, 'GRAN', parseConsent("I have the speaker's consent: Rosa"));
  assert.equal(projectConsent(out, 'ME').kind, 'own');
  assert.equal(projectConsent(out, 'GRAN').speaker, 'Rosa');
  assert.equal(projectConsent(out, 'BOB'), null);
  const file = JSON.parse(readFileSync(join(out, 'recordings', 'consent.json'), 'utf8'));
  assert.ok(file.speakers.ME.at);
});
