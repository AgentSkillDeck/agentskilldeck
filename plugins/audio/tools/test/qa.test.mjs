import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseForWer, wer, checkLine, retakePlan, qaReport, nativePositions } from '../lib/qa.mjs';

test('normaliseForWer lowercases, strips punctuation, collapses whitespace', () => {
  assert.equal(normaliseForWer("Don't!  Move.  "), 'don t move');
});

test('normaliseForWer maps digits to number words for en, 0-100', () => {
  assert.equal(normaliseForWer('The meeting starts at 9.', 'en'), 'the meeting starts at nine');
  assert.equal(normaliseForWer('I have 21 apples', 'en'), 'i have twenty one apples');
  assert.equal(normaliseForWer('exactly 100 percent', 'en'), 'exactly one hundred percent');
});

test('normaliseForWer maps a 4-digit year to two spoken groups', () => {
  assert.equal(normaliseForWer('Born in 1990.', 'en'), 'born in nineteen ninety');
  assert.equal(normaliseForWer('The year 2024 arrived.', 'en'), 'the year twenty twenty four arrived');
});

test('normaliseForWer does not translate digits for non-English', () => {
  assert.equal(normaliseForWer('Tengo 9 anos', 'es'), 'tengo 9 anos');
});

test('wer is Levenshtein distance over words, divided by ref length', () => {
  assert.equal(wer('did you hear that', 'did you hear that'), 0);
  assert.equal(wer('did you hear that', 'breath did you hear that'), 0.25);
  assert.equal(wer('hello world', ''), 1);
  assert.equal(wer('', ''), 0);
});

test('"Breath, did you hear that?" vs ref "Did you hear that?" fails: spoken tag "breath"', () => {
  const result = checkLine({ text: 'Did you hear that?', lang: 'en' }, 'Breath, did you hear that?');
  assert.equal(result.ok, false);
  assert.ok(result.problems.includes('spoken tag "breath"'));
});

test('"Breathe in slowly" in both ref and hyp passes (not a spliced tag)', () => {
  const result = checkLine({ text: 'Breathe in slowly', lang: 'en' }, 'Breathe in slowly');
  assert.equal(result.ok, true);
  assert.deepEqual(result.problems, []);
});

test('"The meeting starts at 9" vs "The meeting starts at nine" passes via digit/word normalisation', () => {
  const result = checkLine({ text: 'The meeting starts at 9.', lang: 'en' }, 'The meeting starts at nine.');
  assert.equal(result.ok, true);
  assert.equal(result.wer, 0);
});

test('a Spanish line uses the 0.30 threshold, not 0.15', () => {
  const ref = 'El perro corre muy rapido por el parque';
  // one word changed out of 8 -> wer = 1/8 = 0.125, passes both thresholds; use two changes for 0.25 (<0.30, >0.15)
  const hyp = 'El gato corre muy lento por el parque';
  const result = checkLine({ text: ref, lang: 'es' }, hyp);
  assert.ok(result.wer > 0.15 && result.wer <= 0.30);
  assert.equal(result.ok, true);
});

test('an empty hypothesis against non-empty reference fails', () => {
  const result = checkLine({ text: 'Hello there.', lang: 'en' }, '');
  assert.equal(result.ok, false);
  assert.ok(result.problems.includes('empty transcript'));
});

test('retakePlan proposes the next seed for failing lines, respecting maxTakes', () => {
  const results = [
    { id: 'L1-0', n: 1, seed: 0, ok: false, wer: 0.5 },
  ];
  const plan = retakePlan(results, 4);
  assert.deepEqual(plan, [{ id: 'L1-0', n: 1, seed: 1 }]);
});

test('retakePlan stops proposing once a take passes', () => {
  const results = [
    { id: 'L1-0', n: 1, seed: 0, ok: false, wer: 0.5 },
    { id: 'L1-0', n: 1, seed: 1, ok: true, wer: 0.05 },
  ];
  assert.deepEqual(retakePlan(results, 4), []);
});

test('retakePlan respects the retake ceiling', () => {
  const results = [
    { id: 'L1-0', n: 1, seed: 0, ok: false, wer: 0.9 },
    { id: 'L1-0', n: 1, seed: 1, ok: false, wer: 0.8 },
    { id: 'L1-0', n: 1, seed: 2, ok: false, wer: 0.7 },
    { id: 'L1-0', n: 1, seed: 3, ok: false, wer: 0.6 },
  ];
  // 4 takes already exist == maxTakes(4): no further retake proposed.
  assert.deepEqual(retakePlan(results, 4), []);
});

