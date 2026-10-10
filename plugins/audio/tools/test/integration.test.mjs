import './fixtures/native-env.mjs';
// Cross-lane integration (lane review of T2–T7): every case runs the real
// parse → plan → layout or parse → plan → qa path, no hand-built plan items.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScript } from '../lib/script.mjs';
import { planRender, PlanError } from '../lib/plan.mjs';
import { layoutTimeline, SPLICE_FADE_S, ROOM_TONE_DB } from '../lib/mix.mjs';
import { checkLine, retakePlan, bestTakes } from '../lib/qa.mjs';
import { DELIVERY_PRESETS } from '../lib/presets.mjs';
import { EngineTextError, assertEngineText } from '../lib/engine.mjs';

const CAST = 'cast:\n  ELI: { voice: M3 }\n  MAYA: { voice: F2 }\n';
const doc = (body, front = '') => `---\npreset: drama\n${front}${CAST}---\n${body}`;
const plan = (body, front) => {
  const parsed = parseScript(doc(body, front));
  assert.deepEqual(parsed.errors, []);
  return planRender(parsed);
};
// Every timed item gets a 1 s clip; cues get a resolved path.
function rendered(p) {
  const r = {};
  for (const it of p.items) {
    if (it.kind === 'speech' || it.kind === 'nv') r[it.id] = { path: `/r/${it.id}.wav`, duration_s: 1 };
    if (it.kind === 'cue' && it.cue.type !== 'scene') it.cue.path = `/a/${it.id}.wav`;
  }
  return r;
}
const speech = (p) => p.items.filter((i) => i.kind === 'speech');

test('critical 1: [pause N] reaches the timeline (the planner keeps its length in pre_s)', () => {
  const p = plan('ELI: One.\n[pause 1.5]\nMAYA: Two.\n');
  const tl = layoutTimeline(p, rendered(p), p.preset);
  const [a, b] = tl.lines;
  const pre = DELIVERY_PRESETS.neutral.pre_s;
  const post = DELIVERY_PRESETS.neutral.post_s;
  assert.ok(Math.abs(b.start - a.end - (post + 1.5 + pre)) < 1e-6, `gap ${b.start - a.end}`);
  const q = plan('ELI: One.\nMAYA: Two.\n');
  const tl2 = layoutTimeline(q, rendered(q), q.preset);
  assert.ok(Math.abs(tl2.lines[1].start - tl2.lines[0].end - (post + q.preset.gap_s + pre)) < 1e-6);
});

test('important 2: ids are unique across every item of a line, including multi-cue lines', () => {
  const p = plan('[scene: Night]  [ambience: sea | low]  [sfx: thunder]\nELI: <breath> Did you <gasp> hear that?\n[pause 1]\n');
  const ids = p.items.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, ids.join(' '));
  assert.deepEqual(ids.slice(0, 3), ['L7-0', 'L7-1', 'L7-2']);
  const tl = layoutTimeline(p, rendered(p), p.preset);
  assert.equal(new Set(tl.cues.map((c) => c.id)).size, tl.cues.length);
});

test('important 3: speech items carry seed 0 (take 0); the worker writes <id>.t<seed>.wav', () => {
  for (const it of speech(plan('ELI: Hello there.\nMAYA: Hi.\n'))) assert.equal(it.seed, 0);
});

test('important 4: the best take prefers a passing take over a lower-WER failing one, and retakes stop', () => {
  const [item] = speech(plan('ELI: Did you hear that noise outside?\n'));
  const t0 = { id: item.id, n: item.n, seed: 0, ...checkLine(item, 'Did you hear that noise outside') };
  const t1 = { id: item.id, n: item.n, seed: 1, ...checkLine(item, 'breath did you hear that noise outside') };
  assert.equal(t0.ok, true);
  assert.equal(t1.ok, false);
  const fake = { ...t1, wer: 0 }; // a failing take can score a lower WER (e.g. only a tag word heard)
  assert.equal(bestTakes([t0, fake])[0].seed, 0);
  assert.deepEqual(retakePlan([fake, t0], 4), [], 'one passing take ends the retakes');
});

