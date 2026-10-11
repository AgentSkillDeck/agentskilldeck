import { inflectionsOf } from './nonverbal.mjs';

// Transcript QA and retakes (spec §8 step 4): faster-whisper transcribes
// every rendered line; this module scores it against the script text and
// decides which lines need a re-render.

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function numberToWords(n) {
  if (n < 20) return ONES[n];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const r = n % 10;
    return r === 0 ? TENS[t] : `${TENS[t]} ${ONES[r]}`;
  }
  if (n === 100) return 'one hundred';
  return String(n);
}

// Years (e.g. 1990, 2024) are read as two two-digit groups: "nineteen
// ninety", "twenty twenty-four" (hyphen stripped by normalisation elsewhere).
function yearToWords(n) {
  const first = Math.floor(n / 100);
  const second = n % 100;
  if (second === 0) return `${numberToWords(first)} hundred`;
  const secondWords = second < 10 ? `oh ${ONES[second]}` : numberToWords(second);
  return `${numberToWords(first)} ${secondWords}`;
}

function digitsToWords(numStr) {
  const n = Number(numStr);
  if (numStr.length === 4 && n >= 1000 && n <= 9999) return yearToWords(n);
  if (n >= 0 && n <= 100) return numberToWords(n);
  return numStr;
}

function isEnglish(lang) {
  return !lang || lang === 'en' || lang.startsWith('en');
}

const TITLES = { dr: 'doctor', mr: 'mister', mrs: 'missus', prof: 'professor' };

export function normaliseForWer(s, lang = 'en') {
  let t = String(s ?? '').toLowerCase();
  t = t.replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ');
  if (isEnglish(lang)) {
    t = t.replace(/\b\d+\b/g, (m) => digitsToWords(m));
    t = t.replace(/\b(dr|mr|mrs|prof)\b/g, (m) => TITLES[m]); // whisper abbreviates titles the script spells out
  }
  return t.replace(/\s+/g, ' ').trim();
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function wer(ref, hyp) {
  const r = String(ref ?? '').split(/\s+/).filter(Boolean);
  const h = String(hyp ?? '').split(/\s+/).filter(Boolean);
  if (r.length === 0) return h.length === 0 ? 0 : 1;
  return levenshtein(r, h) / r.length;
}

// Tag words/aliases that must never be *heard* once a line's nonverbal tags
// have been spliced out (global-constraints review focus #1).
export const DEFAULT_TAG_WORDS = ['laugh', 'breath', 'breathe', 'sigh', 'gasp', 'sob', 'cough', 'scream', 'giggle', 'chuckle', 'sneeze', 'groan', 'yawn'];

// "laughs", "laughing", "laughter", "sighing", "breathes"... all count as the tag.
const tagVariants = (word) => inflectionsOf(word);

// British vs American spelling (whisper writes American): favourite/favorite,
// colour/color, realise/realize. Only words longer than four letters, so
// "four"/"for" and "hour" stay distinct.
const spelling = (w) => (w.length > 4 ? w.replace(/our(?=s?$|ed$|ing$|ite|ites$|ful|able)/, 'or').replace(/is(e|es|ed|ing|ation)$/, 'iz$1') : w);

// "good night" vs "goodnight", "fire fly" vs "firefly": join adjacent words on
// one side when the pair is a single word on the other.
function joinCompounds(words, other) {
  const set = new Set(other);
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const pair = i + 1 < words.length ? words[i] + words[i + 1] : null;
    if (pair && set.has(pair) && !(set.has(words[i]) && set.has(words[i + 1]))) { out.push(pair); i++; } else out.push(words[i]);
  }
  return out;
}

// Character edit distance (for near-miss spellings of names).
function charDistance(a, b) {
  return levenshtein([...a], [...b]);
}

