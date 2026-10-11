import './fixtures/native-env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planRender, PlanError, NATIVE_STACK } from '../lib/plan.mjs';
import { parseScript } from '../lib/script.mjs';
import { assertEngineText } from '../lib/engine.mjs';

function parsed(doc) {
  return parseScript(doc, {});
}

test('speed multiplication: domain x cast x delivery x modifier', () => {
  // education: speed 1.0. ELI cast speed 1.05. "excited" delivery speed 1.24 (T10 tuning). "fast" modifier x1.1.
  const doc = `---\npreset: education\ncast:\n  ELI: { voice: M3, speed: 1.05 }\n---\nELI (excited, fast): Let's go!\n`;
  const plan = planRender(parsed(doc));
  const item = plan.items.find((i) => i.kind === 'speech');
  const expected = 1.0 * 1.05 * 1.24 * 1.1;
  assert.ok(Math.abs(item.speed - expected) < 1e-9);
});

test('speed is clamped to 0.7..2.0', () => {
  const doc = `---\npreset: meditation\ncast:\n  ELI: { voice: M3, speed: 3 }\n---\nELI (excited, fast): Fast!\n`;
  const plan = planRender(parsed(doc));
  const item = plan.items.find((i) => i.kind === 'speech');
  assert.equal(item.speed, 2.0);

  const doc2 = `---\npreset: meditation\ncast:\n  ELI: { voice: M3, speed: 0.1 }\n---\nELI (tired, slow): Slow...\n`;
  const plan2 = planRender(parsed(doc2));
  const item2 = plan2.items.find((i) => i.kind === 'speech');
  assert.equal(item2.speed, 0.7);
});

test('an unknown emotion throws a PlanError naming the 14 valid emotions', () => {
  const doc = `NARRATOR: Hi.\nNARRATOR (zonked): What?\n`;
  assert.throws(() => planRender(parsed(doc)), (e) => {
    assert.ok(e instanceof PlanError);
    for (const name of ['neutral', 'happy', 'excited', 'sad', 'angry', 'scared', 'hushed', 'calm', 'surprised', 'sarcastic', 'tender', 'tired', 'authoritative', 'nervous']) {
      assert.match(e.message, new RegExp(name));
    }
    return true;
  });
});

test('nv splitting yields speech, nv, speech items with the same speaker (default mode: sample)', () => {
  const doc = `---\ncast:\n  ELI: { voice: M3 }\n---\nELI (scared): <breath> Did you hear that?\n`;
  const plan = planRender(parsed(doc));
  assert.deepEqual(plan.items.map((i) => i.kind), ['nv', 'speech']);
  assert.equal(plan.items[0].tag, 'breath');
  assert.equal(plan.items[0].speaker, 'ELI');
  assert.equal(plan.items[1].speaker, 'ELI');
  assert.equal(plan.items[1].text, 'Did you hear that?');
});

test('nv splitting with text on both sides yields speech, nv, speech', () => {
  const doc = `---\ncast:\n  ELI: { voice: M3 }\n---\nELI: worked<breath>really hard.\n`;
  const plan = planRender(parsed(doc));
  assert.deepEqual(plan.items.map((i) => i.kind), ['speech', 'nv', 'speech']);
  assert.equal(plan.items[0].speaker, 'ELI');
  assert.equal(plan.items[2].speaker, 'ELI');
});

test('the audiobook preset adds room tone items at head and tail', () => {
  const doc = `NARRATOR: Once upon a time.\n`;
  const plan = planRender(parsed(doc), { preset: 'audiobook' });
  assert.equal(plan.items[0].kind, 'cue');
  assert.equal(plan.items[0].cue.value, 'room tone');
  assert.deepEqual(plan.items[0].cue.args.slice(0, 1), ['head']);
  const last = plan.items[plan.items.length - 1];
  assert.equal(last.kind, 'cue');
  assert.equal(last.cue.value, 'room tone');
  assert.deepEqual(last.cue.args.slice(0, 1), ['tail']);
});