test('important 5: nonverbals: model keeps <laugh> for the engine but QA does not expect the word', () => {
  const p = plan('ELI: That is funny <laugh> really.\n', 'nonverbals: model\n');
  const items = speech(p);
  assert.ok(items[0].text.includes('<laugh>'));
  assert.equal(p.items.filter((i) => i.kind === 'nv').length, 0);
  assert.equal(items.length, 1, 'the inline tag does not split the line');
  assert.equal(checkLine(items[0], 'That is funny really').ok, true);
  assert.match(checkLine(items[0], 'That is funny laughs really').problems.join(), /spoken tag "laugh"/);
});

test('important 6: multi-word and inflected stage directions become nonverbals and are never spoken', () => {
  const p = plan('ELI: (sighs heavily) Fine. [laughs softly] Okay. (Laughs.) Yes. (breathing) Wait. [laughter] *laughing* (clears throat) Go.\n', 'nonverbals: sample\n');
  assert.deepEqual(p.items.filter((i) => i.kind === 'nv').map((i) => i.tag), ['sigh', 'laugh', 'laugh', 'breath', 'laugh', 'laugh', 'cough']);
  const text = speech(p).map((i) => i.text).join(' ');
  assert.equal(text, 'Fine. Okay. Yes. Wait. Go.');
  assert.doesNotMatch(text, /sigh|laugh|breath|clears|throat|softly|heavily/i);
  const [fine] = speech(p);
  for (const heard of ['sighs fine', 'sighing fine', 'fine laughing', 'laughter fine', 'breathing fine', 'fine sobbing', 'giggles fine', 'chuckles fine', 'gasps fine', 'coughs fine', 'screams fine'])
    assert.equal(checkLine(fine, heard).ok, false, heard);
});

test('important 7: stray angle brackets never reach the engine; plan errors carry the line number', () => {
  const p = plan('ELI: </breath> hi < breath > there <whisper softly> go 3 < 4.\n');
  assert.deepEqual(p.items.filter((i) => i.kind === 'nv').map((i) => i.tag), ['breath', 'breath']);
  for (const it of speech(p)) {
    assert.doesNotMatch(it.text, /[<>]/);
    assertEngineText(it.text);
  }
  assert.throws(() => assertEngineText('hi <breath>'), EngineTextError);
  assert.equal(new EngineTextError('x').exitCode, 1);
  const parsed = parseScript(doc('ELI: Hi.\nELI (zonked): What?\n'));
  assert.throws(() => planRender(parsed), (e) => e instanceof PlanError && e.n === 8 && /^line 8: Unknown emotion/.test(e.message));
});

test('important 9: audiobook room tone starts at 0, runs under the whole piece and survives a top [scene:]', () => {
  const parsed = parseScript('---\npreset: audiobook\n---\n[scene: Chapter One]\n\nIt was a dark night.\n\n[scene: Chapter Two]\n\nMorning came.\n');
  const p = planRender(parsed);
  const tl = layoutTimeline(p, rendered(p), p.preset);
  const rt = tl.cues.filter((c) => c.label === 'room tone');
  assert.equal(rt.length, 1, 'one bed; the tail cue does not start a second one');
  assert.equal(rt[0].start, 0);
  assert.equal(rt[0].end, tl.duration_s);
  assert.equal(rt[0].gain_db, ROOM_TONE_DB);
  assert.deepEqual(tl.scenes.map((s) => s.name), ['Chapter One', 'Chapter Two']);
  assert.ok(tl.lines[0].start >= p.preset.room_tone.head_s);
  // Drama has no room tone.
  const d = plan('ELI: Hi.\n');
  assert.equal(layoutTimeline(d, rendered(d), d.preset).cues.filter((c) => c.label === 'room tone').length, 0);
});