// Names in the script (capitalised words after the first word of a sentence):
// whisper spells unfamiliar names its own way ("Stamford" as "Stomford").
export function scriptNames(text, lang = 'en') {
  const names = new Set();
  for (const sentence of String(text ?? '').replace(/<[^>]*>/g, ' ').split(/[.!?]+/)) {
    const words = sentence.trim().split(/\s+/).filter(Boolean);
    words.slice(1).forEach((w) => { if (/^\p{Lu}/u.test(w)) names.add(normaliseForWer(w, lang)); });
  }
  names.delete('');
  return names;
}

export function alignForWer(refNorm, hypNorm, names = new Set()) {
  let r = refNorm.split(' ').filter(Boolean).map(spelling);
  let h = hypNorm.split(' ').filter(Boolean).map(spelling);
  const refSet = new Set(r);
  h = h.map((w) => {
    if (refSet.has(w)) return w;
    for (const n of names) if (n.length >= 4 && charDistance(w, n) <= (n.length >= 7 ? 2 : 1)) return n;
    return w;
  });
  h = joinCompounds(h, r);
  r = joinCompounds(r, h);
  return [r.join(' '), h.join(' ')];
}

// The writing system most of a string's letters belong to (Latin, Devanagari, Arabic, Han...).
const SCRIPTS = ['Latin', 'Devanagari', 'Arabic', 'Han', 'Hiragana', 'Katakana', 'Hangul', 'Cyrillic', 'Greek', 'Thai', 'Hebrew', 'Bengali'];
// Japanese mixes kanji and kana in one sentence, so Han, Hiragana and Katakana count as one.
const scriptOf = (ch) => { const sc = SCRIPTS.find((x) => new RegExp(`\\p{Script=${x}}`, 'u').test(ch)); return sc === 'Hiragana' || sc === 'Katakana' ? 'Han' : sc; };
function mainScript(s) {
  const counts = {};
  for (const ch of String(s)) { const sc = scriptOf(ch); if (sc) counts[sc] = (counts[sc] ?? 0) + 1; }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best?.[0] ?? null;
}
function scriptShare(s, script) {
  let all = 0;
  let hit = 0;
  for (const ch of String(s)) { const sc = scriptOf(ch); if (sc) { all++; if (sc === script) hit++; } }
  return all ? hit / all : 1;
}

// Word index (in the normalised script words) of each run of engine tags in a
// line's text: "Ha. <laugh> <laugh> Fine, then. <yawn> Night." → [1, 3]. The
// planner stores it on the speech item as `native_at`.
const TAG_RE = /<([a-z-]+)>/gi;
export function nativePositions(text, lang = 'en') {
  const t = String(text ?? '');
  const out = [];
  let words = 0;
  let last = 0;
  for (const m of t.matchAll(TAG_RE)) {
    words += normaliseForWer(t.slice(last, m.index), lang).split(' ').filter(Boolean).length;
    last = m.index + m[0].length;
    if (out[out.length - 1] !== words) out.push(words);
  }
  return out;
}

// The tag at each position, for messages ("the inline sigh").
function tagsAt(text, lang) {
  const t = String(text ?? '');
  const out = new Map();
  let words = 0;
  let last = 0;
  for (const m of t.matchAll(TAG_RE)) {
    words += normaliseForWer(t.slice(last, m.index), lang).split(' ').filter(Boolean).length;
    last = m.index + m[0].length;
    if (!out.has(words)) out.set(words, m[1].toLowerCase());
  }
  return out;
}

// Edit-distance alignment of two word lists. Returns every inserted hyp word
// with the ref position it sits at (0 = before the first ref word), and every
// ref word that was not heard at all ({deleted: index}).
function alignOps(ref, hyp) {
  const m = ref.length;
  const n = hyp.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = ref[i - 1] === hyp[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  const out = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && ref[i - 1] === hyp[j - 1] && dp[i][j] === dp[i - 1][j - 1]) { i--; j--; }
    else if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) { out.push({ at: i, word: hyp[j - 1] }); j--; }
    else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) { i--; j--; }
    else { out.push({ deleted: i - 1, word: ref[i - 1] }); i--; }
  }
  return out.reverse();
}

