// Script parser (spec §4): turns a `*.audio.md` document into front-matter
// meta plus a flat, line-numbered list of speech/cue lines. No deps: the
// front matter is a tiny YAML subset (scalars, inline `{k: v}` maps, one
// level of nested maps) since that's all the spec's format ever needs.

import { tagOf } from './nonverbal.mjs';

const MODIFIER_WORDS = new Set(['slow', 'fast', 'loud', 'soft']);
const CUE_TYPES = new Set(['scene', 'ambience', 'sfx', 'music']);
const DIALOGUE_RE = /^([A-Za-z][A-Za-z0-9_]*)\s*(?:\(([^)]*)\))?\s*:\s*(.*)$/;
const CUE_GROUP_RE = /\[([^[\]]+)\]/g;

// --- tiny front-matter (YAML subset) parser -------------------------------

function splitTopLevel(str, sep) {
  const parts = [];
  let cur = '';
  let quote = null;
  for (const ch of str) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
    } else if (ch === sep) {
      parts.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  parts.push(cur);
  return parts;
}

function unquote(s) {
  const t = s.trim();
  if (t.length >= 2) {
    const first = t[0];
    const last = t[t.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) return t.slice(1, -1);
  }
  return t;
}

function coerceScalar(raw) {
  const t = unquote(raw);
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (t === 'true') return true;
  if (t === 'false') return false;
  return t;
}

function parseInlineMap(raw) {
  const inner = raw.trim().replace(/^\{/, '').replace(/\}$/, '');
  const obj = {};
  for (const part of splitTopLevel(inner, ',')) {
    if (!part.trim()) continue;
    const idx = part.indexOf(':');
    if (idx === -1) continue;
    obj[part.slice(0, idx).trim()] = coerceScalar(part.slice(idx + 1));
  }
  return obj;
}

function stripComment(line) {
  let depth = 0;
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '#' && depth === 0) return line.slice(0, i);
  }
  return line;
}

function parseFrontMatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') return { meta: {}, bodyStartIndex: 0 };
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) return { meta: {}, bodyStartIndex: 0 };

  const meta = {};
  let currentKey = null;
  for (const rawLine of lines.slice(1, end)) {
    const line = stripComment(rawLine);
    if (!line.trim()) continue;
    const indent = /^(\s*)/.exec(line)[1].length;
    const trimmed = line.trim();
    const idx = trimmed.indexOf(':');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const valueRaw = trimmed.slice(idx + 1).trim();

    if (indent === 0) {
      currentKey = key;
      if (valueRaw === '') meta[key] = {};
      else if (valueRaw.startsWith('{')) meta[key] = parseInlineMap(valueRaw);
      else meta[key] = coerceScalar(valueRaw);
    } else if (currentKey != null) {
      if (typeof meta[currentKey] !== 'object' || meta[currentKey] === null) meta[currentKey] = {};
      meta[currentKey][key] = valueRaw.startsWith('{') ? parseInlineMap(valueRaw) : coerceScalar(valueRaw);
    }
  }
  return { meta, bodyStartIndex: end + 1 };
}

// --- cues -------------------------------------------------------------------

function isCueLine(trimmedLine) {
  if (!trimmedLine.startsWith('[')) return false;
  return trimmedLine.replace(CUE_GROUP_RE, '').trim() === '';
}

function extractCueGroups(trimmedLine) {
  const groups = [];
  let m;
  const re = new RegExp(CUE_GROUP_RE);
  while ((m = re.exec(trimmedLine))) groups.push(m[1]);
  return groups;
}

function parseCue(raw, n, errors) {
  const content = raw.trim();
  const pauseMatch = /^pause\s+(.+)$/i.exec(content);
  if (pauseMatch) {
    const value = Number(pauseMatch[1].trim());
    if (!Number.isFinite(value)) {
      errors.push({ n, message: `Bad cue "[${raw}]": pause requires a numeric value.` });
      return null;
    }
    return { type: 'pause', value, args: [] };
  }

  const idx = content.indexOf(':');
  if (idx === -1) {
    errors.push({ n, message: `Bad cue "[${raw}]": expected "type: value" or "pause N".` });
    return null;
  }
  const type = content.slice(0, idx).trim().toLowerCase();
  if (type === 'pause') {
    errors.push({ n, message: `Bad cue "[${raw}]": pause requires a numeric value.` });
    return null;
  }
  if (!CUE_TYPES.has(type)) {
    errors.push({ n, message: `Unknown cue type "${type}". Expected scene, ambience, sfx, music or pause.` });
    return null;
  }
  const rest = content.slice(idx + 1);
  const parts = rest.split('|').map((s) => s.trim());
  return { type, value: parts[0], args: parts.slice(1) };
}

// --- speaker line annotation: (emotion, modifier, lang: xx) -----------------

