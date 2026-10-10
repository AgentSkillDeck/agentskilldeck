import './fixtures/native-env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseNonverbals, SUPPORTED_TAGS } from '../lib/nonverbal.mjs';

function tags(segments) {
  return segments.filter((s) => s.type === 'nv').map((s) => s.tag);
}

test('supported tags list matches spec', () => {
  assert.deepEqual(SUPPORTED_TAGS, ['laugh', 'breath', 'sigh', 'gasp', 'sob', 'cough', 'scream', 'yawn', 'hmm', 'groan']);
});

test('<breath> at the start splits into nv then cleaned text', () => {
  const { segments } = normaliseNonverbals('<breath> Did you hear that?');
  assert.deepEqual(segments, [
    { type: 'nv', tag: 'breath' },
    { type: 'text', text: 'Did you hear that?' },
  ]);
});

test('a tag glued to a word still splits text/nv/text', () => {
  const { segments } = normaliseNonverbals('worked<breath>really');
  assert.deepEqual(segments, [
    { type: 'text', text: 'worked' },
    { type: 'nv', tag: 'breath' },
    { type: 'text', text: 'really' },
  ]);
});

test('"(laughs) fine" normalises to nv laugh then text', () => {
  const { segments, warnings } = normaliseNonverbals('(laughs) fine');
  assert.deepEqual(segments, [
    { type: 'nv', tag: 'laugh', level: 2 },
    { type: 'text', text: 'fine' },
  ]);
  assert.deepEqual(warnings, []);
});

test('an unknown tag produces a warning and is dropped', () => {
  const { segments, warnings } = normaliseNonverbals('<whisper> quiet now');
  assert.deepEqual(segments, [{ type: 'text', text: 'quiet now' }]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /whisper/i);
});

test('an unknown tag with an underscore (<door_slam>) is dropped, not leaked as text', () => {
  const { segments, warnings } = normaliseNonverbals('<door_slam> ahem');
  assert.deepEqual(segments, [{ type: 'text', text: 'ahem' }]);
  assert.equal(warnings.length, 1);
});

test('text segments strip [ ] ( ) * / | # _ and collapse whitespace', () => {
  const { segments } = normaliseNonverbals('weird_word with|pipe and#hash and/slash, half [bracket and (paren *star');
  assert.deepEqual(segments, [
    { type: 'text', text: 'weird word with pipe and hash and slash, half bracket and paren star' },
  ]);
});

test('empty text segments around a tag are dropped', () => {
  const { segments } = normaliseNonverbals('<laugh>');
  assert.deepEqual(segments, [{ type: 'nv', tag: 'laugh', level: 2 }]);
});

test('spec §2.1 table: every markup form of laugh/sigh/breath normalises to its tag', () => {
  assert.deepEqual(tags(normaliseNonverbals('[laugh]').segments), ['laugh']);
  assert.deepEqual(tags(normaliseNonverbals('(sigh)').segments), ['sigh']);
  assert.deepEqual(tags(normaliseNonverbals('(breath)').segments), ['breath']);
  assert.deepEqual(tags(normaliseNonverbals('<breath/>').segments), ['breath']);
  assert.deepEqual(tags(normaliseNonverbals('<Laugh>').segments), ['laugh']);
  assert.deepEqual(tags(normaliseNonverbals('(sighs)').segments), ['sigh']);
  assert.deepEqual(tags(normaliseNonverbals('*laughs*').segments), ['laugh']);
});

test('spec §2.1 table row 2: gasp/sniff/scream/chuckle/giggle/clear_throat resolve; whisper warns', () => {
  const r = normaliseNonverbals('<gasp> <sniff> <scream> <whisper> <chuckle> <giggle> <clear_throat>');
  assert.deepEqual(tags(r.segments), ['gasp', 'sob', 'scream', 'laugh', 'laugh', 'cough']);
  assert.equal(r.warnings.length, 1);
});

test('spec §2.1 table row 3: cry/cough/yawn/hmm/groan/sob resolve', () => {
  const r = normaliseNonverbals('<cry> <cough> <yawn> <groan> <hmm> <sob>');
  assert.deepEqual(tags(r.segments), ['sob', 'cough', 'yawn', 'groan', 'hmm', 'sob']);
  assert.equal(r.warnings.length, 0);
});

test('aliases map correctly: chuckle/giggle -> laugh, sniff/cry -> sob, inhale -> breath', () => {
  assert.deepEqual(tags(normaliseNonverbals('<chuckle>').segments), ['laugh']);
  assert.deepEqual(tags(normaliseNonverbals('<giggle>').segments), ['laugh']);
  assert.deepEqual(tags(normaliseNonverbals('<sniff>').segments), ['sob']);
  assert.deepEqual(tags(normaliseNonverbals('<cry>').segments), ['sob']);
  assert.deepEqual(tags(normaliseNonverbals('<inhale>').segments), ['breath']);
});

test('spoken engine tags never pass through: clear-throat and sneeze become a cough sample; groan, yawn, hmm and cough stay tags (the voice table decides)', () => {
  const nv = (t) => normaliseNonverbals(t);
  for (const t of ['<clear-throat> So.', '<clear_throat> So.', '(clears throat) So.', '[clears his throat] So.']) {
    assert.deepEqual(nv(t).segments, [{ type: 'nv', tag: 'cough', sample: true }, { type: 'text', text: 'So.' }], t);
  }
  const s = nv('<sneeze> Sorry.');
  assert.deepEqual(s.segments[0], { type: 'nv', tag: 'cough', sample: true });
  assert.match(s.warnings.join(), /sneeze/);
  assert.deepEqual(nv('<groan> Fine.').segments[0], { type: 'nv', tag: 'groan' });
  assert.deepEqual(nv('(yawns) Late.').segments[0], { type: 'nv', tag: 'yawn' });
  assert.deepEqual(nv('<hmm> Maybe.').segments, [{ type: 'nv', tag: 'hmm' }, { type: 'text', text: 'Maybe.' }]);
  assert.deepEqual(nv('<cough> Sorry.').segments[0], { type: 'nv', tag: 'cough' });
  assert.equal(nv('(sniffs) Okay.').segments[0].tag, 'sob');
});

test('laugh intensity: <laugh:N> and stage directions set level 1-3; sigh defaults to 1', () => {
  const lv = (t) => normaliseNonverbals(t).segments.filter((s) => s.type === 'nv').map((s) => [s.tag, s.level]);
  assert.deepEqual(lv('<laugh> a <laugh:1> b <laugh:3> c <laugh:9>'), [['laugh', 2], ['laugh', 1], ['laugh', 3], ['laugh', 3]]);
  assert.deepEqual(lv('(chuckles) a (giggles) b (laughs) c (laughs hard) d (bursts out laughing) e [laughter] f (laughs softly)'),
    [['laugh', 1], ['laugh', 1], ['laugh', 2], ['laugh', 3], ['laugh', 3], ['laugh', 3], ['laugh', 1]]);
  assert.deepEqual(lv('<sigh> a <sigh:2> b (sighs heavily)'), [['sigh', undefined], ['sigh', undefined], ['sigh', undefined]], 'a sigh has one size');
});
