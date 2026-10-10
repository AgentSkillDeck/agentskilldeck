import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { searchFonts } from '../lib/fonts.mjs';

const fx = async (n) => JSON.parse(await readFile(new URL(`./fixtures/${n}.json`, import.meta.url)));
const routes = async () => ({ fontsource: await fx('fontsource'), fontshare: await fx('fontshare') });

function fakeFetch(r, { failFontshare = false } = {}) {
  return async (url) => {
    if (url.includes('fontsource')) return new Response(JSON.stringify(r.fontsource));
    if (url.includes('fontshare')) return failFontshare ? new Response('', { status: 503 }) : new Response(JSON.stringify(r.fontshare));
    throw new Error('unexpected ' + url);
  };
}
const fresh = () => mkdtemp(join(tmpdir(), 'aa-'));

test('finds a Fontsource font by family with license and npm install', async () => {
  const { results } = await searchFonts('inter', { limit: 3, fetchImpl: fakeFetch(await routes()), cacheDir: await fresh() });
  const inter = results.find((r) => r.name === 'Inter');
  assert.ok(inter);
  assert.equal(inter.source, 'Fontsource');
  assert.equal(inter.license.id, 'OFL-1.1');
  assert.match(inter.install, /^npm i @fontsource(-variable)?\/inter$/);
  assert.equal(inter.previewUrl, 'https://fontsource.org/fonts/inter');
});

test('finds a Fontshare font with ITF license and CSS link install', async () => {
  const { results } = await searchFonts('satoshi', { limit: 3, fetchImpl: fakeFetch(await routes()), cacheDir: await fresh() });
  const s = results.find((r) => r.name === 'Satoshi');
  assert.ok(s);
  assert.equal(s.license.id, 'ITF-FFL');
  assert.equal(s.license.url, 'https://www.fontshare.com/licenses/itf-ffl');
  assert.match(s.install, /f\[\]=satoshi@\d+(,\d+)*&display=swap/);
  assert.match(s.notes, /weights \d+/);
  assert.ok(!s.install.includes('[object'), 'install should not contain [object');
  assert.ok(!s.notes.includes('[object'), 'notes should not contain [object');
});

test('category filter restricts results', async () => {
  const { results } = await searchFonts('display', { limit: 5, category: 'serif', fetchImpl: fakeFetch(await routes()), cacheDir: await fresh() });
  assert.ok(results.length > 0);
  assert.ok(results.every((r) => /serif/i.test(r.notes)));
});

test('one source down: results from the other plus a warning', async () => {
  const { results, warnings } = await searchFonts('inter', { limit: 3, fetchImpl: fakeFetch(await routes(), { failFontshare: true }), cacheDir: await fresh() });
  assert.ok(results.some((r) => r.name === 'Inter'));
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Fontshare/);
});

test('all sources down throws ServiceError', async () => {
  const fetchImpl = async () => new Response('', { status: 500 });
  await assert.rejects(searchFonts('inter', { limit: 3, fetchImpl, cacheDir: await fresh() }), { name: 'ServiceError' });
});
