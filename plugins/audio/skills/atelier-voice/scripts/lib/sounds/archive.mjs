import { fetchJson } from '../http.mjs';
import { isAllowed } from './license.mjs';
import { makeSound, SEARCH_TTL_MS } from './common.mjs';

const SEARCH = 'https://archive.org/advancedsearch.php';
// Mirrored commercial catalogues carry a licenseurl the uploader cannot grant; never trust them.
const UNTRUSTED_PREFIXES = ['tidal-', 'spotify-', 'soundcloud-', 'deezer-'];
const AUDIO_FORMATS = [/mp3/i, /ogg/i, /flac/i, /wave|wav/i];

const words = (q) => q.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

export function archiveSearchUrl(query, { rows = 30 } = {}) {
  const terms = words(query).join(' ');
  const p = new URLSearchParams({
    q: `title:(${terms}) AND mediatype:audio AND collection:opensource_audio AND licenseurl:[* TO *]`,
    rows: String(rows), output: 'json',
  });
  for (const f of ['identifier', 'title', 'creator', 'licenseurl']) p.append('fl[]', f);
  return `${SEARCH}?${p}`;
}

export const archiveMetaUrl = (id) => `https://archive.org/metadata/${encodeURIComponent(id)}`;

// "32.05", "00:32" or "1:02:03" → seconds
export function parseLength(len) {
  if (len == null) return undefined;
  const s = String(len);
  if (s.includes(':')) return s.split(':').reduce((acc, part) => acc * 60 + Number(part), 0);
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export function allowedDocs(data) {
  return (data?.response?.docs ?? []).filter((d) => d.identifier
    && !UNTRUSTED_PREFIXES.some((p) => d.identifier.startsWith(p))
    && isAllowed(d.licenseurl));
}

export function pickFile(meta) {
  const files = (meta?.files ?? []).filter((f) => f.name && f.format);
  for (const re of AUDIO_FORMATS) {
    const f = files.find((x) => re.test(x.format));
    if (f) return f;
  }
  return undefined;
}

export async function searchArchive(query, { limit = 5, fetchImpl, cacheDir } = {}) {
  const opts = { source: 'archive', fetchImpl, cacheDir, cacheTtlMs: SEARCH_TTL_MS };
  const docs = allowedDocs(await fetchJson(archiveSearchUrl(query), opts)).slice(0, limit);
  const out = [];
  for (const d of docs) {
    let meta;
    try { meta = await fetchJson(archiveMetaUrl(d.identifier), opts); } catch { continue; } // one bad item never sinks the rest
    const file = pickFile(meta);
    if (!file) continue;
    const creator = Array.isArray(d.creator) ? d.creator.join(', ') : d.creator;
    const s = makeSound({
      source: 'archive', id: d.identifier, title: d.title, creator,
      license: d.licenseurl, license_url: d.licenseurl, source_url: `https://archive.org/details/${d.identifier}`,
      download_url: `https://archive.org/download/${encodeURIComponent(d.identifier)}/${file.name.split('/').map(encodeURIComponent).join('/')}`,
      duration_s: parseLength(file.length),
    });
    if (s) out.push(s);
  }
  return out;
}
