import './fixtures/native-env.mjs';
// Per-voice native-tag table (lib/native.mjs), its use by the planner and the
// engine guard, and calibrate.mjs with the fake engine.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nativeVerdict, nativeOk, baseVoice, loadNativeTable, NATIVE_TABLE_PATH, CANDIDATE_TAGS } from '../lib/native.mjs';
import { assertEngineText } from '../lib/engine.mjs';
import { planRender } from '../lib/plan.mjs';
import { parseScript } from '../lib/script.mjs';
import { main as calibrateMain, mergeTable, DEFAULT_TAGS } from '../calibrate.mjs';

const FAKE = fileURLToPath(new URL('./fixtures/fake-engine.mjs', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'aa native '));
after(() => rmSync(work, { recursive: true, force: true }));

// Measured rows plus the owner's listening overrides (voice first, then "*").
const TABLE = {
  M3: { laugh: { pass: 8, total: 8, ok: true }, cough: { pass: 8, total: 8, ok: true }, breath: { pass: 8, total: 8, ok: true }, groan: { pass: 6, total: 8, ok: false }, sigh: { pass: 8, total: 8, ok: true } },
  F4: { laugh: { pass: 7, total: 8, ok: false }, cough: { pass: 8, total: 8, ok: true }, breath: { pass: 8, total: 8, ok: true }, groan: { pass: 8, total: 8, ok: true } },
  owner_overrides: { '*': { sigh: false }, M3: { cough: false, groan: true }, F4: { laugh: true, breath: false, groan: false } },
};

test('nativeVerdict: the owner override for the voice wins, then the "*" override, then calibration; no row is a sample', () => {
  assert.deepEqual(nativeVerdict('M3', 'cough', TABLE), { ok: false, source: 'owner', pass: 8, total: 8 }, 'owner: M3 cough is spoken');
  assert.equal(nativeVerdict('F4', 'cough', TABLE).ok, true, 'calibration: F4 cough works');
  assert.equal(nativeVerdict('M3', 'breath', TABLE).ok, true);
  assert.equal(nativeVerdict('F4', 'breath', TABLE).ok, false, 'owner: F4 breath is spoken');
  assert.equal(nativeVerdict('F4', 'laugh', TABLE).ok, true, 'owner-confirmed laugh beats a failed calibration take');
  assert.equal(nativeVerdict('M3', 'groan', TABLE).ok, true);
  assert.equal(nativeVerdict('F4', 'groan', TABLE).ok, false);
  assert.equal(nativeVerdict('M3', 'sigh', TABLE).source, 'owner', 'sigh is off for every voice even when calibration passed');
  assert.equal(nativeVerdict('M3', 'sigh', TABLE).ok, false);
  assert.deepEqual(nativeVerdict('F1', 'laugh', TABLE), { ok: false, source: 'none' });
  assert.equal(nativeOk('F4', 'gasp', TABLE), false, 'not a candidate tag');
});

test('clone voices use their base voice row (voice.json in the voice store, or @base); no voice is the engine default M1', () => {
  const store = join(work, 'voices');
  const env = { AGENTATELIER_VOICES: store };
  for (const [name, base] of [['rex', 'M3'], ['ana', 'F4']]) {
    mkdirSync(join(store, name), { recursive: true });
    writeFileSync(join(store, name, 'voice.json'), JSON.stringify({ version: 1, name, base, reference: 'reference.wav' }));
  }
  assert.equal(baseVoice('clone:rex', { env }), 'M3');
  assert.equal(baseVoice('clone:rex@f4', { env }), 'F4', 'an explicit @base wins');
  assert.equal(baseVoice('clone:someone', { env }), null);
  assert.equal(baseVoice('record', { env }), null, 'a recorded voice has no engine row');
  assert.equal(baseVoice(undefined), 'M1');
  assert.equal(nativeOk('clone:rex', 'cough', TABLE, { env }), false);
  assert.equal(nativeOk('clone:ana', 'cough', TABLE, { env }), true);
  assert.equal(nativeOk('clone:someone', 'laugh', TABLE, { env }), false, 'an unknown base has no row: sample');
  const prev = process.env.AGENTATELIER_VOICES;
  process.env.AGENTATELIER_VOICES = store;
  try { assert.equal(nativeVerdict('clone:ana', 'cough', TABLE).ok, true, 'process env is the default'); } finally {
    if (prev === undefined) delete process.env.AGENTATELIER_VOICES; else process.env.AGENTATELIER_VOICES = prev;
  }
});