test('minor: "Remember: ..." prose stays narration; a cast or ALLCAPS name makes dialogue', () => {
  const n = parseScript('Remember: be kind to each other.\n\nThe end.\n');
  assert.deepEqual(n.errors, []);
  assert.deepEqual(n.lines.map((l) => [l.speaker, l.text]), [['NARRATOR', 'Remember: be kind to each other.'], ['NARRATOR', 'The end.']]);
  const d = parseScript(doc('ELI: Hi.\nRemember: this is ELI talking.\n'));
  assert.equal(d.lines[0].speaker, 'ELI');
  assert.match(d.errors[0].message, /Unknown speaker "Remember"/);
});

test('auto (default): a laugh direction becomes inline engine tags; a sigh direction is a sample, never words', () => {
  const p = plan('ELI (laughs): Fine.\nMAYA (sighs, tired): Again. (coughs) Go.\n');
  assert.deepEqual(p.items.map((i) => [i.kind, i.tag ?? i.text]), [['speech', '<laugh><laugh><laugh> Fine.'], ['nv', 'sigh'], ['speech', 'Again. <cough><cough><cough> Go.']]);
  for (const it of speech(p)) assertEngineText(it.text);
  assert.match(checkLine(speech(p)[1], 'Again. Cough. Go.').problems.join(), /spoken tag "cough"/);
  assert.equal(checkLine(speech(p)[1], 'Again. Go.').ok, true);
});

test('minor: "ELI (laughs): ..." is a nonverbal at the line start, not an unknown emotion', () => {
  const p = plan('ELI (laughs): Fine.\nMAYA (sighs, tired): Again.\n', 'nonverbals: sample\n');
  assert.deepEqual(p.items.map((i) => [i.kind, i.tag ?? i.text, i.emotion]), [['nv', 'laugh', null], ['speech', 'Fine.', null], ['nv', 'sigh', 'tired'], ['speech', 'Again.', 'tired']]);
});

test('minor: an unknown bracket ([sic]) is removed without splitting the line', () => {
  const p = plan('ELI: I [sic] went home.\n');
  assert.deepEqual(speech(p).map((i) => i.text), ['I went home.']);
});

test('minor: delivery presets never inject a nonverbal the writer did not place', () => {
  for (const [name, d] of Object.entries(DELIVERY_PRESETS)) assert.equal(d.nonverbal, undefined, name);
  const p = plan('ELI (scared): Did you hear that?\n');
  assert.deepEqual(p.items.map((i) => i.kind), ['speech']);
});

test('minor: a nonverbal takes its line\'s delivery gain/EQ and gets 10 ms splice fades', () => {
  const p = plan('ELI (hushed): <breath> Wait here.\n');
  const [nv, sp] = p.items;
  assert.equal(nv.gain_db, sp.gain_db);
  assert.equal(nv.af, sp.af);
  assert.equal(nv.gain_db, DELIVERY_PRESETS.hushed.gain_db);
  const tl = layoutTimeline(p, rendered(p), p.preset);
  assert.deepEqual(tl.lines.map((l) => l.fade_s), [SPLICE_FADE_S, SPLICE_FADE_S]);
  const whole = plan('ELI: Wait here.\n');
  assert.equal(layoutTimeline(whole, rendered(whole), whole.preset).lines[0].fade_s, undefined, 'an unsplit line is untouched');
});

test('a line that starts or ends with a nonverbal keeps its delivery pre/post pause', () => {
  const p = plan('ELI: Hi.\nMAYA (sad): <sigh> I know. <sob>\n', 'nonverbals: sample\n');
  const tl = layoutTimeline(p, rendered(p), p.preset);
  const [eli, sigh, , sob] = tl.lines;
  const { pre_s, post_s } = DELIVERY_PRESETS.sad;
  assert.ok(Math.abs(sigh.start - eli.end - (DELIVERY_PRESETS.neutral.post_s + p.preset.gap_s + pre_s)) < 1e-6);
  assert.ok(Math.abs(tl.duration_s - sob.end - (post_s + p.preset.tail_s)) < 1e-6);
});
