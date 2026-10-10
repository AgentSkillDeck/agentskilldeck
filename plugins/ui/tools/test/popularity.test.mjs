import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePopularity } from '../lib/popularity.mjs';

test('parses familyMetadataList into a lowercased family -> popularity map', () => {
  const map = parsePopularity(JSON.stringify({
    familyMetadataList: [
      { family: 'Poppins', popularity: 8 },
      { family: 'Montserrat', popularity: 7 },
    ],
  }));
  assert.equal(map.get('poppins'), 8);
  assert.equal(map.get('montserrat'), 7);
});

test('strips the anti-XSSI prefix before the first "{"', () => {
  const map = parsePopularity(")]}'\n" + JSON.stringify({
    familyMetadataList: [{ family: 'Inter', popularity: 5 }],
  }));
  assert.equal(map.get('inter'), 5);
});

test('skips entries missing a family or a finite popularity', () => {
  const map = parsePopularity(JSON.stringify({
    familyMetadataList: [
      { family: 'No Popularity' },
      { popularity: 10 },
      { family: 'Bad Popularity', popularity: 'oops' },
      { family: 'Good', popularity: 42 },
    ],
  }));
  assert.equal(map.has('no popularity'), false);
  assert.equal(map.has('bad popularity'), false);
  assert.equal(map.get('good'), 42);
});

test('returns an empty map for malformed input rather than throwing', () => {
  assert.deepEqual(parsePopularity('not json at all'), new Map());
  assert.deepEqual(parsePopularity(''), new Map());
});