test('the bundled table: laugh is the only native tag for every voice (placement test), owner overrides kept', () => {
  const t = JSON.parse(readFileSync(NATIVE_TABLE_PATH, 'utf8'));
  const o = t.owner_overrides;
  for (const tag of ['cough', 'yawn', 'hmm', 'breath', 'sigh', 'groan']) assert.equal(o['*'][tag], false, `* ${tag}`);
  assert.equal(o.M3.laugh, true);
  assert.equal(o.F4.laugh, true);
  for (const v of ['F1', 'F2', 'F3', 'F4', 'F5', 'M1', 'M2', 'M3', 'M4', 'M5']) {
    for (const tag of ['cough', 'yawn', 'hmm', 'breath', 'sigh', 'groan']) {
      assert.equal(nativeOk(v, tag, t), false, `${v} ${tag}`);
      assert.match(t[v][tag].note, /placement test 2026-10-11/);
    }
  }
  for (const v of ['M3', 'F4']) assert.equal(nativeOk(v, 'laugh', t), true);
});

test('the planner sends a tag native only where the speaker\'s voice row allows it, else splices the sample', () => {
  const doc = `---\ncast:\n  ELI: { voice: M3 }\n  ANA: { voice: F4 }\n---\nELI: <cough> Sorry. <breath> Go. <groan> Ugh. <laugh> Ha.\nANA: <cough> Sorry. <breath> Go. <groan> Ugh. <laugh> Ha.\n`;
  const items = planRender(parseScript(doc), { nativeTable: TABLE }).items;
  const line = (sp) => items.filter((i) => i.speaker === sp).map((i) => [i.kind, i.tag ?? i.text]);
  assert.deepEqual(line('ELI'), [['nv', 'cough'], ['speech', 'Sorry. <breath><breath><breath> Go. <groan><groan><groan> Ugh. <laugh><laugh><laugh> Ha.']]);
  assert.deepEqual(line('ANA'), [['speech', '<cough><cough><cough> Sorry.'], ['nv', 'breath'], ['speech', 'Go.'], ['nv', 'sigh'], ['speech', 'Ugh. <laugh><laugh><laugh> Ha.']]);
  const eli = items.find((i) => i.speaker === 'ELI' && i.kind === 'speech');
  assert.deepEqual(eli.native_at, [1, 2, 3], 'the plan carries the tag positions for QA');
  // sample mode and the fallback (spliceLines) ignore the table.
  const sample = planRender(parseScript(doc.replace('---\nELI', 'nonverbals: sample\n---\nELI')), { nativeTable: TABLE }).items;
  assert.ok(sample.filter((i) => i.kind === 'speech').every((i) => !/</.test(i.text) && !i.native_at));
});

test('the engine guard refuses a tag the voice row does not allow, unless calibrating', () => {
  assert.doesNotThrow(() => assertEngineText('<cough><cough><cough> Sorry.', { voice: 'F4', table: TABLE }));
  assert.throws(() => assertEngineText('<cough><cough><cough> Sorry.', { voice: 'M3', table: TABLE }), /not native for voice M3/);
  assert.throws(() => assertEngineText('<sigh><sigh><sigh> Long day.', { voice: 'M3', table: TABLE }), /not native/);
  assert.doesNotThrow(() => assertEngineText('<sigh><sigh><sigh> Long day.', { voice: 'M3', table: TABLE, calibrate: true }));
  assert.throws(() => assertEngineText('<gasp> Oh.', { voice: 'M3', table: TABLE, calibrate: true }), /engine text/, 'calibration still only sends candidate tags');
  assert.ok(CANDIDATE_TAGS.includes('groan') && CANDIDATE_TAGS.includes('breath'));
});

