import './fixtures/native-env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScript } from '../lib/script.mjs';

const LIGHTHOUSE = `---
title: The Lighthouse
lang: en
preset: drama            # domain preset (§5)
cast:
  NARRATOR: { voice: F4 }
  ELI:      { voice: M3, speed: 1.05 }
  MAYA:     { voice: F2 }
music: { search: "slow cinematic piano", level: bed }
---
[scene: Lighthouse, night]  [ambience: sea waves, wind | low]
NARRATOR: The lamp had burned for forty years.
ELI (scared): <breath> Did you hear that?
[sfx: wooden door creak]
MAYA (hushed): Don't. Move.
[pause 1.5]
MAYA (relieved): <laugh> It's only the wind.
[music: swell]
`;

test('front matter: scalars, inline maps, one level of nesting', () => {
  const { meta } = parseScript(LIGHTHOUSE, { file: 'lighthouse.audio.md' });
  assert.equal(meta.title, 'The Lighthouse');
  assert.equal(meta.lang, 'en');
  assert.equal(meta.preset, 'drama');
  assert.deepEqual(meta.cast.NARRATOR, { voice: 'F4' });
  assert.deepEqual(meta.cast.ELI, { voice: 'M3', speed: 1.05 });
  assert.deepEqual(meta.cast.MAYA, { voice: 'F2' });
  assert.deepEqual(meta.music, { search: 'slow cinematic piano', level: 'bed' });
});

test('a multi-cue line produces one Line per cue, same n', () => {
  const { lines } = parseScript(LIGHTHOUSE, {});
  const cueLines = lines.filter((l) => l.n === 11); // "[scene...]  [ambience...]"
  assert.equal(cueLines.length, 2);
  assert.equal(cueLines[0].kind, 'cue');
  assert.equal(cueLines[0].cue.type, 'scene');
  assert.equal(cueLines[0].cue.value, 'Lighthouse, night');
  assert.equal(cueLines[1].cue.type, 'ambience');
  assert.equal(cueLines[1].cue.value, 'sea waves, wind');
  assert.deepEqual(cueLines[1].cue.args, ['low']);
});

test('sfx and pause cues parse', () => {
  const { lines } = parseScript(LIGHTHOUSE, {});
  const sfx = lines.find((l) => l.kind === 'cue' && l.cue.type === 'sfx');
  assert.equal(sfx.cue.value, 'wooden door creak');
  const pause = lines.find((l) => l.kind === 'cue' && l.cue.type === 'pause');
  assert.equal(pause.cue.value, 1.5);
  const music = lines.find((l) => l.kind === 'cue' && l.cue.type === 'music');
  assert.equal(music.cue.value, 'swell');
});

test('dialogue lines parse speaker, emotion, nonverbal-raw text', () => {
  const { lines } = parseScript(LIGHTHOUSE, {});
  const narratorLine = lines.find((l) => l.kind === 'speech' && l.speaker === 'NARRATOR');
  assert.equal(narratorLine.text, 'The lamp had burned for forty years.');
  assert.equal(narratorLine.emotion, undefined);

  const eli = lines.find((l) => l.speaker === 'ELI');
  assert.equal(eli.emotion, 'scared');
  assert.deepEqual(eli.modifiers, []);
  assert.equal(eli.text, '<breath> Did you hear that?');

  const maya = lines.find((l) => l.speaker === 'MAYA' && l.emotion === 'hushed');
  assert.equal(maya.text, "Don't. Move.");
});

test('unknown speaker gives a line-numbered error suggesting cast', () => {
  const doc = `---\ntitle: X\n---\nNARRATOR: Hi.\nGHOST: Boo!\n`;
  const { errors } = parseScript(doc, {});
  assert.equal(errors.length, 1);
  assert.equal(errors[0].n, 5);
  assert.match(errors[0].message, /GHOST/);
  assert.match(errors[0].message, /cast/i);
});

test('a bad cue gives a line-numbered error', () => {
  const doc = `NARRATOR: Hi.\n[pause soon]\n[frobnicate: x]\n`;
  const { errors } = parseScript(doc, {});
  assert.equal(errors.length, 2);
  assert.equal(errors[0].n, 2);
  assert.match(errors[0].message, /numeric/);
  assert.equal(errors[1].n, 3);
  assert.match(errors[1].message, /Unknown cue type/);
});

test('narration mode: paragraphs become NARRATOR lines, default voice F4', () => {
  const doc = `This is the first paragraph.\nIt wraps onto a second physical line.\n\nThis is the second paragraph.\n`;
  const { meta, lines, errors } = parseScript(doc, {});
  assert.deepEqual(errors, []);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].speaker, 'NARRATOR');
  assert.equal(lines[0].text, 'This is the first paragraph. It wraps onto a second physical line.');
  assert.equal(lines[0].n, 1);
  assert.equal(lines[1].text, 'This is the second paragraph.');
  assert.equal(lines[1].n, 4);
  assert.deepEqual(meta.cast.NARRATOR, { voice: 'F4' });
});

test('per-line lang overrides the document default', () => {
  const doc = `---\ntitle: X\nlang: en\ncast:\n  NARRATOR: { voice: F4 }\n  AMI: { voice: F2 }\n---\nAMI (neutral, lang: es): Hola, como estas?\nNARRATOR: Back to English.\n`;
  const { lines } = parseScript(doc, {});
  const ami = lines.find((l) => l.speaker === 'AMI');
  assert.equal(ami.lang, 'es');
  assert.equal(ami.emotion, 'neutral');
  assert.deepEqual(ami.modifiers, []);
  const narrator = lines.find((l) => l.speaker === 'NARRATOR');
  assert.equal(narrator.lang, 'en');
});

test('"(scared, slow)" splits into emotion and modifiers', () => {
  const doc = `---\ncast:\n  ELI: { voice: M3 }\n---\nELI (scared, slow): Careful now.\n`;
  const { lines } = parseScript(doc, {});
  assert.equal(lines[0].emotion, 'scared');
  assert.deepEqual(lines[0].modifiers, ['slow']);
});

test('no front matter at all still parses as narration', () => {
  const { meta, lines, errors } = parseScript('Just one line of text.\n', {});
  assert.deepEqual(meta.cast.NARRATOR, { voice: 'F4' });
  assert.deepEqual(errors, []);
  assert.equal(lines[0].text, 'Just one line of text.');
});
