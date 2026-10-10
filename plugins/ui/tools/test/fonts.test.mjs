import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { searchFonts } from '../lib/fonts.mjs';

const fx = async (n) => JSON.parse(await readFile(new URL(`./fixtures/${n}.json`, import.meta.url)));
const fxText = async (n) => readFile(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const routes = async () => ({ fontsource: await fx('fontsource'), fontshare: await fx('fontshare'), tags: await fxText('font-tags.csv') });

function fakeFetch(r, { failFontshare = false, failTags = false } = {}) {
  return async (url) => {
    if (url.includes('fontsource')) return new Response(JSON.stringify(r.fontsource));
    if (url.includes('fontshare')) return failFontshare ? new Response('', { status: 503 }) : new Response(JSON.stringify(r.fontshare));
    if (url.includes('families.csv')) return failTags ? new Response('', { status: 503 }) : new Response(r.tags);
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
  assert.match(s.install, /f\[\]=satoshi@\d{3}(,\d{3})*&display=swap/);
  assert.match(s.notes, /weights \d{3}/);
  assert.match(s.install, /@300,400,500,700,900&/);
  assert.ok(!s.install.includes('[object'), 'install should not contain [object');
  assert.ok(!s.notes.includes('[object'), 'notes should not contain [object');
});

test('category filter restricts results', async () => {
  // "transitional" (a real /Serif/Transitional tag), not "display": "display" is
  // a generic category word now stripped from family-name scoring (see the
  // "merely sans-named" tests below), so it would no longer match "DM Serif
  // Display" by family name alone.
  const { results } = await searchFonts('transitional', { limit: 5, category: 'serif', fetchImpl: fakeFetch(await routes()), cacheDir: await fresh() });
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

test('"geometric mono" ranks the geometric-tagged monospace font first', async () => {
  // "mono" disambiguates from the other geometric-tagged sans fixtures
  // (Poppins, Montserrat, Cal Sans, DM Sans, Quicksand) added below, via a
  // partial match against JetBrains Mono's own "monospace" category.
  const { results } = await searchFonts('geometric mono', { limit: 3, fetchImpl: fakeFetch(await routes()), cacheDir: await fresh() });
  assert.ok(results.length > 0);
  assert.equal(results[0].name, 'JetBrains Mono');
  assert.match(results[0].notes, /geometric/);
});

test('"geometric sans" ranks canonical geometric fonts ahead of a merely sans-named font', async () => {
  // Average Sans only carries /Sans/Geometric at score 50 (moderate, weight
  // 2); Poppins, Montserrat, Cal Sans, DM Sans and Quicksand carry it at
  // score 100 (strong, weight 3). Before the fix, "Sans" baked into the
  // family name and into every /Sans/* tag's group word both matched the
  // query's "sans" token redundantly, letting Average Sans (and other
  // generically "X Sans"-named fonts) out-rank the real geometric faces.
  const { results } = await searchFonts('geometric sans', { limit: 10, fetchImpl: fakeFetch(await routes()), cacheDir: await fresh() });
  const names = results.map((r) => r.name);
  const indexOf = (n) => names.indexOf(n);
  assert.ok(indexOf('Poppins') !== -1, 'Poppins should be in the results');
  assert.ok(indexOf('Montserrat') !== -1, 'Montserrat should be in the results');
  const averageSansIndex = indexOf('Average Sans');
  assert.ok(averageSansIndex === -1 || indexOf('Poppins') < averageSansIndex, 'Poppins should outrank Average Sans');
  assert.ok(averageSansIndex === -1 || indexOf('Montserrat') < averageSansIndex, 'Montserrat should outrank Average Sans');
});

test('"rounded sans" puts an actually-rounded font first, not a merely sans-named one', async () => {
  const { results } = await searchFonts('rounded sans', { limit: 5, fetchImpl: fakeFetch(await routes()), cacheDir: await fresh() });
  assert.ok(['Nunito', 'Quicksand'].includes(results[0].name));
});

test('"humanist sans" puts the /Sans/Humanist-tagged font first', async () => {
  const { results } = await searchFonts('humanist sans', { limit: 5, fetchImpl: fakeFetch(await routes()), cacheDir: await fresh() });
  assert.equal(results[0].name, 'Open Sans');
  assert.match(results[0].notes, /humanist/);
});

test('"geometric sans" and "rounded sans" give different top results', async () => {
  const geometric = await searchFonts('geometric sans', { limit: 3, fetchImpl: fakeFetch(await routes()), cacheDir: await fresh() });
  const rounded = await searchFonts('rounded sans', { limit: 3, fetchImpl: fakeFetch(await routes()), cacheDir: await fresh() });
  assert.notEqual(geometric.results[0].name, rounded.results[0].name);
});

test('Google Fonts tags fetch failure: results still returned, with a warning', async () => {
  const { results, warnings } = await searchFonts('inter', {
    limit: 3, fetchImpl: fakeFetch(await routes(), { failTags: true }), cacheDir: await fresh(),
  });
  assert.ok(results.some((r) => r.name === 'Inter'));
  assert.ok(warnings.some((w) => /Google Fonts tags unavailable/.test(w)));
});