test('nonverbals: "pause" turns nv items into 0.4s pauses', () => {
  const doc = `---\nnonverbals: pause\ncast:\n  ELI: { voice: M3 }\n---\nELI (scared): <breath> Did you hear that?\n`;
  const plan = planRender(parsed(doc));
  assert.deepEqual(plan.items.map((i) => i.kind), ['pause', 'speech']);
  assert.equal(plan.items[0].pre_s, 0.4);
});

test('nonverbals: "model" keeps <laugh> inline but still splices breath and sigh', () => {
  const doc = `---\nnonverbals: model\ncast:\n  MAYA: { voice: F2 }\n---\nMAYA: <laugh> It's fine. <breath> Wait. <sigh> Okay.\n`;
  const plan = planRender(parsed(doc));
  const kinds = plan.items.map((i) => i.kind);
  // laugh stays folded into a speech item's text; breath/sigh still splice as their own nv items.
  assert.equal(kinds.filter((k) => k === 'nv').length, 2);
  const laughCarrier = plan.items.find((i) => i.kind === 'speech' && i.text.includes('<laugh>'));
  assert.ok(laughCarrier, 'expected a speech item to carry the inline <laugh> tag');
  assert.deepEqual(plan.items.filter((i) => i.kind === 'nv').map((i) => i.tag), ['breath', 'sigh']);
});

test('ids are stable L<n>-<k>', () => {
  const doc = `---\ncast:\n  ELI: { voice: M3 }\n---\nELI (scared): <breath> Did you hear that?\n`;
  const plan = planRender(parsed(doc));
  assert.equal(plan.items[0].id, `L${plan.items[0].n}-0`);
  assert.equal(plan.items[1].id, `L${plan.items[1].n}-1`);
});

test('plan carries the resolved domain preset object under plan.preset', () => {
  const doc = `NARRATOR: Hi.\n`;
  const plan = planRender(parsed(doc), { preset: 'drama' });
  assert.equal(plan.preset.key, 'drama');
  assert.equal(plan.preset.gap_s, 0.25);
});

test('cue lines (non-pause) pass through as kind cue', () => {
  const doc = `[sfx: door creak]\nNARRATOR: Hi.\n`;
  const plan = planRender(parsed(doc));
  const sfx = plan.items.find((i) => i.kind === 'cue' && i.cue.type === 'sfx');
  assert.equal(sfx.cue.value, 'door creak');
});

test('speech items carry the annotated emotion name, or null when none was given', () => {
  const doc = `---\ncast:\n  ELI: { voice: M3 }\n---\nELI (scared): Careful.\nELI: Plain line.\n`;
  const plan = planRender(parsed(doc));
  const [scared, plain] = plan.items.filter((i) => i.kind === 'speech');
  assert.equal(scared.emotion, 'scared');
  assert.equal(plain.emotion, null);
});

test('nv items inherit the emotion of the line they were split from', () => {
  const doc = `---\ncast:\n  ELI: { voice: M3 }\n---\nELI (scared): <breath> Did you hear that?\n`;
  const plan = planRender(parsed(doc));
  const nv = plan.items.find((i) => i.kind === 'nv');
  assert.equal(nv.emotion, 'scared');
});

test('[pause N] cues become kind pause items', () => {
  const doc = `NARRATOR: Hi.\n[pause 1.5]\nNARRATOR: Bye.\n`;
  const plan = planRender(parsed(doc));
  const pause = plan.items.find((i) => i.kind === 'pause' && i.pre_s === 1.5);
  assert.ok(pause);
});

test('nonverbals: "auto" is the default: <laugh> and <cough> stay inline for the engine, <breath> and <sigh> are spliced', () => {
  const doc = `---\ncast:\n  MAYA: { voice: F2 }\n---\nMAYA: <laugh> It's fine. <breath> Wait. <cough> Okay. <sigh> Fine.\n`;
  const plan = planRender(parsed(doc));
  assert.deepEqual(plan.items.filter((i) => i.kind === 'nv').map((i) => i.tag), ['breath', 'sigh']);
  const texts = plan.items.filter((i) => i.kind === 'speech').map((i) => i.text);
  assert.deepEqual(texts, ["<laugh><laugh><laugh> It's fine.", 'Wait. <cough><cough><cough> Okay.', 'Fine.']);
  for (const t of texts) assert.doesNotThrow(() => assertEngineText(t));
});