// What whisper writes for an engine tag that came out as speech, beyond the
// tag word itself: "Reth"/"Bref" (breath), "So"/"S.I."/"aside"/"Sai" (sigh),
// "Laf" (laugh), "Cof" (cough), "Yon" (yawn), "Hm" (hmm). Checked on words the
// script does not have, on lines that sent engine tags.
const ARTEFACT_RE = /^(reth|brea|bref|sigh|sai|laf|lau|cof|cough|yawn|yon)|^(so|si|side|aside|hm+)$/;
// Sounds whisper writes for a tag that worked: allowed at that tag's position.
const SOUND_RE = { laugh: /^(ha+|ha(ha)+h?|heh|he(he)+|hah)$/, hmm: /^(h+m+|m+h*m+|mhm)$/ };

export function checkLine({ text, tagWords, lang = 'en', native_at: nativeAt } = {}, asr) {
  const problems = [];
  const hypRaw = typeof asr === 'string' ? asr : asr?.text ?? '';
  // An inline engine tag (nonverbals: auto keeps native tags in the text) is a
  // sound, not a word: it must not be expected in the transcript.
  const refNorm = normaliseForWer(String(text ?? '').replace(/<[^>]*>/g, ' '), lang);
  const hypNorm = normaliseForWer(hypRaw, lang);
  const refWords = refNorm.split(' ').filter(Boolean);
  const hypWords = hypNorm.split(' ').filter(Boolean);

  const words = tagWords && tagWords.length ? tagWords : DEFAULT_TAG_WORDS;
  const seenTags = new Set();
  for (const w of words) {
    const variants = tagVariants(w);
    const key = variants[0];
    if (seenTags.has(key)) continue; // "breath" and "breathe" are one check
    seenTags.add(key);
    const inHyp = variants.some((v) => hypWords.includes(v));
    const inRef = variants.some((v) => refWords.includes(v));
    if (inHyp && !inRef) problems.push(`spoken tag "${w.toLowerCase()}"`);
  }

  // A native <hmm> or <laugh> is a sound whisper may write as "Hmm" or "Ha ha":
  // not an extra word.
  const sounds = Object.entries(SOUND_RE).filter(([t]) => new RegExp(`<${t}>`, 'i').test(String(text ?? ''))).map(([, re]) => re);
  const isSound = (w) => sounds.some((re) => re.test(w));
  const hasHmm = sounds.includes(SOUND_RE.hmm);
  const hypForWer = sounds.length ? hypWords.filter((w) => !isSound(w)).join(' ') : hypNorm;
  const [refAligned, hypAligned] = alignForWer(refNorm, hypForWer, scriptNames(text, lang));
  const werValue = wer(refAligned, hypAligned);
  const threshold = isEnglish(lang) ? 0.15 : 0.30;

  // Engine tags voiced as words: a word inserted where a tag sat (between the
  // script words either side of it) fails, whatever it is; a word the script
  // does not have that looks like a tag artefact fails anywhere on the line.
  const tagAt = tagsAt(text, lang);
  const positions = nativeAt ?? [...tagAt.keys()];
  if (positions.length) {
    // Window positions are in script words; compound joins (alignForWer) can
    // merge two script words, so align on the joined lists and map back.
    const ra = refAligned.split(' ').filter(Boolean);
    const ha = hypAligned.split(' ').filter(Boolean);
    const refIndexMap = mapJoined(refWords.map(spelling), ra);
    const windows = new Map(positions.map((p) => [refIndexMap(p), tagAt.get(p) ?? 'tag']));
    const raSet = new Set(ra);
    const flagged = new Set();
    for (const ins of alignOps(ra, ha)) {
      if (ins.deleted !== undefined) {
        // A script word right next to a tag that was not heard: the tag swallowed it.
        const tag = windows.get(ins.deleted + 1) ?? windows.get(ins.deleted);
        if (tag !== undefined) problems.push(`word "${ins.word}" next to the inline ${tag} was not heard (swallowed by the ${tag})`);
        continue;
      }
      const tag = windows.get(ins.at);
      if (tag === undefined) continue;
      if (SOUND_RE[tag]?.test(ins.word)) continue;
      flagged.add(ins.word);
      problems.push(`inserted word "${ins.word}" where the inline ${tag} was (the ${tag} was voiced as a word)`);
    }
    for (const w of ha) {
      if (raSet.has(w) || flagged.has(w) || !ARTEFACT_RE.test(w)) continue;
      if (hasHmm && SOUND_RE.hmm.test(w)) continue;
      flagged.add(w);
      problems.push(`word "${w}" sounds like a spoken tag (inline ${[...new Set(windows.values())].join('/')})`);
    }
  }

  const notes = [];
  const refScript = mainScript(refNorm);
  const otherScript = !isEnglish(lang) && refScript && scriptShare(hypNorm, refScript) < 0.5;
  if (refWords.length > 0 && hypWords.length === 0) {
    problems.push('empty transcript');
  } else if (otherScript) {
    // whisper base often writes Hindi in Urdu (Arabic) script: same speech,
    // different alphabet, so word error rate means nothing. Tag checks still ran.
    notes.push(`transcript is not in the script's ${refScript} alphabet (heard "${hypRaw}"); word error rate not scored`);
  } else if (werValue > threshold) {
    problems.push(`wer ${werValue.toFixed(2)} exceeds ${threshold}`);
  }

  return { ok: problems.length === 0, wer: werValue, problems, notes };
}

