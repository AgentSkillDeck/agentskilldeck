import { fetchJson, ServiceError } from './http.mjs';
import { loadFontTags } from './fonttags.mjs';
import { loadPopularity } from './popularity.mjs';
import { tokenize, scoreItem } from './rank.mjs';

const DAY = 24 * 60 * 60 * 1000;
const LICENSE_URLS = {
  'OFL-1.1': 'https://openfontlicense.org/',
  'Apache-2.0': 'https://www.apache.org/licenses/LICENSE-2.0',
};

// Google's tag vocabulary files every style tag under a broad group prefix
// (/Sans/Geometric, /Serif/Didone, /Sans/Humanist, ...). That group word
// duplicates what the category field already contributes: scoring it again
// per tag row let a font with several /Sans/* tags rack up a "sans" match
// once per row, on top of its one legitimate category match. Score only
// each tag's leaf (the part after the group), e.g. "/Sans/Geometric" -> the
// field text ["geometric"], "/Sans/Neo Grotesque" -> ["neo", "grotesque"].
const GENERIC_CATEGORY_WORDS = new Set(['sans', 'serif', 'slab', 'script', 'display', 'mono', 'monospace', 'handwriting']);

// A font literally named "Average Sans" or "DM Serif Display" shouldn't
// outrank a canonical style match on a query like "geometric sans" just
// because its own family name happens to restate the generic category word
// the category field already covers. Fall back to the untouched name if
// stripping would leave nothing to score against.
function styleName(name) {
  const kept = tokenize(name).filter((w) => !GENERIC_CATEGORY_WORDS.has(w));
  return kept.length ? kept.join(' ') : name;
}

// scoreItem's generic prefix fallback ("Geo" partially matching "geometric",
// "Sansation" partially matching "sans") is a reasonable heuristic for
// abbreviations, but on a font's own name it rewards coincidental letter
// overlap with no bearing on the font's actual style. Score the family name
// on exact token equality only; weight 4, matching scoreItem's exact-match
// convention of score += weight * 2.
function familyMatchScore(name, tokens) {
  const words = new Set(tokenize(styleName(name)));
  let score = 0;
  for (const t of tokens) if (words.has(t)) score += 8;
  return score;
}

// Tags have only a broad score, not a fixed meaning: weight 3 for a strong
// signal (score >= 70), 2 for a moderate one (40-69), ignore anything
// weaker so unrelated style words don't creep into ranking. Notes show at
// most the 3 highest-scoring, most recognisable style words, skipping the
// /Quality/* bookkeeping tags (concept/drawing/spacing/wordspace aren't
// style words a user would search for).
function styleTags(family, tagsByFamily) {
  const entries = (tagsByFamily?.get(family.toLowerCase()) ?? []).filter(({ score }) => score >= 40);
  const fields = entries.map(({ words, score }) => ({
    text: words[words.length - 1].split(/\s+/),
    weight: score >= 70 ? 3 : 2,
  }));
  const styleWords = [];
  for (const { words, score } of [...entries].sort((a, b) => b.score - a.score)) {
    if (words[0] === 'quality') continue;
    const leaf = words[words.length - 1];
    if (styleWords.includes(leaf)) continue;
    styleWords.push(leaf);
    if (styleWords.length === 3) break;
  }
  return { fields, styleWords };
}

function fromFontsource(f, tagsByFamily) {
  const pkg = f.variable ? `@fontsource-variable/${f.id}` : `@fontsource/${f.id}`;
  const { fields: tagFields, styleWords } = styleTags(f.family, tagsByFamily);
  return {
    name: f.family,
    source: 'Fontsource',
    previewUrl: `https://fontsource.org/fonts/${f.id}`,
    license: { id: f.license, url: LICENSE_URLS[f.license] ?? `https://fontsource.org/fonts/${f.id}` },
    install: `npm i ${pkg}`,
    notes: `${f.category}; weights ${f.weights.join(', ')}${f.variable ? '; variable' : ''}; subsets ${f.subsets.slice(0, 4).join(', ')}${styleWords.length ? `; style: ${styleWords.join(', ')}` : ''}`,
    _familyName: f.family,
    _restFields: [{ text: f.category, weight: 2 }, ...tagFields],
    _category: f.category,
    _popularityKey: f.family.toLowerCase(),
  };
}