test('mergeTable keeps the owner overrides and rows it did not measure', () => {
  const merged = mergeTable(TABLE, { F4: { laugh: { pass: 8, total: 8, ok: true } }, M1: { hmm: { pass: 8, total: 8, ok: true } } }, { seeds: 4 });
  assert.deepEqual(merged.owner_overrides, TABLE.owner_overrides);
  assert.equal(merged.F4.laugh.pass, 8);
  assert.equal(merged.F4.cough.ok, true, 'an unmeasured tag keeps its row');
  assert.equal(merged.M1.hmm.ok, true);
  assert.equal(merged._meta.status, 'calibrated');
  assert.deepEqual(Object.keys(merged), ['_meta', 'F4', 'M1', 'M3', 'owner_overrides']);
});

test('calibrate.mjs measures every tag stacked in two positions x seeds, writes the table and keeps overrides', async () => {
  const out = join(work, 'native-tags.json');
  writeFileSync(out, JSON.stringify({ owner_overrides: { M3: { laugh: false } } }));
  let stdout = '';
  let stderr = '';
  const code = await calibrateMain(['--voices', 'M3,F4', '--tags', 'laugh,cough', '--seeds', '2', '--out', out, '--cache', join(work, 'cache')], {
    engine: { python: process.execPath, script: FAKE },
    env: { ...process.env, FAKE_ENGINE_SPEAK_COUGH: '1' },
    stdout: (s) => { stdout += s; }, stderr: (s) => { stderr += s; },
  });
  assert.equal(code, 0, stderr);
  const t = JSON.parse(readFileSync(out, 'utf8'));
  assert.deepEqual(t.F4.laugh, { pass: 4, total: 4, ok: true });
  assert.equal(t.F4.cough.pass, 0);
  assert.equal(t.F4.cough.ok, false);
  assert.match(t.F4.cough.failed[0], /Cough/);
  assert.deepEqual(t.owner_overrides, { M3: { laugh: false } });
  assert.equal(t._meta.seeds, 2);
  assert.match(stdout, /\| M3 \| 4\/4 sample \(owner\) \| 0\/4 sample \|/);
  assert.match(stdout, /\| F4 \| 4\/4 native \| 0\/4 sample \|/);
  assert.equal(loadNativeTable({ path: out }).F4.laugh.ok, true);
});

test('calibrate.mjs: usage errors exit 1', async () => {
  for (const args of [['--voices', 'Z9'], ['--tags', 'gasp'], ['--seeds', '0']]) {
    let err = '';
    assert.equal(await calibrateMain(args, { stderr: (s) => { err += s; }, stdout: () => {} }), 1, args.join(' '));
    assert.match(err, /Usage/);
  }
});

test('stacks are joined (placement test: joined 58% clean vs spaced 47%); the guard accepts joined tags but not tags glued to words', () => {
  assert.doesNotThrow(() => assertEngineText('<laugh><laugh><laugh> Fine.', { voice: 'M3', table: TABLE }));
  assert.doesNotThrow(() => assertEngineText('Fine. <laugh><laugh><laugh><laugh>', { voice: 'M3', table: TABLE }));
  assert.throws(() => assertEngineText('<laugh><laugh><laugh><laugh><laugh> Fine.', { voice: 'M3', table: TABLE }), /stack more than 4/);
  assert.throws(() => assertEngineText('Fine<laugh><laugh>', { voice: 'M3', table: TABLE }), /glued/);
  assert.throws(() => assertEngineText('<laugh><laugh>Fine.', { voice: 'M3', table: TABLE }), /glued/);
  assert.deepEqual(DEFAULT_TAGS, ['laugh'], 'calibration measures the laugh only by default');
});
