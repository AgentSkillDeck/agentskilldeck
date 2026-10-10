import { fetchJson, ServiceError } from '../http.mjs';
import { makeSound, SEARCH_TTL_MS } from './common.mjs';

const API = 'https://api.openverse.org/v1/audio/';
const BACKOFF_MS = 60_000;
// After a 429, skip Openverse for a minute instead of spending more of the anonymous
// quota. Keyed by fetch implementation so tests with fake fetches stay independent.
const blocked = new WeakMap();
const keyOf = (fetchImpl) => fetchImpl ?? globalThis.fetch;

export function openverseUrl(query, { kind, licenses = 'cc0,by', pageSize = 20 } = {}) {
  const p = new URLSearchParams({ q: query, license: licenses, page_size: String(pageSize), mature: 'false' });
  // Openverse only tags `music` reliably; Freesound items (most SFX/ambience) have category null,
  // so filtering sfx/ambience by `sound_effect` would hide most of the catalogue.
  if (kind === 'music') p.set('category', 'music');
  return `${API}?${p}`;
}

export function parseOpenverse(data) {
  return (data?.results ?? []).map((r) => makeSound({
    source: 'openverse', id: r.id, title: r.title, creator: r.creator,
    license: `${r.license ?? ''} ${r.license_version ?? ''}`.trim(), license_url: r.license_url,
    source_url: r.foreign_landing_url, download_url: r.url,
    duration_s: Number.isFinite(r.duration) ? r.duration / 1000 : undefined,
  })).filter(Boolean);
}

export async function searchOpenverse(query, { kind, licenses, fetchImpl, cacheDir } = {}) {
  const key = keyOf(fetchImpl);
  if ((blocked.get(key) ?? 0) > Date.now()) throw new ServiceError('openverse', 'HTTP 429 (rate limited, skipped for a minute)');
  try {
    const data = await fetchJson(openverseUrl(query, { kind, licenses }), { source: 'openverse', fetchImpl, cacheDir, cacheTtlMs: SEARCH_TTL_MS, retries: 0 });
    return parseOpenverse(data);
  } catch (e) {
    if (e instanceof ServiceError && /429/.test(e.message)) blocked.set(key, Date.now() + BACKOFF_MS);
    throw e;
  }
}
