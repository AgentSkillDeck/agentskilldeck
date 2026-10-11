import './fixtures/native-env.mjs';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  alignWords, estimateWords, writeTimeline, writeCaptions, writeAudioMeta, writeCredits, formatTime, SUPERTONIC_CREDIT,
} from '../lib/deliver.mjs';

const work = mkdtempSync(join(tmpdir(), 'aa deliver '));
after(() => rmSync(work, { recursive: true, force: true }));

// A layoutTimeline() result (lib/mix.mjs) plus the fields produce adds.
function layout() {
  return {
    title: 'The Lighthouse',
    duration_s: 8,
    scenes: [{ name: 'Night', start: 0.5 }],
    lines: [
      { id: 'L2-0', n: 2, kind: 'speech', speaker: 'NARRATOR', voice: 'F4', emotion: null, text: 'The lamp had burned for forty years.', start: 0.5, end: 2.5, path: join(work, 'r', 'a.wav'), gain_db: 0, af: '' },
      { id: 'L3-0', n: 3, kind: 'nv', speaker: 'ELI', voice: 'M3', emotion: 'scared', text: '', tag: 'breath', start: 2.75, end: 3.25, path: join(work, 'assets', 'b.mp3'), gain_db: -1, af: '' },
      { id: 'L3-1', n: 3, kind: 'speech', speaker: 'ELI', voice: 'M3', emotion: 'scared', text: 'Did you hear that?', start: 3.25, end: 4.25, path: join(work, 'r', 'c.wav'), gain_db: -1, af: '' },
    ],
    cues: [
      { type: 'ambience', id: 'L1-1', label: 'sea', start: 0.5, end: 8, path: join(work, 'assets', 'sea.wav'), gain_db: -26, loop: true },
      { type: 'sfx', id: 'L4-0', label: 'door', start: 4.5, end: 5.3, path: join(work, 'assets', 'door.mp3'), gain_db: -6 },
    ],
    warnings: [],
    assets: [
      { ids: ['L4-0'], type: 'sfx', path: join(work, 'assets', 'door.mp3'), source: 'openverse', title: 'Door creak', creator: 'Ann', license: 'CC BY 4.0', license_url: 'https://creativecommons.org/licenses/by/4.0/', source_url: 'https://freesound.org/s/1', attribution: '"Door creak" by Ann (https://freesound.org/s/1), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)' },
      { ids: ['L1-1'], type: 'ambience', path: join(work, 'assets', 'sea.wav'), source: 'generated', title: 'Generated pink', creator: 'agentskilldeck (ffmpeg generator)', license: 'generated', license_url: '', source_url: '', attribution: 'Generated pink: generated with ffmpeg, no attribution required' },
    ],
  };
}

const words = {
  'L2-0': [
    { w: 'The', start: 0, end: 0.2 }, { w: 'lamp', start: 0.2, end: 0.5 }, { w: 'had', start: 0.5, end: 0.7 },
    { w: 'burned', start: 0.7, end: 1.1 }, { w: 'for', start: 1.1, end: 1.3 }, { w: 'forty', start: 1.3, end: 1.6 }, { w: 'years.', start: 1.6, end: 2 },
  ],
  'L3-1': [{ w: 'Did', start: 0, end: 0.2 }, { w: 'you', start: 0.2, end: 0.4 }, { w: 'hear', start: 0.4, end: 0.7 }, { w: 'that?', start: 0.7, end: 1 }],
};

test('alignWords keeps the script words and takes the ASR timings, interpolating misheard or missing ones', () => {
  const asr = [{ w: 'Did', start: 0.1, end: 0.3 }, { w: 'ya', start: 0.3, end: 0.5 }, { w: 'hear', start: 0.5, end: 0.8 }];
  const a = alignWords('Did you hear that?', asr, 1.2);
  assert.deepEqual(a.map((w) => w.w), ['Did', 'you', 'hear', 'that?']);
  assert.deepEqual([a[0].start, a[0].end], [0.1, 0.3]);
  assert.deepEqual([a[1].start, a[1].end], [0.3, 0.5], 'substitution takes the misheard word timing');
  assert.ok(a[3].start >= 0.8 && a[3].end <= 1.2 && a[3].end > a[3].start, 'trailing missing word fills to the clip end');
  for (let i = 1; i < a.length; i++) assert.ok(a[i].start >= a[i - 1].start);
  // An extra ASR word is ignored; an empty ASR result falls back to an estimate.
  const b = alignWords('Hello there', [{ w: 'Uh', start: 0, end: 0.1 }, { w: 'Hello', start: 0.1, end: 0.5 }, { w: 'there.', start: 0.5, end: 0.9 }], 1);
  assert.deepEqual(b.map((w) => [w.w, w.start]), [['Hello', 0.1], ['there', 0.5]]);
  assert.deepEqual(alignWords('Hello there', [], 1), estimateWords('Hello there', 1));
});

