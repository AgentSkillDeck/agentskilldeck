const STOP = new Set(['a', 'an', 'the', 'for', 'of', 'and', 'or', 'to', 'with', 'in', 'on', 'ui']);

export function tokenize(text) {
  return String(text ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t));
}

export function scoreItem(tokens, fields) {
  let score = 0;
  for (const { text, weight } of fields) {
    const words = tokenize(Array.isArray(text) ? text.join(' ') : text);
    for (const t of tokens) {
      if (words.includes(t)) score += weight * 2;
      else if (words.some((w) => w.length >= 3 && t.length >= 3 && (w.startsWith(t) || t.startsWith(w)))) score += weight;
    }
  }
  return score;
}

export function rank(items, tokens, fieldsOf, limit) {
  return items
    .map((item, i) => ({ item, i, s: scoreItem(tokens, fieldsOf(item)) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.item);
}
