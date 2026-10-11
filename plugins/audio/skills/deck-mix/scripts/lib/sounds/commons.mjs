import { fetchJson } from '../http.mjs';
import { makeSound, stripHtml, SEARCH_TTL_MS } from './common.mjs';
import { normaliseLicense } from './license.mjs';

// Commons' generic "Public domain" covers many national/age-based PD templates
// that are not worldwide dedications. Accept it only when the file is marked
// with the Public Domain Mark or CC0.
function commonsLicense(short, url) {
  if (normaliseLicense(short)?.id !== 'pd') return short;
  if (/publicdomain\/(mark|zero)/i.test(url)) return url;
  return null;
}

const API = 'https://commons.wikimedia.org/w/api.php';

export function commonsUrl(query, { limit = 20 } = {}) {
  const p = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrsearch: `${query} filetype:audio`, gsrnamespace: '6',
    gsrlimit: String(limit), prop: 'videoinfo', viprop: 'url|size|mediatype|extmetadata',
    viextmetadatafilter: 'ObjectName|Artist|LicenseShortName|LicenseUrl|UsageTerms|AttributionRequired',
  });
  return `${API}?${p}`;
}

export function parseCommons(data) {
  const pages = Object.values(data?.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return pages.map((p) => {
    const vi = p.videoinfo?.[0];
    if (!vi) return null;
    const em = vi.extmetadata ?? {};
    const v = (k) => stripHtml(em[k]?.value);
    const url = vi.url ? vi.url.split('?')[0] : undefined;
    return makeSound({
      source: 'commons', id: p.pageid, title: v('ObjectName') || p.title.replace(/^File:/, ''), creator: v('Artist'),
      license: commonsLicense(v('LicenseShortName'), v('LicenseUrl')), license_url: v('LicenseUrl'), source_url: vi.descriptionurl, download_url: url,
      duration_s: Number(vi.duration),
    });
  }).filter(Boolean);
}

export async function searchCommons(query, { fetchImpl, cacheDir } = {}) {
  const data = await fetchJson(commonsUrl(query), { source: 'commons', fetchImpl, cacheDir, cacheTtlMs: SEARCH_TTL_MS });
  return parseCommons(data);
}