test('estimateWords spreads words over the clip by length', () => {
  const e = estimateWords('a bbbb', 1);
  assert.equal(e[0].start, 0);
  assert.equal(e.at(-1).end, 1);
  assert.ok(e[1].end - e[1].start > e[0].end - e[0].start);
  assert.deepEqual(estimateWords('<laugh> ha', 1).map((w) => w.w), ['ha'], 'inline <laugh> is not a caption word');
});

test('writeTimeline writes version 1 with absolute word times, relative paths and assets', () => {
  const out = join(work, 'timeline.json');
  const doc = writeTimeline(layout(), words, out);
  const disk = JSON.parse(readFileSync(out, 'utf8'));
  assert.deepEqual(disk, doc);
  assert.equal(doc.version, 1);
  assert.equal(doc.title, 'The Lighthouse');
  assert.equal(doc.duration_s, 8);
  assert.deepEqual(doc.scenes, [{ name: 'Night', start: 0.5 }]);
  const [l1, nv, l3] = doc.lines;
  for (const k of ['id', 'speaker', 'voice', 'emotion', 'text', 'start', 'end', 'words']) assert.ok(k in l1, k);
  assert.equal(l1.words[0].start, 0.5);
  assert.equal(l1.words.at(-1).end, 2.5);
  assert.equal(nv.kind, 'nv');
  assert.equal(nv.tag, 'breath');
  assert.deepEqual(nv.words, []);
  assert.equal(l3.emotion, 'scared');
  assert.deepEqual(l3.words.map((w) => w.start), [3.25, 3.45, 3.65, 3.95]);
  assert.equal(doc.cues[1].path, 'assets/door.mp3');
  assert.equal(doc.assets[0].path, 'assets/door.mp3');
  assert.equal(doc.assets[0].license, 'CC BY 4.0');
  assert.ok(!JSON.stringify(doc).includes(work), 'no absolute paths into the out dir');
});

test('captions break at word boundaries within maxChars/maxLines, with speaker labels', () => {
  const doc = writeTimeline(layout(), words, join(work, 't2.json'));
  const srt = writeCaptions(doc, { format: 'srt', maxChars: 20, maxLines: 2 });
  const blocks = srt.trim().split(/\n\n/);
  // "years." alone would be a cue of its own: the line above moves down to join it.
  assert.match(blocks[0], /^1\n00:00:00,500 --> 00:00:0\d,\d{3}\nNARRATOR: The lamp$/);
  assert.match(blocks[1], /\nhad burned for forty\nyears\.$/);
  for (const b of blocks) {
    const text = b.split('\n').slice(2);
    assert.ok(text.length <= 2, b);
    for (const l of text) assert.ok(l.length <= 20, `${l} > 20 chars`);
  }
  // Every script word appears exactly once, in order.
  const all = blocks.map((b) => b.split('\n').slice(2).join(' ')).join(' ').replace(/\b[A-Z]+: /g, '');
  assert.equal(all, 'The lamp had burned for forty years. Did you hear that?');
  assert.match(srt, /ELI: Did you hear\nthat\?/);
  assert.ok(!/NARRATOR: years/.test(srt), 'a continuation cue of the same line has no label');
  // Cue times come from word timestamps and never overlap.
  const times = blocks.map((b) => b.split('\n')[1].split(' --> '));
  const sec = (s) => { const [h, m, r] = s.replace(',', '.').split(':'); return h * 3600 + m * 60 + Number(r); };
  for (let i = 1; i < times.length; i++) assert.ok(sec(times[i][0]) >= sec(times[i - 1][1]));
  assert.equal(times.at(-1)[0], '00:00:03,250');
  assert.equal(times.at(-1)[1], '00:00:04,250');
});

