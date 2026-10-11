import { fetchJson } from '../http.mjs';
import { makeSound, SEARCH_TTL_MS } from './common.mjs';

const API = 'https://freesound.org/apiv2/search/text/';

export function freesoundUrl(query, token, { pageSize = 20 } = {}) {
  const p = new URLSearchParams({
    query, filter: 'license:("Creative Commons 0" OR "Attribution")',
    fields: 'id,name,username,license,url,previews,duration', page_size: String(pageSize), token,
  });
  return `${API}?${p}`;
}

export function parseFreesound(data) {
  return (data?.results ?? []).map((r) => makeSound({
    source: 'freesound', id: r.id, title: r.name, creator: r.username, license: r.license, license_url: r.license,
    source_url: r.url, download_url: r.previews?.['preview-hq-mp3'] ?? r.previews?.['preview-lq-mp3'],
    duration_s: Number(r.duration),
  })).filter(Boolean);
}

export async function searchFreesound(query, { token, fetchImpl, cacheDir } = {}) {
  const data = await fetchJson(freesoundUrl(query, token), { source: 'freesound', fetchImpl, cacheDir, cacheTtlMs: SEARCH_TTL_MS });
  return parseFreesound(data);
}