// Position p in the original word list → position in the compound-joined list
// (where "good night" may have become "goodnight").
function mapJoined(orig, joined) {
  const starts = [];
  let k = 0;
  for (let i = 0; i < joined.length; i++) {
    starts.push(k);
    k += orig[k] !== undefined && orig[k] + (orig[k + 1] ?? '') === joined[i] && orig[k] !== joined[i] ? 2 : 1;
  }
  return (p) => {
    let idx = starts.findIndex((s) => s >= p);
    if (idx === -1) idx = joined.length;
    return idx;
  };
}

// `results`: a flat list of take records, one per render attempt, each
// {id, n, seed, ok, wer, problems, ...}. Several records may share an id
// when a line has already been retried. Returns the next take to render
// for every line that hasn't passed and hasn't hit maxTakes yet.
export function retakePlan(results, maxTakes = 4) {
  const groups = new Map();
  for (const r of results ?? []) {
    const key = r.id ?? r.n;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const retakes = [];
  for (const takes of groups.values()) {
    if (takes.some((t) => t.ok)) continue; // a passing take ends the retakes

    if (takes.length >= maxTakes) continue;
    const maxSeed = Math.max(...takes.map((t) => t.seed ?? 0));
    retakes.push({ id: takes[0].id, n: takes[0].n, seed: maxSeed + 1 });
  }
  return retakes;
}

// A passing take beats any failing one; then the lowest WER; then the earlier take.
export function pickBest(takes) {
  return takes.reduce((a, b) => {
    if (Boolean(b.ok) !== Boolean(a.ok)) return b.ok ? b : a;
    return (b.wer ?? Infinity) < (a.wer ?? Infinity) ? b : a;
  });
}

// Picks, per line id, the best take (used once retakes are exhausted or a line passes).
export function bestTakes(results) {
  const groups = new Map();
  for (const r of results ?? []) {
    const key = r.id ?? r.n;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return [...groups.values()].map(pickBest);
}

export function qaReport(lines, mastering) {
  const failed = (lines ?? []).filter((l) => !l.ok);
  const avgWer = lines && lines.length
    ? lines.reduce((sum, l) => sum + (l.wer ?? 0), 0) / lines.length
    : 0;
  return {
    lines: lines ?? [],
    mastering: mastering ?? null,
    ok: failed.length === 0 && mastering?.ok !== false,
    summary: { total: (lines ?? []).length, failed: failed.length, avg_wer: avgWer },
  };
}
