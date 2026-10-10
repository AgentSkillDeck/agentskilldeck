import { fetchText } from './http.mjs';

const DAY = 24 * 60 * 60 * 1000;
const SOURCE = 'Google Fonts popularity';
const METADATA_URL = 'https://fonts.google.com/metadata/fonts';

/**
 * Parse the Google Fonts metadata endpoint's response into a
 * Map<familyLowercase, popularity>. Lower popularity means more popular
 * (Inter is 5, Poppins is 8, an obscure font can be in the thousands).
 *
 * The real endpoint prefixes its JSON body with the anti-XSSI guard `)]}'`;
 * strip anything before the first `{` so this works whether or not the
 * guard is present. Malformed input returns an empty map rather than
 * throwing, so a surprising response degrades to "no popularity data"
 * instead of failing the whole search.
 */
export function parsePopularity(text) {
  const map = new Map();
  const raw = String(text ?? '');
  const start = raw.indexOf('{');
  if (start === -1) return map;
  let data;
  try { data = JSON.parse(raw.slice(start)); } catch { return map; }
  for (const entry of data?.familyMetadataList ?? []) {
    const family = entry?.family;
    const popularity = Number(entry?.popularity);
    if (!family || !Number.isFinite(popularity)) continue;
    map.set(String(family).toLowerCase(), popularity);
  }
  return map;
}

export async function loadPopularity({ fetchImpl, cacheDir } = {}) {
  const text = await fetchText(METADATA_URL, { source: SOURCE, fetchImpl, cacheDir, cacheTtlMs: DAY });
  return parsePopularity(text);
}
