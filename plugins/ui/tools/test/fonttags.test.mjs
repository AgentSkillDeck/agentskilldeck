import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFontTags } from '../lib/fonttags.mjs';

test('parses a qualifying tag row and lowercases family and words', () => {
  const map = parseFontTags('Poppins,,/Sans/Geometric,100\n');
  assert.deepEqual(map.get('poppins'), [{ words: ['sans', 'geometric'], score: 100 }]);
});

test('skips axis-specific rows (non-empty axis column)', () => {
  const map = parseFontTags([
    'Advent Pro,"wdth,wght@100,100",/Expressive/Active,5',
    'Inter,wght@400,/Expressive/Business,85',
    'Inter,,/Expressive/Calm,80',
  ].join('\n'));
  assert.equal(map.has('advent pro'), false);
  assert.deepEqual(map.get('inter'), [{ words: ['expressive', 'calm'], score: 80 }]);
});

test('handles a quoted family containing a comma', () => {
  const map = parseFontTags('"Noto Sans, Condensed",,/Sans/Grotesque,80\n');
  assert.deepEqual(map.get('noto sans, condensed'), [{ words: ['sans', 'grotesque'], score: 80 }]);
});

test('ignores blank and malformed lines without throwing', () => {
  const map = parseFontTags([
    '',
    'NotEnoughFields,80',
    'NoScore,,/Sans/Geometric,abc',
    'NoLeadingSlash,,Sans/Geometric,80',
    'ABeeZee,,/Expressive/Calm,81',
  ].join('\n'));
  assert.equal(map.has('notenoughfields'), false);
  assert.equal(map.has('noscore'), false);
  assert.equal(map.has('noleadingslash'), false);
  assert.deepEqual(map.get('abeezee'), [{ words: ['expressive', 'calm'], score: 81 }]);
});

test('accumulates multiple qualifying rows for the same family', () => {
  const map = parseFontTags([
    'Nunito,,/Sans/Rounded,100',
    'Nunito,,/Sans/Humanist,20',
    'Nunito,wght@200,/Expressive/Calm,80',
  ].join('\n'));
  assert.deepEqual(map.get('nunito'), [
    { words: ['sans', 'rounded'], score: 100 },
    { words: ['sans', 'humanist'], score: 20 },
  ]);
});