test('qaReport aggregates lines and mastering into a qa.json-shaped object', () => {
  const lines = [
    { id: 'L1-0', ok: true, wer: 0 },
    { id: 'L2-0', ok: false, wer: 0.4, problems: ['wer 0.40 exceeds 0.15'] },
  ];
  const report = qaReport(lines, { lufs: -16.2, true_peak: -1.1, ok: true });
  assert.equal(report.ok, false); // one failing line
  assert.equal(report.summary.total, 2);
  assert.equal(report.summary.failed, 1);
  assert.equal(report.mastering.lufs, -16.2);
});

test('an inline <sigh> line fails on any extra word (a sigh voiced as "so" or "its"), even under the WER limit', () => {
  const line = { text: 'I waited for an hour. <sigh> Nobody came.' };
  assert.equal(checkLine(line, 'I waited for an hour. Nobody came.').ok, true);
  const r = checkLine(line, 'I waited for an hour, so nobody came.');
  assert.equal(r.ok, false);
  assert.match(r.problems.join(), /inserted word "so"/);
  // Lines without an inline sigh keep the plain WER rule.
  assert.equal(checkLine({ text: 'I waited for an hour. Nobody came today.' }, 'I waited for an hour, so nobody came today.').ok, true);
});

test('compound splits and British spellings do not count as errors ("Goodnight" vs "Good night", "favourite" vs "favorite")', () => {
  assert.equal(checkLine({ text: 'Pip closed her eyes. Goodnight, little owl.' }, 'Pip closed her eyes. Good night, little owl.').wer, 0);
  assert.equal(checkLine({ text: 'Say good night to the fire fly.' }, 'Say goodnight to the firefly.').wer, 0);
  assert.equal(checkLine({ text: 'My favourite colour is grey, I realise.' }, 'My favorite color is grey, I realize.').wer, 0);
  assert.ok(checkLine({ text: 'It took four hours.' }, 'It took for hours.').wer > 0, 'short words are not respelled');
});

test('titles whisper abbreviates (Dr., Mr., Mrs.) and near-miss spellings of names in the script are not errors', () => {
  assert.equal(checkLine({ text: 'Doctor Watson, Mister Sherlock Holmes,' }, 'Dr. Watson, Mr. Sherlock Holmes.').wer, 0);
  assert.equal(checkLine({ text: 'said Stamford, introducing us.' }, 'said Stomford introducing us.').wer, 0);
  assert.equal(checkLine({ text: 'the lamp on Gull Rock' }, 'the lamp on gall rock').wer, 0);
  // Only capitalised script words get the name tolerance; common words must match.
  assert.ok(checkLine({ text: 'said the farmer, introducing us.' }, 'said the former introducing us.').wer > 0);
});

test('a transcript in another script (Hindi heard as Urdu) is not scored by WER: the line passes with a note', () => {
  const r = checkLine({ text: 'नमस्ते। यह आवाज़ आपके अपने कंप्यूटर पर चलती है।', lang: 'hi' }, 'Namaste, یہ آواز آپ کے اپنے کمپیوٹر پر چلتی ہے');
  assert.equal(r.ok, true);
  assert.match(r.notes.join(), /script/);
  // Same script, wrong words: still fails.
  assert.equal(checkLine({ text: 'नमस्ते। यह आवाज़ आपके अपने कंप्यूटर पर चलती है।', lang: 'hi' }, 'मुझे नहीं पता क्या हुआ था').ok, false);
});

test('Japanese kanji and kana count as one script, so a Japanese line is still scored', () => {
  const r = checkLine({ text: 'こんにちは。この声はあなたの言葉を話します。', lang: 'ja' }, '全然違う文章です');
  assert.equal(r.notes.length, 0);
  assert.equal(r.ok, false);
});

test('a native <hmm> heard as "Hmm" is the sound, not an extra word; other native tags get the extra-word check', () => {
  assert.equal(checkLine({ text: '<hmm> <hmm> <hmm> Maybe later.' }, 'Hmm, maybe later.').ok, true);
  assert.equal(checkLine({ text: 'Sorry. <cough> <cough> <cough> Go on.' }, 'Sorry, so go on.').ok, false);
});

