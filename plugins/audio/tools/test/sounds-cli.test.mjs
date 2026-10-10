import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '../sounds.mjs';

const OV = JSON.parse(readFileSync(new URL('./fixtures/openverse-rain.json', import.meta.url), 'utf8'));
const work = mkdtempSync(join(tmpdir(), 'aa-sounds-cli-'));
after(() => rmSync(work, { recursive: true, force: true }));
let n = 0;

async function run(argv, fetchImpl) {
  let out = '', err = '';
  const code = await main(argv, { fetchImpl, cacheDir: join(work, `c${n++}`), env: {}, stdout: (s) => { out += s; }, stderr: (s) => { err += s; } });
  return { code, out, err };
}
const ok = async () => new Response(JSON.stringify(OV), { status: 200 });

test('search prints markdown with title, duration, license, attribution and preview URL', async () => {
  const r = await run(['search', 'rain', '--kind', 'ambience', '--limit', '2'], ok);
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /^2 ambience results for "rain"/);
  assert.match(r.out, /1\. \*\*Rain, Moderate, C\*\* \(openverse\)/);
  assert.match(r.out, /Duration: 60\.1 s/);
  assert.match(r.out, /License: CC BY 4\.0 \(https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/\)/);
  assert.match(r.out, /Attribution: "Rain, Moderate, C" by InspectorJ/);
  assert.match(r.out, /Preview: https:\/\/cdn\.freesound\.org\//);
});

test('--json prints the result objects', async () => {
  const r = await run(['search', 'rain', '--json', '--limit', '1'], ok);
  assert.equal(r.code, 0);
  const j = JSON.parse(r.out);
  assert.equal(j.results.length, 1);
  assert.equal(j.kind, 'sfx');
});

test('usage errors exit 1', async () => {
  assert.equal((await run([], ok)).code, 1);
  assert.equal((await run(['search', 'rain', '--kind', 'speech'], ok)).code, 1);
  assert.equal((await run(['search', '  '], ok)).code, 1);
  assert.equal((await run(['search', 'rain', '--limit', 'x'], ok)).code, 1);
});

test('every source down → exit 2 with warnings; one source down → exit 0 with a warning', async () => {
  const down = await run(['search', 'rain'], async () => { throw new TypeError('fetch failed'); });
  assert.equal(down.code, 2);
  assert.match(down.out, /Warning: openverse unavailable/);
  assert.match(down.err, /every sound source failed/);
  const partial = await run(['search', 'rain', '--limit', '1'], async (url) => (String(url).includes('openverse')
    ? new Response('{}', { status: 429 })
    : new Response(readFileSync(new URL('./fixtures/commons-rain.json', import.meta.url)), { status: 200 })));
  assert.equal(partial.code, 0);
  assert.match(partial.out, /\(commons\)/);
  assert.match(partial.out, /Warning: openverse unavailable \(HTTP 429\)/);
});

test('--sources restricts providers; archive only when asked; bad source exits 1', async () => {
  const calls = [];
  const f = async (url) => { calls.push(String(url)); return new Response(JSON.stringify({}), { status: 200 }); };
  const r = await run(['search', 'rain', '--sources', 'commons'], f);
  assert.equal(r.code, 0, r.err);
  assert.ok(calls.length > 0 && calls.every((u) => u.startsWith('https://commons.wikimedia.org/')));
  calls.length = 0;
  await run(['search', 'rain'], f);
  assert.ok(!calls.some((u) => u.includes('archive.org')), 'archive is opt-in');
  assert.equal((await run(['search', 'rain', '--sources', 'nope'], f)).code, 1);
  const down = await run(['search', 'rain', '--sources', 'openverse'], async () => { throw new TypeError('fetch failed'); });
  assert.equal(down.code, 2, 'the only listed source failing is a service error');
});
