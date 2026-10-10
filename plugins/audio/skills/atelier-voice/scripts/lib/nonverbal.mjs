// Nonverbal tag normaliser (spec §7).
//
// Supertonic has no reliable nonverbal performance: raw tags like [laugh],
// (sigh) or <breath> get spoken as plain words (spec §2.1). This module
// turns script-writer markup into a clean sequence of text/nv segments so
// the planner (lib/plan.mjs) can synthesise each text segment on its own
// and splice in a recorded sample (or a pause) for each tag, instead of
// ever handing the raw tag to the engine.

// yawn, hmm and groan have no recording of their own: native where the voice's
// row in assets/native-tags.json allows; spliced, a yawn or groan is a sigh
// clip and hmm a pause.
export const SUPPORTED_TAGS = ['laugh', 'breath', 'sigh', 'gasp', 'sob', 'cough', 'scream', 'yawn', 'hmm', 'groan'];

const TAG_SET = new Set(SUPPORTED_TAGS);

// chuckle/giggle read as a smaller laugh; sniff/cry read as a smaller sob;
// inhale is the "breath in" half of a breath.
const ALIASES = {
  chuckle: 'laugh',
  giggle: 'laugh',
  sniff: 'sob',
  cry: 'sob',
  inhale: 'breath',
  // Engine tags that Supertonic reads aloud (<clear-throat> 9/9, <sneeze> 5/9 in
  // the T10 lab run): always spliced as a cough sample.
  clearthroat: 'cough',
  sneeze: 'cough',
  hm: 'hmm',
  hmmm: 'hmm',
};
const SAMPLE_ONLY = new Set(['sneeze', 'clearthroat']);
const WARN = {
  sneeze: 'a sneeze is played as a cough sample (there is no sneeze recording)',
};

// Every inflection a writer (or an ASR transcript) uses for a tag word:
// "(sighs heavily)", "[laughter]", "*laughing*", "(breathing)", "(sobbing)".
const INFLECTIONS = {
  laugh: ['laugh', 'laughs', 'laughing', 'laughed', 'laughter'],
  breath: ['breath', 'breaths', 'breathe', 'breathes', 'breathing', 'breathed'],
  sigh: ['sigh', 'sighs', 'sighing', 'sighed'],
  gasp: ['gasp', 'gasps', 'gasping', 'gasped'],
  sob: ['sob', 'sobs', 'sobbing', 'sobbed'],
  cough: ['cough', 'coughs', 'coughing', 'coughed'],
  scream: ['scream', 'screams', 'screaming', 'screamed'],
  chuckle: ['chuckle', 'chuckles', 'chuckling', 'chuckled'],
  giggle: ['giggle', 'giggles', 'giggling', 'giggled'],
  sniff: ['sniff', 'sniffs', 'sniffing', 'sniffed', 'sniffle', 'sniffles', 'sniffling'],
  cry: ['cry', 'cries', 'crying', 'cried'],
  inhale: ['inhale', 'inhales', 'inhaling', 'inhaled'],
  sneeze: ['sneeze', 'sneezes', 'sneezing', 'sneezed'],
  groan: ['groan', 'groans', 'groaning', 'groaned'],
  yawn: ['yawn', 'yawns', 'yawning', 'yawned'],
};
const WORD_TO_BASE = new Map();
for (const [base, forms] of Object.entries(INFLECTIONS)) for (const f of forms) WORD_TO_BASE.set(f, base);

// The inflected forms of one tag word (used by QA to catch "laughs", "sighing"...).
export function inflectionsOf(word) {
  const w = String(word ?? '').toLowerCase();
  const base = WORD_TO_BASE.get(w) ?? w;
  return INFLECTIONS[base] ?? [w, `${w}s`, `${w}es`, `${w}ed`, `${w}ing`];
}

// A single word ("Laughs.", "sighing", "chuckle") → supported tag, or null.
export function tagOf(raw) {
  const word = String(raw ?? '').toLowerCase().replace(/[^a-z_]/g, '');
  if (TAG_SET.has(word)) return word;
  if (ALIASES[word]) return ALIASES[word];
  const base = WORD_TO_BASE.get(word);
  if (base) return TAG_SET.has(base) ? base : ALIASES[base];
  return null;
}