// A tag word in the annotation ("ELI (laughs): ...", "(sighs, tired)") is a
// nonverbal at the start of the line, not an emotion.
function parseAnnotation(annot) {
  if (annot === undefined) return { emotion: undefined, modifiers: [], lang: undefined, nonverbals: [] };
  let lang;
  let emotion;
  const modifiers = [];
  const nonverbals = [];
  for (const tok of splitTopLevel(annot, ',').map((s) => s.trim()).filter(Boolean)) {
    const langMatch = /^lang\s*:\s*(\S+)$/i.exec(tok);
    if (langMatch) {
      lang = langMatch[1];
      continue;
    }
    const tag = tagOf(tok.split(/\s+/)[0]);
    if (tag) {
      nonverbals.push(tag);
      continue;
    }
    if (emotion === undefined) emotion = tok.toLowerCase();
    else modifiers.push(tok.toLowerCase());
  }
  return { emotion, modifiers, lang, nonverbals };
}

// "Remember: this matters" is prose, not dialogue: a NAME: line only counts as
// dialogue when NAME is in the cast, is NARRATOR, or is written in capitals.
function isDialogueLine(trimmed, meta) {
  const m = DIALOGUE_RE.exec(trimmed);
  if (!m) return false;
  const name = m[1];
  if (name === 'NARRATOR' || (meta.cast && Object.prototype.hasOwnProperty.call(meta.cast, name))) return true;
  return name.length > 1 && name === name.toUpperCase() && /[A-Z]/.test(name);
}

function resolveLang(meta, speaker, lineLang) {
  return lineLang ?? meta.cast?.[speaker]?.lang ?? meta.lang ?? undefined;
}

// --- main entry ---------------------------------------------------------

export function parseScript(text, { file } = {}) {
  void file; // kept for parity with the brief's signature; not used for n (n is absolute within text)
  const errors = [];
  const { meta, bodyStartIndex } = parseFrontMatter(text);
  const allLines = text.split(/\r?\n/);
  const bodyLines = allLines.slice(bodyStartIndex).map((raw, i) => ({ n: bodyStartIndex + i + 1, raw }));

  const dialogueCandidates = bodyLines.filter(({ raw }) => raw.trim() !== '' && !isCueLine(raw.trim()));
  const narrationMode = !dialogueCandidates.some(({ raw }) => isDialogueLine(raw.trim(), meta));

  const outLines = [];
  let paragraphBuf = [];
  let usesNarrator = false;

  function flushParagraph() {
    if (paragraphBuf.length === 0) return;
    const n = paragraphBuf[0].n;
    const text = paragraphBuf.map((p) => p.text).join(' ').trim();
    paragraphBuf = [];
    if (!text) return;
    usesNarrator = true;
    outLines.push({
      n, kind: 'speech', speaker: 'NARRATOR', emotion: undefined, modifiers: [],
      text, lang: resolveLang(meta, 'NARRATOR', undefined),
    });
  }

  for (const { n, raw } of bodyLines) {
    const trimmed = raw.trim();
    if (trimmed === '') {
      if (narrationMode) flushParagraph();
      continue;
    }
    if (isCueLine(trimmed)) {
      if (narrationMode) flushParagraph();
      for (const group of extractCueGroups(trimmed)) {
        const cue = parseCue(group, n, errors);
        if (cue) outLines.push({ n, kind: 'cue', modifiers: [], cue });
      }
      continue;
    }
    if (narrationMode) {
      paragraphBuf.push({ n, text: trimmed });
      continue;
    }
    const m = DIALOGUE_RE.exec(trimmed);
    if (!m) {
      errors.push({ n, message: `Could not parse line: "${trimmed}"` });
      continue;
    }
    const [, speaker, annot, rest] = m;
    const { emotion, modifiers, lang: lineLang, nonverbals } = parseAnnotation(annot);
    if (speaker === 'NARRATOR') usesNarrator = true;
    const knownCast = meta.cast && Object.prototype.hasOwnProperty.call(meta.cast, speaker);
    if (!knownCast && speaker !== 'NARRATOR') {
      errors.push({ n, message: `Unknown speaker "${speaker}". Add it to cast.` });
    }
    outLines.push({
      n, kind: 'speech', speaker, emotion, modifiers,
      text: [...nonverbals.map((t) => `<${t}>`), rest.trim()].join(' ').trim(), lang: resolveLang(meta, speaker, lineLang),
    });
  }
  if (narrationMode) flushParagraph();
  if (usesNarrator) {
    if (!meta.cast) meta.cast = {};
    if (!meta.cast.NARRATOR) meta.cast.NARRATOR = { voice: 'F4' };
  }

  return { meta, lines: outLines, errors };
}

export { MODIFIER_WORDS };
