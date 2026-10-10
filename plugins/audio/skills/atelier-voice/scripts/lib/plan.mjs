// Render planner (spec §8 step 2): expands presets, cast and cues from a
// parsed script into a flat render plan that synth/sounds/mix (T4/T6/T7)
// consume. Each line is split at its nonverbal tags so the engine only
// ever sees plain text (spec §7).

import { DOMAIN_PRESETS, DELIVERY_PRESETS, EMOTION_NAMES, MODIFIERS, clampSpeed } from './presets.mjs';
import { normaliseNonverbals, DEFAULT_LEVEL } from './nonverbal.mjs';
import { assertEngineText } from './engine.mjs';
import { NATIVE_STACK, stackOf, nativeOk, loadNativeTable, baseVoice } from './native.mjs';
import { nativePositions } from './qa.mjs';
import { parseVoice } from './voices.mjs';
import { RECORD_GAIN_DB } from './recorder.mjs';

export { NATIVE_STACK };

// `n` (when set) is the script line the error belongs to.
export class PlanError extends Error {
  constructor(message, { n } = {}) { super(n ? `line ${n}: ${message}` : message); this.name = 'PlanError'; this.n = n; }
}

const DEFAULT_LANG = 'en';
const PAUSE_SAMPLE_S = 0.4; // nonverbals: 'pause' splices this long a silence instead of a sample.

function resolveDomainPreset(presetKey) {
  const preset = DOMAIN_PRESETS[presetKey];
  if (!preset) {
    throw new PlanError(`Unknown domain preset "${presetKey}". Expected one of: ${Object.keys(DOMAIN_PRESETS).join(', ')}.`);
  }
  return preset;
}

function resolveVoice(speaker, cast, voiceOverrides) {
  return voiceOverrides?.[speaker]?.voice ?? cast?.[speaker]?.voice ?? (speaker === 'NARRATOR' ? 'F4' : undefined);
}

function resolveCastSpeedMult(speaker, cast, voiceOverrides) {
  return voiceOverrides?.[speaker]?.speed ?? cast?.[speaker]?.speed ?? 1;
}

// Nonverbal modes (front matter `nonverbals:`):
//   auto (default): a tag goes to the engine as its own stacked tags
//     (NATIVE_STACK) when the speaker's voice row in the native-tag table
//     (assets/native-tags.json, lib/native.mjs) allows it; otherwise it is
//     spliced from the sample pack. QA catches a tag voiced as a word; produce
//     re-plans such a line with spliceLines (sample splice).
//   model: only <laugh> may go to the engine (same table); sample: every tag
//     spliced; pause: silence.
// gasp, sob and scream have no native form; clear-throat and sneeze are always
// cough samples.
export const NONVERBAL_MODES = ['auto', 'sample', 'model', 'pause'];
const MODE_TAGS = { auto: null, model: ['laugh'], sample: [], pause: [] }; // null: any table-approved tag

// A native tag as a stack of joined engine tags: "<laugh><laugh><laugh>"
// (joined scored best in the placement test: 58% clean vs 47% spaced).
function nativeTag(seg) {
  const n = stackOf(seg.tag, seg.level ?? DEFAULT_LEVEL[seg.tag]) ?? 1;
  return Array(n).fill(`<${seg.tag}>`).join('');
}

// Tags with no recording of their own, when spliced: a yawn or groan plays the sigh clip, hmm is a short pause.
function spliceable(seg) {
  if (seg.type !== 'nv') return seg;
  if (seg.tag === 'yawn' || seg.tag === 'groan') return { ...seg, tag: 'sigh' };
  if (seg.tag === 'hmm') return { type: 'pause' };
  return seg;
}

// Folds the native tags into the neighbouring text, then merges adjacent text
// pieces, so "<laugh> It's fine." is one engine segment, not "<laugh>" + "It's fine.".
function foldInline(segments, isNative) {
  const out = [];
  for (const seg of segments) {
    const s = seg.type === 'nv' && !seg.sample && isNative(seg.tag) ? { type: 'text', text: nativeTag(seg) } : spliceable(seg);
    const prev = out[out.length - 1];
    if (s.type === 'text' && prev?.type === 'text') prev.text = `${prev.text} ${s.text}`.trim();
    else out.push({ ...s });
  }
  return out;
}

function applyNonverbalMode(segments, mode, voice, table, env) {
  if (mode === 'pause') return segments.map((s) => (s.type === 'nv' ? { type: 'pause' } : s));
  const tags = mode in MODE_TAGS ? MODE_TAGS[mode] : [];
  return foldInline(segments, (tag) => (tags === null || tags.includes(tag)) && nativeOk(voice, tag, table, { env }));
}