test('SRT and VTT formats', () => {
  const doc = writeTimeline(layout(), words, join(work, 't3.json'));
  const srt = writeCaptions(doc, { format: 'srt' });
  assert.match(srt, /^1\n00:00:00,500 --> 00:00:02,500\nNARRATOR: The lamp had burned for forty\nyears\.\n\n2\n00:00:03,250 --> 00:00:04,250\nELI: Did you hear that\?\n$/);
  const vtt = writeCaptions(doc, { format: 'vtt' });
  assert.match(vtt, /^WEBVTT\n\n00:00:00\.500 --> 00:00:02\.500\n<v NARRATOR>The lamp had burned for forty\nyears\.\n\n00:00:03\.250 --> 00:00:04\.250\n<v ELI>Did you hear that\?\n$/);
  const plain = writeCaptions(doc, { format: 'vtt', speakerLabels: false });
  assert.ok(!plain.includes('<v '));
  assert.throws(() => writeCaptions(doc, { format: 'ass' }), /format/);
  assert.equal(formatTime(3661.5, 'srt'), '01:01:01,500');
  assert.equal(formatTime(0.0004, 'vtt'), '00:00:00.000');
});

test('writeAudioMeta uses the HyperFrames shape', () => {
  const doc = writeTimeline(layout(), words, join(work, 't4.json'));
  const stems = {
    dialogue: join(work, 'stems', 'dialogue.wav'),
    speakers: { NARRATOR: join(work, 'stems', 'dialogue-narrator.wav'), ELI: join(work, 'stems', 'dialogue-eli.wav') },
    ambience: join(work, 'stems', 'ambience.wav'),
    sfx: join(work, 'stems', 'sfx.wav'),
  };
  const out = join(work, 'audio_meta.json');
  const meta = writeAudioMeta(doc, stems, out);
  assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')), meta);
  assert.deepEqual(Object.keys(meta).sort(), ['bgm', 'sfx', 'total_duration_s', 'voices']);
  assert.equal(meta.total_duration_s, 8);
  assert.equal(meta.bgm, null);
  assert.deepEqual(meta.voices.map((v) => [v.id, v.path, v.duration_s]), [['NARRATOR', 'stems/dialogue-narrator.wav', 8], ['ELI', 'stems/dialogue-eli.wav', 8]]);
  assert.deepEqual(meta.voices[1].words[0], { text: 'Did', start: 3.25, end: 3.45 });
  for (const v of meta.voices) for (const w of v.words) assert.deepEqual(Object.keys(w), ['text', 'start', 'end']);
  assert.deepEqual(meta.sfx, [{ id: 'ambience', path: 'stems/ambience.wav', start: 0 }, { id: 'L4-0', path: 'assets/door.mp3', start: 4.5 }]);
  const withMusic = writeAudioMeta(doc, { ...stems, music: join(work, 'stems', 'music.wav') }, out);
  assert.deepEqual(withMusic.bgm, { path: 'stems/music.wav' });
});

test('writeCredits: Supertonic first, one attribution line per asset, then the generated note', () => {
  const out = join(work, 'CREDITS.md');
  const assets = [...layout().assets, layout().assets[0], { ids: ['L3-0'], type: 'nv', path: join(work, 'assets', 'nv.mp3'), source: 'bundled', title: 'breath', creator: 'X', license: 'CC0 1.0', attribution: '"breath" by X (https://freesound.org/s/2), CC0 1.0 (public domain dedication, no attribution required)' }];
  const md = writeCredits(assets, out);
  assert.equal(readFileSync(out, 'utf8'), md);
  const lines = md.trim().split('\n').filter((l) => l.startsWith('- '));
  assert.ok(md.indexOf(SUPERTONIC_CREDIT) < md.indexOf('Door creak'));
  assert.match(SUPERTONIC_CREDIT, /Supertonic/);
  assert.match(SUPERTONIC_CREDIT, /OpenRAIL-M/);
  assert.equal(lines.length, 2, 'deduped; generated assets are not listed one by one');
  assert.match(lines[0], /^- "Door creak" by Ann .*CC BY 4\.0/);
  assert.match(lines[1], /^- "breath" by X/);
  assert.match(md.trim().split('\n').at(-1), /^Generated sounds: no attribution required/);
  assert.match(writeCredits([], out, { draft: true }), /draft voice/i);
});

