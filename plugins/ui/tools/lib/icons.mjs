import { fetchJson } from './http.mjs';

const DAY = 24 * 60 * 60 * 1000;
export const ANIMATED_FALLBACK = ['line-md', 'svg-spinners', 'meteocons'];

async function animatedPrefixes(common, warnings) {
  try {
    const cols = await fetchJson('https://api.iconify.design/collections', { ...common, cacheTtlMs: DAY, source: 'Iconify' });
    const found = Object.entries(cols).filter(([, v]) => (v.tags ?? []).includes('Contains Animations')).map(([k]) => k);
    return found.length ? found : ANIMATED_FALLBACK;
  } catch (e) {
    warnings.push(`Iconify collection list unavailable, using built-in animated sets (${e.message})`);
    return ANIMATED_FALLBACK;
  }
}

function pickDistinct(icons, limit) {
  const byPrefix = new Map();
  for (const id of icons) {
    const p = id.split(':')[0];
    if (!byPrefix.has(p)) byPrefix.set(p, []);
    byPrefix.get(p).push(id);
  }
  const out = [];
  for (let round = 0; out.length < limit; round++) {
    let added = false;
    for (const list of byPrefix.values()) {
      if (list[round] && out.length < limit) { out.push(list[round]); added = true; }
    }
    if (!added) break;
  }
  return out;
}

export async function searchIcons(query, { limit, animated = false, fetchImpl, cacheDir }) {
  const warnings = [];
  const common = { fetchImpl, cacheDir };
  const params = new URLSearchParams({ query, limit: '64' });
  if (animated) params.set('prefixes', (await animatedPrefixes(common, warnings)).join(','));
  const data = await fetchJson(`https://api.iconify.design/search?${params}`, { ...common, source: 'Iconify' });
  const ids = pickDistinct(data.icons ?? [], limit);
  const results = ids.map((id) => {
    const [prefix, name] = id.split(':');
    const col = data.collections?.[prefix] ?? {};
    return {
      name: id,
      source: 'Iconify',
      previewUrl: `https://icon-sets.iconify.design/${prefix}/${name}/`,
      license: { id: col.license?.spdx ?? col.license?.title ?? 'see collection', url: col.license?.url ?? `https://icon-sets.iconify.design/${prefix}/` },
      install: `npm i @iconify/react  →  <Icon icon="${id}" />   ·   SVG: https://api.iconify.design/${prefix}/${name}.svg`,
      notes: `${col.name ?? prefix}${col.author?.name ? ` by ${col.author.name}` : ''}${animated ? '; animated SVG (SMIL/CSS), respect prefers-reduced-motion' : ''}`,
    };
  });
  return { results, warnings };
}
