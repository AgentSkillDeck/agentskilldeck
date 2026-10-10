import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchJson, fetchText, ServiceError } from '../lib/http.mjs';

const ok = (body) => new Response(JSON.stringify(body), { status: 200 });
const okText = (body) => new Response(body, { status: 200 });

test('returns parsed JSON', async () => {
  const data = await fetchJson('https://x.test/a', { source: 'X', fetchImpl: async () => ok({ a: 1 }) });
  assert.deepEqual(data, { a: 1 });
});

test('retries once on 503 then succeeds', async () => {
  let calls = 0;
  const fetchImpl = async () => (++calls === 1 ? new Response('', { status: 503 }) : ok({ ok: true }));
  assert.deepEqual(await fetchJson('https://x.test/b', { source: 'X', fetchImpl }), { ok: true });
  assert.equal(calls, 2);
});

test('throws ServiceError naming the source after retries exhausted', async () => {
  const fetchImpl = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(fetchJson('https://x.test/c', { source: 'Iconify', fetchImpl }),
    (e) => e instanceof ServiceError && e.source === 'Iconify' && /fetch failed/.test(e.message));
});

test('404 is not retried', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return new Response('', { status: 404 }); };
  await assert.rejects(fetchJson('https://x.test/d', { source: 'X', fetchImpl }), ServiceError);
  assert.equal(calls, 1);
});

test('cache hit avoids network', async () => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'aa-'));
  let calls = 0;
  const fetchImpl = async () => { calls++; return ok({ v: calls }); };
  const opts = { source: 'X', fetchImpl, cacheTtlMs: 60_000, cacheDir };
  assert.deepEqual(await fetchJson('https://x.test/e', opts), { v: 1 });
  assert.deepEqual(await fetchJson('https://x.test/e', opts), { v: 1 });
  assert.equal(calls, 1);
});

test('corrupt cache file is ignored and refetched', async () => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'aa-'));
  const fetchImpl = async () => ok({ fresh: true });
  const opts = { source: 'X', fetchImpl, cacheTtlMs: 60_000, cacheDir };
  await fetchJson('https://x.test/f', opts);
  const [file] = await readdir(cacheDir);
  await writeFile(join(cacheDir, file), '{"truncat');
  assert.deepEqual(await fetchJson('https://x.test/f', opts), { fresh: true });
});

test('fetchText returns raw text and caches it like fetchJson', async () => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'aa-'));
  let calls = 0;
  const fetchImpl = async () => { calls++; return okText('a,b,c\n1,2,3\n'); };
  const opts = { source: 'X', fetchImpl, cacheTtlMs: 60_000, cacheDir };
  assert.equal(await fetchText('https://x.test/g', opts), 'a,b,c\n1,2,3\n');
  assert.equal(await fetchText('https://x.test/g', opts), 'a,b,c\n1,2,3\n');
  assert.equal(calls, 1);
});

test('fetchText throws ServiceError naming the source after retries exhausted', async () => {
  const fetchImpl = async () => new Response('', { status: 500 });
  await assert.rejects(fetchText('https://x.test/h', { source: 'Google Fonts tags', fetchImpl }),
    (e) => e instanceof ServiceError && e.source === 'Google Fonts tags' && /HTTP 500/.test(e.message));
});

test('default cache dir is per-user', async () => {
  const { DEFAULT_CACHE } = await import('../lib/http.mjs');
  assert.equal(DEFAULT_CACHE, join(tmpdir(), `agentatelier-cache-${process.getuid?.() ?? 'user'}`));
});