test('writeCredits: no generated note without a generated sound; a real voice changes the disclosure', () => {
  const out = join(work, 'CREDITS2.md');
  const plain = writeCredits([], out);
  assert.doesNotMatch(plain, /Generated sounds/);
  assert.match(plain, /AI-generated voices, not real people/);
  const mixed = writeCredits([{ path: '/x/rt.wav', source: 'generated', license: 'generated' }], out, { recorded: ['ME'], clones: [{ speaker: 'GRACE', name: 'grace', base: 'F2', consent: { kind: 'own' } }] });
  assert.doesNotMatch(mixed, /AI-generated voices, not real people/, 'a recorded or cloned real voice is in the piece');
  assert.match(mixed, /Preset voices are synthetic, not real people/);
  assert.match(mixed, /ME: recorded by the speaker/);
  assert.match(mixed, /GRACE: cloned voice "grace"/);
  assert.match(mixed, /Generated sounds/);
  const recordedOnly = writeCredits([], out, { recorded: ['ME'], synth: false });
  assert.doesNotMatch(recordedOnly, /Supertonic|Preset voices/);
});

test('writeTimeline keeps rounded word times inside their line', () => {
  const tl = { duration_s: 7, scenes: [], cues: [], lines: [{ id: 'L1-0', n: 1, kind: 'speech', speaker: 'ELI', voice: 'M3', text: 'hear that', start: 4.74898, end: 5.902925, path: '/x.wav' }] };
  const doc = writeTimeline(tl, { 'L1-0': [{ w: 'hear', start: 0, end: 0.5 }, { w: 'that', start: 0.5, end: 5.902925 - 4.74898 }] }, join(work, 'round.json'));
  for (const w of doc.lines[0].words) assert.ok(w.start >= 4.74898 && w.end <= 5.902925, `${w.w} ${w.start}-${w.end}`);
});

test('writeTimeline keeps inline engine tags out of line text and lists them in inline_nv', () => {
  const tl = { duration_s: 3, scenes: [], cues: [], lines: [{ id: 'L1-0', n: 1, kind: 'speech', speaker: 'MAYA', voice: 'F2', text: '<sigh> Long day. <laugh> Fine.', start: 0, end: 2, path: '/x.wav' }] };
  const doc = writeTimeline(tl, { 'L1-0': [] }, join(work, 'inline.json'));
  assert.equal(doc.lines[0].text, 'Long day. Fine.');
  assert.deepEqual(doc.lines[0].inline_nv, ['sigh', 'laugh']);
});

test('alignWords: a transcript that does not line up (other alphabet, no spaces) spreads the words over the heard speech', () => {
  // Japanese has no spaces: one script "word", many ASR tokens.
  const ja = alignWords('こんにちは。この声は動いています。', [{ w: 'こんにちは', start: 0.3, end: 1.1 }, { w: 'この', start: 1.3, end: 1.6 }, { w: '声は', start: 1.6, end: 2 }, { w: '動いています', start: 2, end: 7.4 }], 8);
  assert.deepEqual(ja.map((w) => [w.start, w.end]), [[0.3, 7.4]]);
  // Hindi heard in Urdu script: no word matches, so no ASR word's time is trusted.
  const hi = alignWords('नमस्ते। यह आवाज़ आपके', [{ w: 'نمسٹے', start: 0.3, end: 0.9 }, { w: 'یہ', start: 1.4, end: 1.6 }, { w: 'آواجر', start: 1.6, end: 2.1 }, { w: 'آپ', start: 2.1, end: 2.3 }, { w: 'کے', start: 2.3, end: 2.6 }], 3);
  assert.equal(hi[0].start, 0.3);
  assert.equal(hi.at(-1).end, 2.6);
  for (let i = 1; i < hi.length; i++) assert.ok(hi[i].start >= hi[i - 1].end - 1e-9);
});

test('captions: a short two-word tail ("it\'s slow.") joins the line above instead of flashing on its own', () => {
  const ws = 'Then came the rain, then came the hail, then came the wind, then came the dark, it\'s slow.'.split(' ');
  const doc = { lines: [{ id: 'a', n: 1, kind: 'speech', speaker: 'NARRATOR', start: 0, end: 6, words: ws.map((w, i) => ({ w, start: i * 0.35, end: i * 0.35 + 0.3 })) }] };
  const vtt = writeCaptions(doc, { format: 'vtt', maxChars: 20, maxLines: 2, speakerLabels: false });
  const cues = vtt.trim().split(/\n\n/).slice(1).map((b) => b.split('\n').slice(1));
  assert.ok(cues.every((c) => c.join(' ') !== "it's slow."), vtt);
  assert.deepEqual(cues.at(-1), ['then came the dark,', "it's slow."]);
  assert.equal(cues.map((c) => c.join(' ')).join(' '), ws.join(' '));
});