test('nonverbals: "sample" splices every tag, and an unknown mode is a plan error', () => {
  const doc = `---\nnonverbals: sample\ncast:\n  MAYA: { voice: F2 }\n---\nMAYA: <laugh> It's fine. <sigh> Okay.\n`;
  assert.deepEqual(planRender(parsed(doc)).items.filter((i) => i.kind === 'nv').map((i) => i.tag), ['laugh', 'sigh']);
  assert.throws(() => planRender(parsed(`---\nnonverbals: loud\n---\nNARRATOR: Hi.\n`)), /nonverbals/);
});

test('auto: spliceLines re-plans only the listed lines with sample splices, other ids unchanged', () => {
  const doc = `---\ncast:\n  ELI: { voice: M3 }\n---\nELI (tired): <cough> Long day.\nELI: Ha. <laugh> Sure.\n`;
  const base = planRender(parsed(doc));
  const sighLine = base.items.find((i) => i.text?.includes('<cough>')).n;
  const re = planRender(parsed(doc), { spliceLines: new Set([sighLine]) });
  assert.deepEqual(re.items.filter((i) => i.n === sighLine).map((i) => [i.kind, i.tag ?? i.text]), [['nv', 'cough'], ['speech', 'Long day.']]);
  const other = (p) => p.items.filter((i) => i.n !== sighLine).map((i) => [i.id, i.text]);
  assert.deepEqual(other(re), other(base));
});

test('auto: <groan> and <sigh> are spliced as sigh samples (in model mode too); <yawn> stays a native stack', () => {
  const doc = (mode) => `---\n${mode ? `nonverbals: ${mode}\n` : ''}cast:\n  ELI: { voice: M3 }\n---\nELI: <groan> Fine. <sigh:3> Okay. (yawns) Late.\n`;
  const items = planRender(parsed(doc())).items;
  assert.deepEqual(items.map((i) => [i.kind, i.tag ?? i.text]), [['nv', 'sigh'], ['speech', 'Fine.'], ['nv', 'sigh'], ['speech', 'Okay. <yawn><yawn><yawn> Late.']]);
  const model = planRender(parsed(doc('model'))).items;
  assert.deepEqual(model.filter((i) => i.kind === 'nv').map((i) => i.tag), ['sigh', 'sigh', 'sigh']);
  for (const it of model.filter((i) => i.kind === 'speech')) assert.doesNotMatch(it.text, /sigh/);
});

test('auto: every native tag is stacked (one tag is silent): NATIVE_STACK sets the counts', () => {
  const doc = `---\ncast:\n  ELI: { voice: M3 }\n---\nELI: (chuckles) Fine. <laugh> Okay. <laugh:3> Wow. <cough> Sorry. <yawn> Late. <hmm> Maybe.\n`;
  const [t] = planRender(parsed(doc)).items.filter((i) => i.kind === 'speech').map((i) => i.text);
  const rep = (tag, n) => Array(n).fill(`<${tag}>`).join('');
  const L = NATIVE_STACK.laugh;
  assert.equal(t, `${rep('laugh', L[1])} Fine. ${rep('laugh', L[2])} Okay. ${rep('laugh', L[3])} Wow. ${rep('cough', NATIVE_STACK.cough)} Sorry. ${rep('yawn', NATIVE_STACK.yawn)} Late. ${rep('hmm', NATIVE_STACK.hmm)} Maybe.`);
  for (const v of [L[1], L[2], L[3], NATIVE_STACK.cough, NATIVE_STACK.yawn, NATIVE_STACK.hmm]) assert.ok(v >= 2, 'never a single tag');
  assertEngineText(t);
});

