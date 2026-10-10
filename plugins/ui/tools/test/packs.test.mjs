import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { searchPacks } from '../lib/packs.mjs';

const fx = JSON.parse(await readFile(new URL('./fixtures/shadcn-registries.json', import.meta.url)));
const fetchImpl = async () => new Response(JSON.stringify(fx));
const fresh = () => mkdtemp(join(tmpdir(), 'aa-'));

test('matches registries by description and gives an add command', async () => {
  const word = fx.find((r) => r.description)?.description.split(/\s+/).find((w) => w.length > 6).replace(/\W/g, '');
  const { results } = await searchPacks(word, { limit: 3, fetchImpl, cacheDir: await fresh() });
  assert.ok(results.length >= 1);
  const r = results[0];
  assert.equal(r.source, 'shadcn registry');
  assert.match(r.install, /^npx shadcn@latest add @[^/]+\/<item>/);
  assert.ok(r.previewUrl.startsWith('http'));
  assert.equal(r.license.id, 'check registry');
});

test('unavailable registries are excluded', async () => {
  const bad = [{ name: '@broken', homepage: 'https://b.test', description: 'calendar components', health: { status: 'unavailable', score: 3 } }];
  const { results } = await searchPacks('calendar', { limit: 3, fetchImpl: async () => new Response(JSON.stringify(bad)), cacheDir: await fresh() });
  assert.deepEqual(results, []);
});

test('degraded registries are returned with degraded noted', async () => {
  const shaky = [{ name: '@shaky', homepage: 'https://s.test', description: 'calendar components', health: { status: 'degraded', score: 55 } }];
  const { results } = await searchPacks('calendar', { limit: 3, fetchImpl: async () => new Response(JSON.stringify(shaky)), cacheDir: await fresh() });
  assert.equal(results.length, 1);
  assert.match(results[0].notes, /degraded/);
});
