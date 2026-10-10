import { fetchText } from './http.mjs';

const DAY = 24 * 60 * 60 * 1000;
const SOURCE = 'Google Fonts tags';
const TAGS_URL = 'https://raw.githubusercontent.com/google/fonts/main/tags/all/families.csv';

// Minimal CSV field splitter: handles double-quoted fields, embedded commas
// inside quotes and doubled-quote escaping ("" -> "). Good enough for the
// Google Fonts tags export; this is not a general CSV parser.
function splitCsvLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { fields.push(cur); cur = ''; }
    else cur += c;
  }
  fields.push(cur);
  return fields;
}

/**
 * Parse the Google Fonts tags CSV (`Family,axis,/Group/Tag,score`) into a
 * Map<familyLowercase, Array<{ words: string[], score: number }>>.
 * Axis-specific rows (non-empty axis column), the header, blank and
 * malformed lines are skipped.
 */
export function parseFontTags(csvText) {
  // Lines are split before quote-aware parsing, so a quoted field containing
  // an embedded newline is not supported (not needed for this export: family
  // names and tags don't contain newlines).
  const map = new Map();
  for (const line of String(csvText ?? '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const fields = splitCsvLine(line);
    if (fields.length !== 4) continue;
    const [family, axis, tag, scoreText] = fields;
    if (!family.trim() || family.trim().toLowerCase() === 'family') continue;
    if (axis.trim()) continue;
    if (!tag.startsWith('/')) continue;
    const score = Number(scoreText);
    if (!Number.isFinite(score)) continue;
    const words = tag.split('/').slice(1).map((w) => w.toLowerCase()).filter(Boolean);
    if (!words.length) continue;
    const key = family.toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ words, score });
  }
  return map;
}

export async function loadFontTags({ fetchImpl, cacheDir } = {}) {
  const csv = await fetchText(TAGS_URL, { source: SOURCE, fetchImpl, cacheDir, cacheTtlMs: DAY });
  return parseFontTags(csv);
}
