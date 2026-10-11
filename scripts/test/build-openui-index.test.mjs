import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tagsFor, candidates } from '../build-openui-index.mjs';

test('tags include the component, its synonyms and at least two words', () => {
  const t = tagsFor('Dialog');
  assert.ok(t.includes('dialog') && t.includes('modal'));
  assert.ok(tagsFor('Zzz').length >= 2);
});

test('candidates skip curated systems, need https links and rename systems', () => {
  const out = candidates([
    { name: 'Carbon Design System', components: [{ name: 'Button', url: 'https://c.test/b' }] },
    { name: 'U.S. Web Design System (USWDS)', components: [{ name: 'Alert', url: 'http://u.test/a' }, { name: 'Card', url: 'ftp://u.test/c' }, { name: 'Tabs' }] },
  ]);
  assert.deepEqual(out.map((e) => [e.system, e.title, e.url, e.via]), [['USWDS', 'Alert', 'https://u.test/a', 'Open UI']]);
});
