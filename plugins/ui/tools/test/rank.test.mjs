import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, scoreItem, rank } from '../lib/rank.mjs';

test('tokenize lowercases, splits, drops stopwords', () => {
  assert.deepEqual(tokenize('The Geometric-Sans for UI!'), ['geometric', 'sans']);
  assert.deepEqual(tokenize('  !! '), []);
});

test('scoreItem weights exact token hits and partial prefix hits', () => {
  const s1 = scoreItem(['data', 'table'], [{ text: 'Data table', weight: 3 }]);
  const s2 = scoreItem(['data', 'table'], [{ text: 'Database', weight: 3 }]);
  assert.ok(s1 > s2 && s2 > 0);
});

test('rank drops zero scores and respects limit', () => {
  const items = [{ t: 'empty state' }, { t: 'button' }, { t: 'empty list state' }];
  const out = rank(items, ['empty', 'state'], (i) => [{ text: i.t, weight: 1 }], 5);
  assert.deepEqual(out.map((i) => i.t), ['empty state', 'empty list state']);
});