test('breath, groan and the spoken tags are always samples; in sample mode yawn is a sigh clip and hmm a pause', () => {
  const doc = (mode) => `---\n${mode ? `nonverbals: ${mode}\n` : ''}cast:\n  ELI: { voice: M3 }\n---\nELI: <breath> Go. <groan> Ugh. <clear-throat> So. <yawn> Late. <hmm> Maybe. <cough> Sorry.\n`;
  const auto = planRender(parsed(doc())).items.map((i) => [i.kind, i.tag ?? i.text]);
  assert.deepEqual(auto.filter((x) => x[0] === 'nv'), [['nv', 'breath'], ['nv', 'sigh'], ['nv', 'cough']]);
  const sample = planRender(parsed(doc('sample'))).items.map((i) => [i.kind, i.tag ?? i.text]);
  assert.deepEqual(sample, [['nv', 'breath'], ['speech', 'Go.'], ['nv', 'sigh'], ['speech', 'Ugh.'], ['nv', 'cough'], ['speech', 'So.'], ['nv', 'sigh'], ['speech', 'Late.'], ['pause', undefined], ['speech', 'Maybe.'], ['nv', 'cough'], ['speech', 'Sorry.']]);
});

test('voice: record plans each line as one recorded item: tags removed, no nonverbal splices, no engine text', () => {
  const doc = `---\npreset: drama\ncast:\n  ME: { voice: record }\n  ELI: { voice: M3 }\n---\nME (happy): (laughs) Well [sighs] okay <breath> then.\nELI: Fine.\n`;
  const plan = planRender(parsed(doc));
  const mine = plan.items.filter((i) => i.speaker === 'ME');
  assert.equal(mine.length, 1);
  const [it] = mine;
  assert.equal(it.kind, 'speech');
  assert.equal(it.recorded, true);
  assert.equal(it.voice, 'record');
  assert.equal(it.rec_id, 'L7');
  assert.equal(it.text, 'Well okay then.');
  assert.equal(it.prompt, '(laugh) Well (sigh) okay (breath) then.');
  assert.equal(it.gain_db, -6, 'recordings (-20 LUFS) sit level with the synthetic voices (-26 LUFS)');
  assert.equal(it.af, undefined, 'no delivery filter on a real performance');
  assert.ok(it.pre_s >= 0 && it.post_s >= 0);
  assert.ok(plan.items.some((i) => i.speaker === 'ELI' && i.kind === 'speech' && !i.recorded));
});

test('an unknown voice is a line-numbered plan error; clone:<name> and presets are accepted', () => {
  assert.throws(() => planRender(parsed(`---\ncast:\n  ME: { voice: X9 }\n---\nME: Hi.\n`)), (e) => e instanceof PlanError && /line 5: unknown voice "X9"/.test(e.message));
  assert.throws(() => planRender(parsed(`---\ncast:\n  ME: { voice: ./style.json }\n---\nME: Hi.\n`)), /unknown voice/);
  const plan = planRender(parsed(`---\ncast:\n  ME: { voice: clone:me@F2 }\n  YOU: { voice: f1 }\n---\nME: Hi.\nYOU: Hello.\n`));
  assert.deepEqual(plan.items.filter((i) => i.kind === 'speech').map((i) => i.voice), ['clone:me@F2', 'F1'], 'presets are upper-cased for the engine');
});

test('clone voices use the base voice row from the voice store named by env (laugh native, spliced nv gets the base gender)', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const store = mkdtempSync(join(tmpdir(), 'aa plan voices '));
  mkdirSync(join(store, 'rex'));
  writeFileSync(join(store, 'rex', 'voice.json'), JSON.stringify({ version: 1, name: 'rex', base: 'M3', reference: 'reference.wav' }));
  const doc = `---\ncast:\n  REX: { voice: clone:rex }\n---\nREX: <laugh> Fine. <breath> Really.\n`;
  const plan = planRender(parsed(doc), { env: { AGENTSKILLDECK_VOICES: store } });
  const speech = plan.items.filter((i) => i.kind === 'speech');
  assert.ok(speech.some((i) => i.text.includes('<laugh>')), 'laugh stays native on the base row');
  const nv = plan.items.find((i) => i.kind === 'nv');
  assert.equal(nv.tag, 'breath');
  assert.equal(nv.base_voice, 'M3');
  const unknown = planRender(parsed(doc), { env: { AGENTSKILLDECK_VOICES: join(store, 'none') } });
  assert.ok(!unknown.items.some((i) => i.kind === 'speech' && i.text.includes('<laugh>')), 'no base voice: sample');
});