// Spoken-tag artefacts are not always the tag word (lab transcripts): "Reth"
// for a breath, "So" / "S.I." / "aside" for a sigh. One inserted word in a
// nine-word line is under the 0.15 WER limit, so position matters.
test('a word inserted at a native tag position fails, even under the WER limit (lab artefacts "Reth", "So", "S.I.", "aside")', () => {
  const breath = { text: '<breath> <breath> <breath> We walked all the way home in the rain.' };
  assert.equal(checkLine(breath, 'We walked all the way home in the rain.').ok, true);
  const reth = checkLine(breath, 'Reth. We walked all the way home in the rain.');
  assert.ok(reth.wer <= 0.15, 'one insertion in nine words passes WER alone');
  assert.equal(reth.ok, false);
  assert.match(reth.problems.join(), /"reth".*breath/);
  const sigh = { text: 'I waited for an hour at the station. <sigh> <sigh> <sigh> Nobody came.' };
  for (const heard of ['I waited for an hour at the station. So nobody came.', 'I waited for an hour at the station. S.I. Nobody came.', 'I waited for an hour at the station, aside. Nobody came.']) {
    const r = checkLine(sigh, heard);
    assert.equal(r.ok, false, heard);
    assert.match(r.problems.join(), /sigh/, heard);
  }
  assert.equal(checkLine({ text: 'That was close. <yawn> <yawn> <yawn> Okay, let us go.' }, 'That was close. Aside. Okay, let us go.').ok, false);
});

test('the insertion window is local to the tag; laugh and hmm sounds whisper writes are allowed there; fuzzy stems fail anywhere', () => {
  const laugh = { text: '<laugh> <laugh> <laugh> We walked all the way home in the rain.' };
  assert.equal(checkLine(laugh, 'We walked all the way back home in the rain.').ok, true, 'an insertion away from the tag is left to WER');
  assert.equal(checkLine(laugh, 'Ha ha. We walked all the way home in the rain.').ok, true, 'a laugh heard as "ha ha"');
  assert.equal(checkLine({ text: 'Well. <hmm> <hmm> <hmm> Maybe we should wait for the others.' }, 'Well, hmm, maybe we should wait for the others.').ok, true);
  const yon = checkLine(laugh, 'We walked all the way yon home in the rain.');
  assert.equal(yon.ok, false);
  assert.match(yon.problems.join(), /"yon"/);
  // Lines with no native tag keep the plain WER rule: "so" is just a word there.
  assert.equal(checkLine({ text: 'I waited for an hour. Nobody came today.' }, 'I waited for an hour, so nobody came today.').ok, true);
});

test('nativePositions gives the word index of each native tag run; checkLine accepts the plan\'s native_at', () => {
  assert.deepEqual(nativePositions('Ha. <laugh> <laugh> Fine, then. <yawn> <yawn> <yawn> Night.'), [1, 3]);
  assert.deepEqual(nativePositions('<laugh> <laugh> Go.'), [0]);
  assert.deepEqual(nativePositions('No tags here.'), []);
  const r = checkLine({ text: 'We walked all the way home in the rain tonight.', native_at: [5] }, 'We walked all the way so home in the rain tonight.');
  assert.equal(r.ok, false, 'native_at from the plan marks the window');
});

test('normaliseForWer keeps combining marks (Devanagari vowel signs and virama are part of the word)', () => {
  assert.equal(normaliseForWer('नमस्ते। यह आवाज़', 'hi'), 'नमस्ते यह आवाज़');
  assert.equal(checkLine({ text: 'नमस्ते। यह आवाज़ आपकी भाषा बोलती है।', lang: 'hi' }, 'नमस्ते, यह आवाज़ आपकी भाषा बोलती है').wer, 0);
});

test('a script word next to a native tag that is not heard fails: the laugh swallowed it', () => {
  const line = { text: "It is not the pigeon thing. <laugh><laugh><laugh> Okay. It's partly the pigeon thing." };
  const r = checkLine(line, "It is not the pigeon thing. It's partly the pigeon thing.");
  assert.ok(r.wer <= 0.15, 'one missing word in thirteen passes WER alone');
  assert.equal(r.ok, false);
  assert.match(r.problems.join(), /"okay".*laugh/);
  assert.equal(checkLine(line, "It is not the pigeon thing. Okay, it's partly the pigeon thing.").ok, true);
  // A word dropped away from the tag is left to WER.
  assert.equal(checkLine(line, "It is not the pigeon thing. Okay, it's partly pigeon thing.").ok, true);
});