// spliceLines: script line numbers planned as `sample` whatever the mode (the
// fallback for a line whose inline tag was spoken on every take).
// env: where clone voices are looked up (AGENTATELIER_VOICES), default process.env.
export function planRender(parsed, { preset, voiceOverrides, spliceLines, nativeTable, env = process.env } = {}) {
  const { meta, lines } = parsed;
  const table = nativeTable ?? loadNativeTable();
  const presetKey = preset ?? meta.preset ?? 'education';
  const domainPreset = resolveDomainPreset(presetKey);
  const cast = meta.cast ?? {};
  const nonverbalsMode = String(meta.nonverbals ?? 'auto').trim().toLowerCase();
  if (!NONVERBAL_MODES.includes(nonverbalsMode)) {
    throw new PlanError(`Unknown nonverbals mode "${meta.nonverbals}". Expected one of: ${NONVERBAL_MODES.join(', ')}.`);
  }
  const docLang = meta.lang ?? DEFAULT_LANG;

  const items = [];
  // Ids are L<n>-<k>, unique across every item a script line produces
  // (speech, nv, pause and each cue of a multi-cue line).
  const nextK = new Map();
  const idFor = (n) => {
    const k = nextK.get(n) ?? 0;
    nextK.set(n, k + 1);
    return `L${n}-${k}`;
  };

  function pushRoomTone(n, position, seconds) {
    items.push({
      id: idFor(n), n, kind: 'cue', lang: docLang,
      cue: { type: 'ambience', value: 'room tone', args: [position, String(seconds)] },
    });
  }

  if (domainPreset.room_tone) pushRoomTone(0, 'head', domainPreset.room_tone.head_s);

  for (const line of lines) {
    const lang = line.lang ?? docLang;

    if (line.kind === 'cue') {
      if (line.cue.type === 'pause') {
        items.push({ id: idFor(line.n), n: line.n, kind: 'pause', lang, pre_s: line.cue.value });
      } else {
        items.push({ id: idFor(line.n), n: line.n, kind: 'cue', lang, cue: line.cue });
      }
      continue;
    }

    // speech line
    if (line.emotion !== undefined && !DELIVERY_PRESETS[line.emotion]) {
      throw new PlanError(`Unknown emotion "${line.emotion}". Valid emotions: ${EMOTION_NAMES.join(', ')}.`, { n: line.n });
    }
    const delivery = DELIVERY_PRESETS[line.emotion ?? 'neutral'];

    let modifierSpeedMult = 1;
    let modifierGainAdd = 0;
    for (const mod of line.modifiers ?? []) {
      const m = MODIFIERS[mod];
      if (!m) continue;
      if (m.speed !== undefined) modifierSpeedMult *= m.speed;
      if (m.gain_db !== undefined) modifierGainAdd += m.gain_db;
    }

    const castSpeedMult = resolveCastSpeedMult(line.speaker, cast, voiceOverrides);
    const effectiveSpeed = clampSpeed(domainPreset.speed * castSpeedMult * delivery.speed * modifierSpeedMult);
    const gain_db = (delivery.gain_db ?? 0) + modifierGainAdd;
    const castVoice = resolveVoice(line.speaker, cast, voiceOverrides);
    const form = parseVoice(castVoice);
    if (form.kind === 'invalid') throw new PlanError(form.reason, { n: line.n });
    const voice = form.kind === 'preset' && castVoice !== undefined ? form.voice : castVoice;
    const emotion = line.emotion ?? null;

    const { segments } = normaliseNonverbals(line.text ?? '');

    // The user speaks this line (record.mjs): one item for the whole line, the
    // nonverbals are theirs to perform, so nothing is spliced and nothing goes
    // to the engine. `prompt` is what record.mjs shows them.
    if (form.kind === 'record') {
      const text = segments.filter((s) => s.type === 'text').map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim();
      const prompt = segments.map((s) => (s.type === 'text' ? s.text : s.type === 'nv' ? `(${s.tag})` : '')).filter(Boolean).join(' ');
      if (!text) throw new PlanError('a recorded line needs words to read', { n: line.n });
      items.push({
        id: idFor(line.n), n: line.n, kind: 'speech', speaker: line.speaker, voice: 'record', recorded: true, rec_id: `L${line.n}`,
        lang, emotion, text, prompt, speed: 1, gain_db: RECORD_GAIN_DB, pre_s: delivery.pre_s, post_s: delivery.post_s, seed: 0,
      });
      continue;
    }
    const planned = applyNonverbalMode(segments, spliceLines?.has(line.n) && nonverbalsMode !== 'pause' ? 'sample' : nonverbalsMode, voice, table, env);

    for (const seg of planned) {
      const id = idFor(line.n);
      if (seg.type === 'text') {
        // Last gate at plan time, so a bad line is a line-numbered script error (exit 1).
        try { assertEngineText(seg.text, { voice, table, env }); } catch (e) { throw new PlanError(e.message, { n: line.n }); }
        const item = {
          id, n: line.n, kind: 'speech', speaker: line.speaker, voice, lang, emotion,
          text: seg.text, speed: effectiveSpeed, gain_db, pre_s: delivery.pre_s, post_s: delivery.post_s, seed: 0,
        };
        const at = nativePositions(seg.text, lang);
        if (at.length) item.native_at = at;
        if (delivery.af) item.af = delivery.af;
        items.push(item);
      } else if (seg.type === 'nv') {
        // Same delivery chain as the line it sits in, so a hushed line gets a hushed breath.
        // pre_s/post_s too: the layout takes them from a line's first/last segment.
        const item = { id, n: line.n, kind: 'nv', speaker: line.speaker, voice, ...(form.kind === 'clone' ? { base_voice: baseVoice(voice, { env }) } : {}), lang, emotion, tag: seg.tag, gain_db, pre_s: delivery.pre_s, post_s: delivery.post_s };
        if (delivery.af) item.af = delivery.af;
        items.push(item);
      } else if (seg.type === 'pause') {
        items.push({ id, n: line.n, kind: 'pause', lang, pre_s: PAUSE_SAMPLE_S });
      }
    }
  }

  if (domainPreset.room_tone) {
    const lastN = items.length ? items[items.length - 1].n : 0;
    pushRoomTone(lastN + 1, 'tail', domainPreset.room_tone.tail_s);
  }

  return { meta, preset: { key: presetKey, ...domainPreset }, items };
}
