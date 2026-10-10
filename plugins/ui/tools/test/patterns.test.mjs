import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { searchPatterns } from '../lib/patterns.mjs';

const index = {
  version: 1,
  entries: [
    { system: 'GOV.UK Design System', title: 'Error summary', url: 'https://e.test/1', platform: ['web'], tags: ['form', 'validation', 'error'] },
    { system: 'Apple HIG', title: 'Sheets', url: 'https://e.test/2', platform: ['ios'], tags: ['modal', 'sheet'] },
    { system: 'Material 3', title: 'Bottom sheets', url: 'https://e.test/3', platform: ['android', 'web'], tags: ['modal', 'sheet'] },
  ],
};

test('ranks by title and tags', () => {
  const r = searchPatterns('form error validation', { limit: 3, index });
  assert.equal(r[0].name, 'GOV.UK Design System — Error summary');
});

test('platform filter applies', () => {
  const r = searchPatterns('sheet', { platform: 'ios', limit: 3, index });
  assert.deepEqual(r.map((x) => x.previewUrl), ['https://e.test/2']);
});

test('shipped index is valid and broad', async () => {
  const real = JSON.parse(await readFile(new URL('../patterns.json', import.meta.url)));
  assert.equal(real.version, 1);
  assert.ok(real.entries.length >= 120, `only ${real.entries.length} entries`);
  const systems = new Set(real.entries.map((e) => e.system));
  assert.ok(systems.size >= 10, `only ${systems.size} systems`);
  const urls = new Set();
  for (const e of real.entries) {
    assert.match(e.url, /^https:\/\//);
    assert.ok(!urls.has(e.url), `duplicate ${e.url}`);
    urls.add(e.url);
    assert.ok(e.platform.every((p) => ['web', 'ios', 'android'].includes(p)));
    assert.ok(e.tags.length >= 2, `tags for ${e.url}`);
  }
});
