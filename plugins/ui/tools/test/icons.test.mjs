import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { searchIcons } from '../lib/icons.mjs';

const fx = async (n) => JSON.parse(await readFile(new URL(`./fixtures/${n}.json`, import.meta.url)));
const fresh = () => mkdtemp(join(tmpdir(), 'aa-'));

async function fakeFetch() {
  const search = await fx('iconify-search');
  const cols = await fx('iconify-collections');
  const seen = [];
  const fn = async (url) => {
    seen.push(url);
    if (url.includes('/collections')) return new Response(JSON.stringify(cols));
    if (url.includes('/search')) {
      const u = new URL(url);
      const prefixes = u.searchParams.get('prefixes')?.split(',');
      const icons = prefixes ? search.icons.filter((i) => prefixes.includes(i.split(':')[0])) : search.icons;
      return new Response(JSON.stringify({ ...search, icons }));
    }
    throw new Error('unexpected ' + url);
  };
  fn.seen = seen;
  return fn;
}

test('icons come from distinct collections first, with license and snippets', async () => {
  const { results } = await searchIcons('bell', { limit: 3, fetchImpl: await fakeFetch(), cacheDir: await fresh() });
  assert.equal(results.length, 3);
  const prefixes = results.map((r) => r.name.split(':')[0]);
  assert.equal(new Set(prefixes).size, 3);
  for (const r of results) {
    assert.equal(r.source, 'Iconify');
    assert.ok(r.license.id && r.license.url, `license for ${r.name}`);
    assert.match(r.install, /<Icon icon="[a-z0-9-]+:[a-z0-9-]+" \/>/);
    assert.match(r.previewUrl, /^https:\/\/icon-sets\.iconify\.design\//);
  }
});

test('animated restricts to animated collections', async () => {
  const fetchImpl = await fakeFetch();
  const { results } = await searchIcons('bell', { limit: 3, animated: true, fetchImpl, cacheDir: await fresh() });
  assert.ok(results.length >= 1);
  assert.ok(results.every((r) => ['line-md', 'svg-spinners', 'meteocons'].includes(r.name.split(':')[0])));
  assert.ok(fetchImpl.seen.some((u) => u.includes('prefixes=')));
});

test('no icons returns empty results, not an error', async () => {
  const fetchImpl = async (url) => new Response(JSON.stringify(url.includes('/collections') ? {} : { icons: [], collections: {} }));
  const { results } = await searchIcons('zzzz', { limit: 3, fetchImpl, cacheDir: await fresh() });
  assert.deepEqual(results, []);
});
