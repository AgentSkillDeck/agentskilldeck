import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const live = process.env.LIVE === '1';
test('every patterns.json URL resolves', { skip: !live && 'set LIVE=1' }, async () => {
  const { entries } = JSON.parse(await readFile(new URL('../patterns.json', import.meta.url)));
  const bad = [];
  for (let i = 0; i < entries.length; i += 8) {
    await Promise.all(entries.slice(i, i + 8).map(async ({ url }) => {
      try {
        const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Mozilla/5.0 agentatelier-linkcheck' } });
        if (res.status >= 400) bad.push(`${res.status} ${url}`);
      } catch (e) { bad.push(`ERR ${url} ${e.message}`); }
    }));
  }
  assert.deepEqual(bad, []);
});
