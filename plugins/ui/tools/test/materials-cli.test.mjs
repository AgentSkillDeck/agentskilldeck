import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '../materials.mjs';

const fx = async (n) => JSON.parse(await readFile(new URL(`./fixtures/${n}.json`, import.meta.url)));
const fxText = async (n) => readFile(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const fixtures = {
  fontsource: await fx('fontsource'), fontshare: await fx('fontshare'),
  search: await fx('iconify-search'), collections: await fx('iconify-collections'),
  registries: await fx('shadcn-registries'), tags: await fxText('font-tags.csv'),
};
const fetchImpl = async (url) => {
  if (url.includes('families.csv')) return new Response(fixtures.tags);
  const body = url.includes('fontsource') ? fixtures.fontsource
    : url.includes('fontshare') ? fixtures.fontshare
    : url.includes('/collections') ? fixtures.collections
    : url.includes('/search') ? fixtures.search
    : url.includes('registries') ? fixtures.registries : null;
  return body ? new Response(JSON.stringify(body)) : new Response('', { status: 404 });
};

async function run(args, f = fetchImpl) {
  let out = '', err = '';
  const code = await main(args, { fetchImpl: f, cacheDir: await mkdtemp(join(tmpdir(), 'aa-')), stdout: (s) => (out += s), stderr: (s) => (err += s) });
  return { code, out, err };
}

test('font search prints markdown with license and install', async () => {
  const { code, out } = await run(['font', 'inter']);
  assert.equal(code, 0);
  assert.match(out, /Inter/);
  assert.match(out, /License: OFL-1\.1/);
  assert.match(out, /npm i @fontsource/);
});

test('--json prints parseable JSON', async () => {
  const { code, out } = await run(['icon', 'bell', '--json', '--limit', '2']);
  assert.equal(code, 0);
  const parsed = JSON.parse(out);
  assert.equal(parsed.results.length, 2);
});

test('no match is exit 0 with explicit message', async () => {
  const { code, out } = await run(['font', 'qqqqzzzz']);
  assert.equal(code, 0);
  assert.match(out, /No match/);
});

test('service failure is exit 2 naming the source', async () => {
  const { code, err } = await run(['icon', 'bell'], async () => new Response('', { status: 500 }));
  assert.equal(code, 2);
  assert.match(err, /Iconify/);
});

test('usage errors are exit 1', async () => {
  for (const args of [[], ['font'], ['sticker', 'x'], ['font', '!!'], ['font', '   '], ['font', 'inter', '--limit', 'abc']]) {
    const { code, err } = await run(args);
    assert.equal(code, 1, `args ${JSON.stringify(args)}`);
    assert.match(err, /Usage/);
  }
});

test('--limit is clamped to 1..5', async () => {
  const hi = JSON.parse((await run(['icon', 'bell', '--json', '--limit', '9'])).out);
  assert.ok(hi.results.length <= 5);
  const lo = JSON.parse((await run(['icon', 'bell', '--json', '--limit', '0'])).out);
  assert.equal(lo.results.length, 1);
});
