import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchSounds, isAllowed } from '../lib/sounds/index.mjs';

// LIVE=1 only. Searches are cached for a week in the per-user cache, so reruns cost no Openverse quota.
test('live: "rain" returns an allowed result whose download URL resolves', { skip: !process.env.LIVE && 'set LIVE=1' }, async () => {
  const { results, warnings } = await searchSounds('rain', { kind: 'ambience', limit: 2 });
  assert.ok(results.length >= 1, `no results; warnings: ${warnings.join(' | ')}`);
  const s = results[0];
  assert.ok(isAllowed(s.license), s.license);
  assert.match(s.download_url, /^https:\/\//);
  const res = await fetch(s.download_url, { headers: { range: 'bytes=0-1023', 'user-agent': 'agentskilldeck' }, signal: AbortSignal.timeout(20000) });
  assert.ok(res.status === 200 || res.status === 206, `HTTP ${res.status}`);
  assert.doesNotMatch(res.headers.get('content-type') ?? '', /text\/html/);
  await res.body?.cancel();
});