function fromFontshare(f) {
  const weights = [...new Set((f.styles ?? []).map((s) => {
    const wt = s.weight;
    return typeof wt === 'number' ? wt : wt?.weight;
  }).filter(Boolean))].sort((a, b) => a - b);
  const w = weights.length ? weights.join(',') : '400,700';
  return {
    name: f.name,
    source: 'Fontshare',
    previewUrl: `https://www.fontshare.com/fonts/${f.slug}`,
    license: { id: 'ITF-FFL', url: 'https://www.fontshare.com/licenses/itf-ffl' },
    install: `<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=${f.slug}@${w}&display=swap">`,
    notes: `${String(f.category).toLowerCase()}; weights ${weights.join(', ') || 'see preview'}; free for commercial use (ITF FFL)`,
    _familyName: f.name,
    _restFields: [
      { text: f.category, weight: 2 },
      { text: (f.font_tags ?? []).map((t) => t.name), weight: 1 },
    ],
    _category: String(f.category).toLowerCase(),
    // Fontshare fonts aren't in Google's catalogue, so their popularity is
    // always unknown; they sort after every font with a known popularity
    // at the same score.
    _popularityKey: f.name.toLowerCase(),
  };
}

const strip = ({ _familyName, _restFields, _category, _popularityKey, ...r }) => r;

export async function searchFonts(query, { limit, category, fetchImpl, cacheDir }) {
  const common = { fetchImpl, cacheDir, cacheTtlMs: DAY };
  const [fs, fsh, tags, popularity] = await Promise.allSettled([
    fetchJson('https://api.fontsource.org/v1/fonts', { ...common, source: 'Fontsource' }),
    fetchJson('https://api.fontshare.com/v2/fonts?limit=200', { ...common, source: 'Fontshare' }),
    loadFontTags(common),
    loadPopularity(common),
  ]);
  const warnings = [];
  const pool = [];
  const tagsByFamily = tags.status === 'fulfilled' ? tags.value : new Map();
  const popularityByFamily = popularity.status === 'fulfilled' ? popularity.value : new Map();
  if (fs.status === 'fulfilled') pool.push(...fs.value.map((f) => fromFontsource(f, tagsByFamily)));
  else {
    const msg = fs.reason.message.replace(/^[^:]*: /, '');
    warnings.push(`${fs.reason.source} unavailable (${msg})`);
  }
  if (fsh.status === 'fulfilled') pool.push(...(fsh.value.fonts ?? []).map(fromFontshare));
  else {
    const msg = fsh.reason.message.replace(/^[^:]*: /, '');
    warnings.push(`${fsh.reason.source} unavailable (${msg})`);
  }
  if (tags.status === 'rejected') {
    const msg = tags.reason.message.replace(/^[^:]*: /, '');
    warnings.push(`${tags.reason.source} unavailable (${msg})`);
  }
  if (popularity.status === 'rejected') {
    const msg = popularity.reason.message.replace(/^[^:]*: /, '');
    warnings.push(`${popularity.reason.source} unavailable (${msg})`);
  }
  if (!pool.length) throw new ServiceError('Fontsource+Fontshare', warnings.join('; '));

  const cat = category?.toLowerCase();
  const filtered = cat ? pool.filter((f) => f._category === cat) : pool;
  const tokens = tokenize(query);
  // Rank by score desc, then popularity asc (more popular first; unknown
  // popularity sorts last), then original catalogue order as a final,
  // stable tie-break. Computed directly here (not via rank()) because
  // rank() has no notion of a secondary sort key.
  const results = filtered
    .map((item, i) => ({
      item,
      i,
      s: familyMatchScore(item._familyName, tokens) + scoreItem(tokens, item._restFields),
      pop: popularityByFamily.get(item._popularityKey) ?? Infinity,
    }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.pop - b.pop || a.i - b.i)
    .slice(0, limit)
    .map((x) => strip(x.item));
  return { results, warnings };
}
