// Deliverables (spec §8 step 8): timeline.json, SRT/VTT captions, the
// HyperFrames audio_meta.json and CREDITS.md. Pure builders plus thin writers;
// every path written into a file is relative to that file's directory.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, sep } from 'node:path';
import { normaliseForWer } from './qa.mjs';

const SUPERTONIC_BASE = 'Voices synthesised with Supertonic 3 by Supertone Inc. (https://github.com/supertone-inc/supertonic); code MIT, model weights OpenRAIL-M.';
export const SUPERTONIC_CREDIT = `${SUPERTONIC_BASE} AI-generated voices, not real people.`;
// When the piece also carries a real voice (recorded or cloned), only the presets are "not real people".
export const SUPERTONIC_CREDIT_WITH_REAL = `${SUPERTONIC_BASE} Preset voices are synthetic, not real people.`;
export const DRAFT_CREDIT = 'Draft voice: the system voice (macOS say or espeak-ng), for timing only. Not for release.';

const r3 = (x) => Math.round(x * 1000) / 1000;
const inLine = (l, t) => Math.min(l.end, Math.max(l.start, t));

function writeFile(out, text) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text);
}

const writeJson = (out, obj) => writeFile(out, JSON.stringify(obj, null, 2) + '\n');

// Path as seen from `baseDir`, with forward slashes (stable across platforms).
function relPath(p, baseDir) {
  if (!p) return p;
  if (!isAbsolute(p)) return p;
  return relative(baseDir, p).split(sep).join('/');
}

// Script words of a segment (inline engine tags such as <laugh> are sounds, not words).
const scriptWords = (text) => String(text ?? '').replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean);

// Spread words over [0, duration] in proportion to their length (draft voice,
// --no-qa, or an empty transcript).
export function estimateWords(text, duration) {
  const words = scriptWords(text);
  const weights = words.map((w) => w.length + 1);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let t = 0;
  return words.map((w, i) => {
    const start = t;
    t += (weights[i] / total) * duration;
    return { w, start: r3(start), end: r3(i === words.length - 1 ? duration : t) };
  });
}

// Script words with ASR timings: an edit-distance alignment of the normalised
// tokens; matched and substituted words take the ASR word's times, extra ASR
// words are dropped, and missing words are interpolated between neighbours.
export function alignWords(text, asrWords, duration) {
  const words = scriptWords(text);
  const asr = (asrWords ?? []).filter((w) => normaliseForWer(w.w));
  if (!words.length) return [];
  if (!asr.length) return estimateWords(text, duration);
  const a = words.map((w) => normaliseForWer(w));
  const b = asr.map((w) => normaliseForWer(w.w));
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = Math.min(dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), dp[i - 1][j] + 1, dp[i][j - 1] + 1);
    }
  }
  const match = new Array(n).fill(null);
  for (let i = n, j = m; i > 0 || j > 0;) {
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      match[i - 1] = j - 1;
      i--; j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      i--;
    } else {
      j--;
    }
  }
  const clamp = (x) => Math.min(duration, Math.max(0, x));
  // Too few exact matches (a transcript in another alphabet, or a language
  // written without spaces): no ASR word's time can be trusted for a script
  // word, so spread the script words over the span the ASR heard speech in.
  const exact = match.filter((j, i) => j !== null && a[i] === b[j]).length;
  if (exact < n / 2) {
    const from = clamp(asr[0].start);
    const to = Math.max(from, clamp(asr.at(-1).end));
    return estimateWords(text, to - from).map((w) => ({ w: w.w, start: r3(from + w.start), end: r3(from + w.end) }));
  }
  const out = words.map((w, i) => (match[i] === null ? { w, start: null, end: null } : { w, start: clamp(asr[match[i]].start), end: clamp(asr[match[i]].end) }));
  // Interpolate each run of unmatched words between the surrounding times.
  for (let i = 0; i < n;) {
    if (out[i].start !== null) { i++; continue; }
    let k = i;
    while (k < n && out[k].start === null) k++;
    const from = i > 0 ? out[i - 1].end : 0;
    const to = k < n ? out[k].start : duration;
    const step = Math.max(0, to - from) / (k - i);
    for (let x = i; x < k; x++) {
      out[x].start = from + step * (x - i);
      out[x].end = from + step * (x - i + 1);
    }
    i = k;
  }
  // Keep times monotonic (whisper can overlap words slightly).
  let last = 0;
  return out.map((w) => {
    const start = Math.max(last, w.start);
    const end = Math.max(start, w.end);
    last = start;
    return { w: w.w, start: r3(start), end: r3(end) };
  });
}