// Characters the engine's preprocessor rewrites to spaces (spec §2.1), plus
// the ones our own cue/markup syntax uses, plus any leftover angle bracket.
// Never let these reach Supertonic.
const FORBIDDEN_CHARS = /[[\]()*/|#_<>]/g;

function cleanText(raw) {
  return raw.replace(FORBIDDEN_CHARS, ' ').replace(/\s+/g, ' ').trim();
}

// Every markup form: [..], (..), *..*, <..>, </..>, <../>, < .. >. The content
// may be several words ("sighs heavily", "laughs softly"): the first word
// decides the tag and the rest (adverbs) is dropped. Anything else in brackets
// is a stage direction: it is removed with a warning, never spoken.
const TAG_RE = /\[([^[\]]*)\]|\(([^()]*)\)|\*([^*]+)\*|<\s*\/?\s*([^<>]*?)\s*\/?\s*>/g;

// "clears throat", "clear-throat", "clear_throat", "clears his throat" → one word.
const THROAT_RE = /^clear(s|ing|ed)?[\s_-]+(?:(?:his|her|their|my|your|the)\s+)?throat\b/i;

const BURST_RE = /^burst(s|ing)?\s+(out\s+)?(laugh|laughing|into\s+laughter)/i;

export function resolveDirection(content) {
  const c = String(content ?? '').trim().replace(/:\s*\d+\s*$/, '');
  if (THROAT_RE.test(c)) return 'cough';
  if (BURST_RE.test(c)) return 'laugh';
  const first = c.split(/\s+/)[0] ?? '';
  return tagOf(first);
}

// Intensity of a laugh, 1-3: `<laugh:N>`, or the words of a stage
// direction ("chuckles" 1, "laughs" 2, "laughs hard" 3; only laughs have sizes).
// The planner turns it into a number of stacked engine tags (NATIVE_STACK).
export const DEFAULT_LEVEL = { laugh: 2 };
export function levelOf(content, tag) {
  if (!(tag in DEFAULT_LEVEL)) return undefined;
  const c = String(content ?? '').trim().toLowerCase();
  const n = c.match(/:\s*(\d+)\s*$/);
  if (n) return Math.min(3, Math.max(1, Number(n[1])));
  if (tag === 'laugh') {
    if (/^(chuckl|giggl)/.test(c) || /\b(soft(ly)?|quiet(ly)?|gentl[ey]|little|slight(ly)?|nervous(ly)?)\b/.test(c)) return 1;
    if (BURST_RE.test(c) || /^laughter\b/.test(c) || /\b(hard|loud(ly)?|uncontrollabl[ey]|hysterical(ly)?|big)\b/.test(c)) return 3;
    return 2;
  }
  return undefined;
}

// The base word a direction names ("sneezes" → "sneeze"), for warnings.
function baseWord(content) {
  const c = String(content ?? '').trim();
  if (THROAT_RE.test(c)) return 'clearthroat';
  const w = (c.split(/\s+/)[0] ?? '').toLowerCase().replace(/[^a-z]/g, '');
  return WORD_TO_BASE.get(w) ?? w;
}

export function normaliseNonverbals(text) {
  const input = String(text ?? '');
  const segments = [];
  const warnings = [];
  let lastIndex = 0;
  let pending = ''; // text carried across a removed direction ("[sic]" never splits speech)
  let match;

  const flushText = () => {
    const cleaned = cleanText(pending);
    if (cleaned) segments.push({ type: 'text', text: cleaned });
    pending = '';
  };

  TAG_RE.lastIndex = 0;
  while ((match = TAG_RE.exec(input))) {
    pending += input.slice(lastIndex, match.index);
    const content = match[1] ?? match[2] ?? match[3] ?? match[4] ?? '';
    const tag = resolveDirection(content);
    const base = baseWord(content);
    if (tag) {
      flushText();
      // A stand-in (clear-throat, sneeze → cough) is always a sample, never the engine's own tag.
      const level = levelOf(content, tag);
      segments.push(SAMPLE_ONLY.has(base) ? { type: 'nv', tag, sample: true } : level ? { type: 'nv', tag, level } : { type: 'nv', tag });
      if (WARN[base]) warnings.push(`<${base}>: ${WARN[base]}.`);
    } else {
      const shown = content.trim().toLowerCase().replace(/\s+/g, ' ');
      warnings.push(shown ? `Unknown nonverbal tag "${shown}" was removed.` : 'Empty brackets were removed.');
      pending += ' ';
    }
    lastIndex = TAG_RE.lastIndex;
  }
  pending += input.slice(lastIndex);
  flushText();

  return { segments, warnings };
}
