import { fetchJson, ServiceError } from './http.mjs';
import { tokenize, rank } from './rank.mjs';

const DAY = 24 * 60 * 60 * 1000;
const LICENSE_URLS = {
  'OFL-1.1': 'https://openfontlicense.org/',
  'Apache-2.0': 'https://www.apache.org/licenses/LICENSE-2.0',
};

function fromFontsource(f) {
  const pkg = f.variable ? `@fontsource-variable/${f.id}` : `@fontsource/${f.id}`;
  return {
    name: f.family,
    source: 'Fontsource',
    previewUrl: `https://fontsource.org/fonts/${f.id}`,
    license: { id: f.license, url: LICENSE_URLS[f.license] ?? `https://fontsource.org/fonts/${f.id}` },
    install: `npm i ${pkg}`,
    notes: `${f.category}; weights ${f.weights.join(', ')}${f.variable ? '; variable' : ''}; subsets ${f.subsets.slice(0, 4).join(', ')}`,
    _fields: [{ text: f.family, weight: 4 }, { text: f.category, weight: 2 }],
    _category: f.category,
  };
}

function fromFontshare(f) {
  const weights = [...new Set((f.styles ?? []).map((s) => s.weight).filter(Boolean))].sort((a, b) => a - b);
  const w = weights.length ? weights.join(',') : '400,700';
  return {
    name: f.name,
    source: 'Fontshare',
    previewUrl: `https://www.fontshare.com/fonts/${f.slug}`,
    license: { id: 'ITF-FFL', url: 'https://www.fontshare.com/licenses/itf-ffl' },
    install: `<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=${f.slug}@${w}&display=swap">`,
    notes: `${String(f.category).toLowerCase()}; weights ${weights.join(', ') || 'see preview'}; free for commercial use (ITF FFL)`,
    _fields: [
      { text: f.name, weight: 4 },
      { text: f.category, weight: 2 },
      { text: (f.font_tags ?? []).map((t) => t.name), weight: 1 },
    ],
    _category: String(f.category).toLowerCase(),
  };
}

const strip = ({ _fields, _category, ...r }) => r;

export async function searchFonts(query, { limit, category, fetchImpl, cacheDir }) {
  const common = { fetchImpl, cacheDir, cacheTtlMs: DAY };
  const [fs, fsh] = await Promise.allSettled([
    fetchJson('https://api.fontsource.org/v1/fonts', { ...common, source: 'Fontsource' }),
    fetchJson('https://api.fontshare.com/v2/fonts?limit=200', { ...common, source: 'Fontshare' }),
  ]);
  const warnings = [];
  const pool = [];
  if (fs.status === 'fulfilled') pool.push(...fs.value.map(fromFontsource));
  else warnings.push(`Fontsource unavailable (${fs.reason.message})`);
  if (fsh.status === 'fulfilled') pool.push(...(fsh.value.fonts ?? []).map(fromFontshare));
  else warnings.push(`Fontshare unavailable (${fsh.reason.message})`);
  if (!pool.length) throw new ServiceError('Fontsource+Fontshare', warnings.join('; '));

  const cat = category?.toLowerCase();
  const filtered = cat ? pool.filter((f) => f._category === cat) : pool;
  const results = rank(filtered, tokenize(query), (f) => f._fields, limit).map(strip);
  return { results, warnings };
}