// timeline.json: {version: 1, title, duration_s, scenes, lines[], cues[], assets[], warnings[]}.
// `words` maps a segment id to its words relative to the clip start.
export function writeTimeline(timeline, words, out) {
  const base = dirname(out);
  const doc = {
    version: 1,
    title: timeline.title ?? '',
    duration_s: timeline.duration_s,
    scenes: timeline.scenes ?? [],
    lines: (timeline.lines ?? []).map((l) => ({
      id: l.id,
      n: l.n,
      kind: l.kind ?? 'speech',
      speaker: l.speaker,
      voice: l.voice,
      emotion: l.emotion ?? null,
      // nonverbals: auto keeps native tags (<laugh>, <cough>...) in the engine text; the timeline carries plain words.
      text: String(l.text ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
      ...(/<[^>]+>/.test(l.text ?? '') ? { inline_nv: [...new Set([...String(l.text).matchAll(/<([a-z]+)>/gi)].map((m) => m[1].toLowerCase()))] } : {}),
      ...(l.tag ? { tag: l.tag } : {}),
      start: l.start,
      end: l.end,
      // Rounded to ms, but never outside the line (rounding up past l.end would break consumers).
      words: (words?.[l.id] ?? []).map((w) => ({ w: w.w, start: inLine(l, r3(l.start + w.start)), end: inLine(l, r3(l.start + w.end)) })),
    })),
    cues: (timeline.cues ?? []).map((c) => {
      const { path, windows, ...rest } = c;
      return { ...rest, path: relPath(path, base), ...(windows?.length ? { windows } : {}) };
    }),
    assets: (timeline.assets ?? []).map((a) => ({ ...a, path: relPath(a.path, base) })),
    warnings: timeline.warnings ?? [],
  };
  writeJson(out, doc);
  return doc;
}

const pad = (n, w = 2) => String(n).padStart(w, '0');
export function formatTime(seconds, format = 'srt') {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}${format === 'vtt' ? '.' : ','}${pad(ms % 1000, 3)}`;
}

// Consecutive speech segments of one script line (text, nv, text) read as one caption stream.
function captionGroups(doc) {
  const groups = [];
  for (const l of doc.lines ?? []) {
    if (l.kind === 'nv' || !l.words?.length) continue;
    const last = groups.at(-1);
    if (last && last.n === l.n && last.speaker === l.speaker) last.words.push(...l.words);
    else groups.push({ n: l.n, speaker: l.speaker, words: [...l.words] });
  }
  return groups;
}

// Greedy word wrap: at most maxLines lines of at most maxChars characters per
// cue (the speaker label counts toward the first line). A cue starts at its
// first word and ends at its last word. A lone short last word ("langue.") does
// (or two: "it's slow.") does not get a cue of its own: the previous cue's last line moves down to join it.
function buildCues(doc, { maxChars, maxLines, speakerLabels }) {
  const cues = [];
  for (const g of captionGroups(doc)) {
    const label = speakerLabels ? `${g.speaker}: ` : '';
    const lines = [];
    let cur = null;
    for (const w of g.words) {
      const head = lines.length === 0 && (!cur || cur.first);
      if (!cur) cur = { text: head ? label + w.w : w.w, words: [w], first: head };
      else if ((cur.text + ' ' + w.w).length <= maxChars) { cur.text += ` ${w.w}`; cur.words.push(w); }
      else { lines.push(cur); cur = { text: w.w, words: [w], first: false }; }
    }
    if (cur) lines.push(cur);
    const groupCues = [];
    for (let i = 0; i < lines.length; i += maxLines) groupCues.push(lines.slice(i, i + maxLines));
    const tail = groupCues.at(-1);
    const prev = groupCues.at(-2);
    if (prev && prev.length >= 2 && tail.length === 1 && tail[0].words.length <= 2 && tail[0].text.length <= 14 && maxLines >= 2) tail.unshift(prev.pop());
    for (const ls of groupCues) {
      cues.push({ speaker: g.speaker, label: ls[0].first ? label : '', lines: ls.map((l) => l.text), words: ls.flatMap((l) => l.words) });
    }
  }
  for (const [i, c] of cues.entries()) {
    c.start = c.words[0].start;
    c.end = Math.max(c.start + 0.001, c.words.at(-1).end);
    const next = cues[i + 1];
    if (next && c.end > next.words[0].start) c.end = Math.max(c.start + 0.001, next.words[0].start);
  }
  return cues;
}

// Captions as an SRT or WebVTT string, split at word boundaries using word timestamps.
export function writeCaptions(timeline, { format = 'srt', maxChars = 42, maxLines = 2, speakerLabels = true } = {}) {
  if (format !== 'srt' && format !== 'vtt') throw new Error(`writeCaptions: unknown format "${format}" (use srt or vtt)`);
  const cues = buildCues(timeline, { maxChars, maxLines, speakerLabels });
  const blocks = cues.map((c, i) => {
    const time = `${formatTime(c.start, format)} --> ${formatTime(c.end, format)}`;
    const lines = [...c.lines];
    if (format === 'vtt' && c.label) lines[0] = `<v ${c.speaker}>${lines[0].slice(c.label.length)}`;
    return format === 'srt' ? [String(i + 1), time, ...lines].join('\n') : [time, ...lines].join('\n');
  });
  if (format === 'vtt') return `WEBVTT\n\n${blocks.join('\n\n')}${blocks.length ? '\n' : ''}`;
  return blocks.length ? `${blocks.join('\n\n')}\n` : '';
}

// HyperFrames audio_meta.json: {voices: [{id, path, duration_s, words: [{text, start, end}]}],
// sfx: [{id, path, start}], bgm: {path} | null, total_duration_s}. One voice per speaker
// stem; the stems span the whole piece, so word times are timeline times.
export function writeAudioMeta(timeline, stems, out) {
  const base = dirname(out);
  const order = [];
  for (const l of timeline.lines ?? []) if (!order.includes(l.speaker)) order.push(l.speaker);
  const speakers = stems?.speakers ?? {};
  const voices = (Object.keys(speakers).length ? order.filter((s) => speakers[s]) : []).map((s) => ({
    id: s,
    path: relPath(speakers[s], base),
    duration_s: timeline.duration_s,
    words: (timeline.lines ?? []).filter((l) => l.speaker === s).flatMap((l) => (l.words ?? []).map((w) => ({ text: w.w, start: w.start, end: w.end }))),
  }));
  if (!voices.length && stems?.dialogue) {
    voices.push({
      id: 'dialogue', path: relPath(stems.dialogue, base), duration_s: timeline.duration_s,
      words: (timeline.lines ?? []).flatMap((l) => (l.words ?? []).map((w) => ({ text: w.w, start: w.start, end: w.end }))),
    });
  }
  const sfx = [];
  if (stems?.ambience) sfx.push({ id: 'ambience', path: relPath(stems.ambience, base), start: 0 });
  for (const c of (timeline.cues ?? []).filter((x) => x.type === 'sfx').sort((x, y) => x.start - y.start)) {
    sfx.push({ id: c.id, path: relPath(c.path, base), start: c.start });
  }
  const meta = { voices, sfx, bgm: stems?.music ? { path: relPath(stems.music, base) } : null, total_duration_s: timeline.duration_s };
  writeJson(out, meta);
  return meta;
}

// CREDITS.md: the Supertonic line, one attribution line per credited asset, then the generated note.
export const CHATTERBOX_CREDIT = 'Voice conversion by Chatterbox (Resemble AI, https://github.com/resemble-ai/chatterbox; MIT). Converted lines carry the PerTh imperceptible watermark.';

// recorded: speakers who read their own lines; clones: [{speaker, name, base, consent}]
// (a clone line is Supertonic speech converted to the reference's timbre);
// synth: false when no line was synthesised at all.
export function writeCredits(assets, out, { draft = false, recorded = [], clones = [], synth = true } = {}) {
  const lines = ['# Credits', ''];
  const real = recorded.length > 0 || clones.length > 0;
  if (synth || draft) lines.push(draft ? DRAFT_CREDIT : real ? SUPERTONIC_CREDIT_WITH_REAL : SUPERTONIC_CREDIT, '');
  for (const sp of recorded) lines.push(`${sp}: recorded by the speaker (their own voice, with consent on file).`, '');
  if (clones.length) {
    lines.push(CHATTERBOX_CREDIT, '');
    for (const c of clones) {
      const who = c.consent?.kind === 'speaker' ? `the voice of ${c.consent.speaker}, cloned with their consent` : 'the voice owner\'s own clone';
      lines.push(`${c.speaker}: cloned voice "${c.name}" (${who}; base voice ${c.base}). AI-generated speech in a real person's voice.`, '');
    }
  }
  const seen = new Set();
  const credited = [];
  for (const a of assets ?? []) {
    if (a.license === 'generated' || a.source === 'generated') continue;
    const text = a.attribution || (a.source === 'local' ? `${String(a.path ?? a.title ?? 'file').split(/[\\/]/).pop()}: supplied by the user (their own license)` : `"${a.title ?? 'Untitled'}", ${a.license ?? 'unknown license'}`);
    if (seen.has(text)) continue;
    seen.add(text);
    credited.push(`- ${text}`);
  }
  if (credited.length) lines.push('Sounds:', '', ...credited, '');
  if ((assets ?? []).some((a) => a.license === 'generated' || a.source === 'generated')) lines.push('Generated sounds: no attribution required (made with ffmpeg by agentatelier).');
  const md = lines.join('\n') + '\n';
  writeFile(out, md);
  return md;
}
