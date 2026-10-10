import { tokenize, rank } from './rank.mjs';

export function searchPatterns(query, { platform, limit, index }) {
  const pool = platform ? index.entries.filter((e) => e.platform.includes(platform)) : index.entries;
  return rank(pool, tokenize(query), (e) => [
    { text: e.title, weight: 4 },
    { text: e.tags, weight: 2 },
    { text: e.system, weight: 1 },
  ], limit).map((e) => ({
    name: `${e.system} — ${e.title}`,
    source: e.system,
    previewUrl: e.url,
    license: { id: 'docs (reference only)', url: e.url },
    install: '',
    notes: `${e.platform.join('/')}; ${e.tags.join(', ')}`,
  }));
}
