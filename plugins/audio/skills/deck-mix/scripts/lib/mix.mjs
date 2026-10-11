// Timeline layout, dialogue stems and the final mix.
//
// Scale rule: no ffmpeg invocation takes more than MAX_INPUTS inputs, however
// long the plan. Dialogue is placed with the concat demuxer (one input: a list
// file of clips and power-of-two silence blocks), and cue stems (sfx, ambience,
// music) are rendered in small batches and then summed in a bounded tree.
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { run, readWavInfo, isPcm16Mono, probeDuration, SR } from './ffmpeg.mjs';

export const MAX_INPUTS = 8; // per batch; the final mix uses at most 4
export const MAX_PLACEMENTS = 64; // adelay placements per batch

const r6 = (x) => Math.round(x * 1e6) / 1e6;
const samples = (s) => Math.max(0, Math.round(s * SR));

// Base levels (dB) per cue type and the offsets for `| low` / `| high`.
const BASE_DB = { sfx: -6, ambience: -20, music: -16 };
const LEVEL_DB = { low: -6, soft: -6, quiet: -6, medium: 0, mid: 0, normal: 0, high: 6, loud: 6 };
const MUSIC_VERBS = new Set(['start', 'stop', 'swell', 'duck', 'out']);
const FADE = { ambience: 1, music: 1, stop: 0.5, out: 3 };
const SWELL = { length_s: 4, gain_db: 6 };

function cueGain(type, args = []) {
  let db = BASE_DB[type] ?? 0;
  for (const a of args) {
    const key = String(a).trim().toLowerCase();
    if (key in LEVEL_DB) db += LEVEL_DB[key];
    const m = key.match(/^([+-]?\d+(?:\.\d+)?)\s*db$/);
    if (m) db = Number(m[1]);
  }
  return db;
}

// The planner stores a pause's length in pre_s (kind 'pause'); [pause N] cue
// items carry it in cue.value.
function pauseSeconds(item) {
  const candidates = [item.duration_s, item.seconds, item.kind === 'pause' ? item.pre_s : undefined, item.cue?.duration_s, item.cue?.value, item.cue?.args?.[0]];
  for (const c of candidates) {
    const v = Number.parseFloat(c);
    if (Number.isFinite(v) && v >= 0) return v;
  }
  return 0;
}

const isTimed = (it) => it.kind === 'speech' || it.kind === 'nv';
export const SPLICE_FADE_S = 0.01; // 10 ms fades where a line is cut around a nonverbal
// Room tone (audiobook) is a bed under the whole piece at its own level, not an
// ambience that a [scene:] or the next [ambience:] closes.
export const ROOM_TONE_DB = -28;
export const isRoomTone = (cue) => cue?.type === 'ambience' && /^room[ -]?tone$/i.test(String(cue.value ?? '').trim());
const cueArgs = (cue) => (cue?.args || []).map((a) => String(a).trim().toLowerCase());

export function layoutTimeline(plan, rendered = {}, preset = {}) {
  const items = plan?.items || [];
  const gap = preset.gap_s ?? 0;
  const lead = Math.max(preset.lead_s ?? 0, preset.room_tone?.head_s ?? 0);
  const tail = Math.max(preset.tail_s ?? 0, preset.room_tone?.tail_s ?? 0);
  const scenes = [];
  const lines = [];
  const cues = [];
  const warnings = [];
  let t = lead;
  let lastN = null;
  let pausedSinceLine = false;
  let ambience = null;
  let music = null;
  let roomTone = null;

  const cuePath = (item) => item.cue?.path ?? item.path ?? rendered[item.id]?.path;
  const closeAmbience = (at) => {
    if (ambience) cues.push({ ...ambience, end: r6(Math.max(ambience.start, at)) });
    ambience = null;
  };
  const closeMusic = (at, fade = FADE.music) => {
    if (music) cues.push({ ...music, end: r6(Math.max(music.start, at)), fade_out: fade });
    music = null;
  };

  // Lines cut into several timed segments (text/nv/text) get splice fades.
  const segCount = new Map();
  for (const it of items) if (isTimed(it)) segCount.set(it.n, (segCount.get(it.n) ?? 0) + 1);

  // The n of the next timed item after index i (to know where a line ends).
  const nextTimedN = new Array(items.length).fill(null);
  for (let i = items.length - 1, next = null; i >= 0; i--) {
    nextTimedN[i] = next;
    if (isTimed(items[i])) next = items[i].n;
  }

  items.forEach((item, i) => {
    if (isTimed(item)) {
      const r = rendered[item.id];
      if (!r || !r.path || !Number.isFinite(r.duration_s)) throw new Error(`layout: no rendered audio for ${item.id}`);
      const newLine = item.n !== lastN;
      if (newLine && lastN !== null && !pausedSinceLine) t += gap;
      if (newLine) t += item.pre_s ?? 0;
      const start = t;
      const end = t + r.duration_s;
      lines.push({
        id: item.id,
        n: item.n,
        kind: item.kind,
        speaker: item.speaker ?? 'NARRATOR',
        voice: item.voice,
        emotion: item.emotion ?? null,
        text: item.kind === 'nv' ? '' : item.text ?? '',
        ...(item.tag ? { tag: item.tag } : {}),
        start: r6(start),
        end: r6(end),
        path: r.path,
        gain_db: item.gain_db ?? 0,
        af: item.af ?? '',
        ...(item.kind === 'nv' || segCount.get(item.n) > 1 ? { fade_s: SPLICE_FADE_S } : {}),
      });
      t = end;
      if (nextTimedN[i] !== item.n) t += item.post_s ?? 0;
      lastN = item.n;
      pausedSinceLine = false;
      return;
    }
    if (item.kind === 'pause' || item.cue?.type === 'pause') {
      t += pauseSeconds(item);
      pausedSinceLine = true;
      return;
    }
    if (item.kind !== 'cue' || !item.cue) return;
    const { type, value } = item.cue;
    const args = cueArgs(item.cue);
    const label = String(value ?? '').trim();
    if (isRoomTone(item.cue)) {
      if (roomTone) return; // the head cue already covers the whole piece (tail cue is redundant)
      const path = cuePath(item);
      if (!path) return void warnings.push(`room tone (${item.id}) has no resolved sound; skipped`);
      roomTone = { type: 'ambience', id: item.id, label: 'room tone', start: 0, path, gain_db: ROOM_TONE_DB, loop: true, room_tone: true };
      return;
    }
    if (type === 'scene') {
      closeAmbience(t);
      scenes.push({ name: label, start: r6(t) });
    } else if (type === 'ambience') {
      closeAmbience(t);
      if (['stop', 'none', 'off', 'out'].includes(label.toLowerCase())) return;
      const path = cuePath(item);
      if (!path) return void warnings.push(`ambience "${label}" (${item.id}) has no resolved sound; skipped`);
      ambience = { type: 'ambience', id: item.id, label, start: r6(t), path, gain_db: cueGain('ambience', args), loop: true, fade_in: FADE.ambience, fade_out: FADE.ambience };
    } else if (type === 'sfx') {
      const path = cuePath(item);
      if (!path) return void warnings.push(`sfx "${label}" (${item.id}) has no resolved sound; skipped`);
      const dur = rendered[item.id]?.duration_s ?? item.cue.duration_s;
      const start = Math.max(0, t - (item.cue.peak_s ?? 0));
      const c = { type: 'sfx', id: item.id, label, start: r6(start), path, gain_db: cueGain('sfx', args) };
      if (Number.isFinite(dur)) c.end = r6(start + dur);
      cues.push(c);
      if (args.includes('wait') && Number.isFinite(dur)) t = Math.max(t, start + dur);
    } else if (type === 'music') {
      const verb = label.toLowerCase();
      if (verb === 'stop') closeMusic(t, FADE.stop);
      else if (verb === 'out') {
        if (music) music.out_at = t;
        closeMusic(t + FADE.out, FADE.out);
      } else if (verb === 'swell' || verb === 'duck') {
        if (!music) return void warnings.push(`music ${verb} (${item.id}) with no music playing; ignored`);
        const db = verb === 'swell' ? SWELL.gain_db : preset.duck_db ?? -10;
        music.windows.push({ start: r6(t), end: r6(t + SWELL.length_s), gain_db: db });
      } else {
        const path = cuePath(item) ?? (verb === 'start' || !MUSIC_VERBS.has(verb) ? plan.meta?.music?.path : undefined);
        closeMusic(t);
        if (!path) return void warnings.push(`music "${label}" (${item.id}) has no resolved sound; skipped`);
        const level = plan.meta?.music?.level;
        music = { type: 'music', id: item.id, label, start: r6(t), path, gain_db: cueGain('music', level ? [...args, level] : args), loop: true, fade_in: FADE.music, windows: [] };
      }
    }
  });

  const duration = r6(t + tail);
  closeAmbience(duration);
  closeMusic(duration);
  if (roomTone) cues.push({ ...roomTone, end: duration });
  // A front-matter music bed with no music cues plays under the whole piece.
  if (!cues.some((c) => c.type === 'music') && plan.meta?.music?.path) {
    cues.push({ type: 'music', id: 'bed', label: 'bed', start: r6(lead), end: duration, path: plan.meta.music.path, gain_db: cueGain('music', plan.meta.music.level ? [plan.meta.music.level] : []), loop: true, fade_in: FADE.music, fade_out: FADE.out, windows: [] });
  }
  for (const c of cues) {
    if (c.end !== undefined && c.end > duration) c.end = duration;
    if (c.fade_out !== undefined && c.end !== undefined) c.fade_out = Math.min(c.fade_out, Math.max(0, c.end - c.start));
    delete c.out_at;
  }
  cues.sort((a, b) => a.start - b.start);
  return { duration_s: duration, scenes, lines, cues, warnings };
}

// ---------- dialogue stem ----------

const quoteConcat = (p) => `file '${p.replace(/'/g, "'\\''")}'`;
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'speaker';

// Exact-length silence files, one per distinct gap length (anullsrc, many
// outputs per invocation, zero inputs). One entry per gap keeps the concat
// list at ~2 entries per line: the concat demuxer pays a per-file open cost.
const MAX_SILENCE = 2 ** 20; // ~24 s; longer gaps repeat this block
const SILENCE_OUTPUTS = 48;
async function makeSilences(lengths, dir) {
  const paths = new Map();
  const all = [...lengths].filter((n) => n > 0).sort((x, y) => x - y);
  for (let i = 0; i < all.length; i += SILENCE_OUTPUTS) {
    const group = all.slice(i, i + SILENCE_OUTPUTS);
    const split = group.map((_, k) => `[s${k}]`).join('');
    const trims = group.map((n, k) => `[s${k}]atrim=end_sample=${n}[o${k}]`).join(';');
    const head = `anullsrc=r=${SR}:cl=mono:nb_samples=4096,atrim=end_sample=${group[group.length - 1]}`;
    const args = ['-filter_complex', group.length > 1 ? `${head},asplit=${group.length}${split};${trims}` : `${head}[o0]`];
    group.forEach((n, k) => {
      const path = join(dir, `sil-${n}.wav`);
      paths.set(n, path);
      args.push('-map', `[o${k}]`, '-c:a', 'pcm_s16le', path);
    });
    await run(args);
  }
  return paths;
}

function gapParts(n) {
  const parts = [];
  while (n > MAX_SILENCE) {
    parts.push(MAX_SILENCE);
    n -= MAX_SILENCE;
  }
  if (n > 0) parts.push(n);
  return parts;
}

// Applies delivery af + gain and normalises to 44.1 kHz mono s16 so the concat
// demuxer can stream-copy every clip. Clean clips are used as they are.
async function prepareClips(lines, dir) {
  const cache = new Map();
  const out = [];
  let i = 0;
  for (const line of lines) {
    const key = `${line.path}\0${line.af || ''}\0${line.gain_db || 0}\0${line.fade_s || 0}`;
    if (!cache.has(key)) {
      cache.set(key, (async () => {
        const info = await readWavInfo(line.path);
        if (!line.af && !line.gain_db && !line.fade_s && isPcm16Mono(info)) return { path: line.path, samples: info.samples };
        const target = join(dir, `clip-${i++}.wav`);
        const dur = info ? info.samples / info.sampleRate : line.end - line.start;
        const fades = line.fade_s && dur > 4 * line.fade_s
          ? `afade=t=in:d=${line.fade_s},afade=t=out:st=${r6(dur - line.fade_s)}:d=${line.fade_s}`
          : '';
        const chain = [`aformat=sample_fmts=s16:sample_rates=${SR}:channel_layouts=mono`, line.af, line.gain_db ? `volume=${line.gain_db}dB` : '', fades, `aformat=sample_fmts=s16:sample_rates=${SR}:channel_layouts=mono`].filter(Boolean).join(',');
        await run(['-i', line.path, '-af', chain, '-c:a', 'pcm_s16le', target]);
        const after = await readWavInfo(target);
        return { path: target, samples: after.samples };
      })());
    }
    out.push(await cache.get(key));
  }
  return out;
}

// Lays one track out as [silence n | clip] segments, sample-exact.
function planTrack(entries, totalSamples) {
  const segments = [];
  let cursor = 0;
  let drift = 0;
  for (const { start, clip } of entries) {
    let s = samples(start);
    if (s < cursor) {
      drift = Math.max(drift, cursor - s);
      s = cursor;
    }
    for (const n of gapParts(s - cursor)) segments.push({ silence: n });
    segments.push({ clip });
    cursor = s + clip.samples;
  }
  for (const n of gapParts(totalSamples - cursor)) segments.push({ silence: n });
  if (!segments.length) segments.push({ silence: 1 });
  return { segments, drift_s: drift / SR };
}

async function writeTrack(track, silences, listPath, outPath) {
  const list = track.segments.map((seg) => quoteConcat(seg.clip ? seg.clip.path : silences.get(seg.silence)));
  await writeFile(listPath, list.join('\n') + '\n');
  await run(['-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outPath]);
}

export async function buildDialogueStem(timeline, out, { speakerDir } = {}) {
  const dir = speakerDir ?? dirname(out);
  await mkdir(dirname(out), { recursive: true });
  await mkdir(dir, { recursive: true });
  const work = await mkdtemp(join(tmpdir(), 'aa-dialogue-'));
  try {
    const lines = [...timeline.lines].sort((a, b) => a.start - b.start);
    const clips = await prepareClips(lines, work);
    const total = samples(timeline.duration_s);
    const entries = lines.map((line, i) => ({ start: line.start, clip: clips[i], speaker: line.speaker }));
    const names = [...new Set(lines.map((l) => l.speaker))];
    const stem = basename(out).replace(/\.wav$/i, '');
    const tracks = [{ path: out, plan: planTrack(entries, total) }];
    for (const name of names) {
      tracks.push({ name, path: join(dir, `${stem}-${slug(name)}.wav`), plan: planTrack(entries.filter((e) => e.speaker === name), total) });
    }
    const lengths = new Set(tracks.flatMap((t) => t.plan.segments.filter((g) => g.silence).map((g) => g.silence)));
    const silences = await makeSilences(lengths, work);
    const speakers = {};
    for (const [k, t] of tracks.entries()) {
      await writeTrack(t.plan, silences, join(work, `track-${k}.txt`), t.path);
      if (t.name !== undefined) speakers[t.name] = t.path;
    }
    return { dialogue: out, speakers, duration_s: timeline.duration_s, drift_s: tracks[0].plan.drift_s };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

// ---------- cue stems ----------

const STEREO = `aformat=sample_fmts=fltp:sample_rates=${SR}:channel_layouts=stereo`;

function placementChain(c, loopSamples) {
  const parts = [];
  const len = c.end !== undefined ? samples(c.end - c.start) : null;
  if (c.loop && loopSamples > 0) parts.push(`aloop=loop=-1:size=${loopSamples}`);
  if (len !== null) parts.push(`atrim=end_sample=${Math.max(1, len)}`);
  parts.push('asetpts=N/SR/TB');
  if (c.fade_in) parts.push(`afade=t=in:d=${c.fade_in}`);
  if (c.fade_out && len !== null) parts.push(`afade=t=out:st=${r6(Math.max(0, len / SR - c.fade_out))}:d=${c.fade_out}`);
  if (c.gain_db) parts.push(`volume=${c.gain_db}dB`);
  for (const w of c.windows || []) {
    parts.push(`volume=volume=${w.gain_db}dB:enable='between(t,${r6(w.start - c.start)},${r6(w.end - c.start)})'`);
  }
  parts.push(`adelay=delays=${samples(c.start)}S:all=1`);
  return parts.join(',');
}

function batchCues(cues) {
  const batches = [];
  let cur = null;
  for (const c of [...cues].sort((a, b) => a.start - b.start)) {
    const fits = cur && cur.cues.length < MAX_PLACEMENTS && (cur.paths.has(c.path) || cur.paths.size < MAX_INPUTS);
    if (!fits) batches.push((cur = { cues: [], paths: new Set() }));
    cur.cues.push(c);
    cur.paths.add(c.path);
  }
  return batches;
}

async function renderBatch(batch, totalSamples, durations, out) {
  const paths = [...batch.paths];
  const args = [];
  for (const p of paths) args.push('-i', p);
  const graph = [];
  const labels = [];
  paths.forEach((p, i) => {
    const uses = batch.cues.filter((c) => c.path === p);
    const outs = uses.map((_, j) => `[i${i}u${j}]`);
    graph.push(`[${i}:a]${STEREO}${uses.length > 1 ? `,asplit=${uses.length}` : ''}${outs.join('')}`);
    uses.forEach((c, j) => {
      const label = `[p${labels.length}]`;
      graph.push(`[i${i}u${j}]${placementChain(c, Math.floor((durations.get(p) || 0) * SR))}${label}`);
      labels.push(label);
    });
  });
  graph.push(`${labels.join('')}${labels.length > 1 ? `amix=inputs=${labels.length}:normalize=0:duration=longest,` : ''}apad=whole_len=${totalSamples},atrim=end_sample=${totalSamples}[out]`);
  args.push('-filter_complex', graph.join(';'), '-map', '[out]', '-c:a', 'pcm_f32le', out);
  await run(args);
  return out;
}

async function sumStems(files, totalSamples, out, work) {
  let level = files;
  let round = 0;
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += MAX_INPUTS) {
      const group = level.slice(i, i + MAX_INPUTS);
      const target = level.length <= MAX_INPUTS ? out : join(work, `sum-${round}-${i}.wav`);
      if (group.length === 1) {
        next.push(group[0]);
        continue;
      }
      const args = [];
      for (const f of group) args.push('-i', f);
      const ins = group.map((_, k) => `[${k}:a]`).join('');
      args.push('-filter_complex', `${ins}amix=inputs=${group.length}:normalize=0:duration=longest,atrim=end_sample=${totalSamples}[out]`, '-map', '[out]', '-c:a', 'pcm_f32le', target);
      await run(args);
      next.push(target);
    }
    level = next;
    round++;
  }
  return level[0];
}

async function renderCueStem(cues, totalSamples, out, work, tag) {
  if (!cues.length) return null;
  const durations = new Map();
  for (const p of new Set(cues.filter((c) => c.loop).map((c) => c.path))) durations.set(p, await probeDuration(p));
  const batches = batchCues(cues);
  if (batches.length === 1) return renderBatch(batches[0], totalSamples, durations, out);
  const parts = [];
  for (const [i, b] of batches.entries()) parts.push(await renderBatch(b, totalSamples, durations, join(work, `${tag}-batch-${i}.wav`)));
  const summed = await sumStems(parts, totalSamples, out, work);
  if (summed !== out) await run(['-i', summed, '-c:a', 'pcm_f32le', out]);
  return out;
}

// ---------- final mix ----------

// Pure graph builder: dialogue + optional sfx/ambience/music stems, music
// ducked by a sidechain keyed from dialogue, optional carve, amix normalize=0.
export function mixArgs(stems, { duration_s, out, carve = true }) {
  const total = samples(duration_s);
  const args = ['-i', stems.dialogue];
  const graph = [];
  const order = ['sfx', 'ambience', 'music'].filter((k) => stems[k]);
  for (const k of order) args.push('-i', stems[k]);
  const mixIn = ['[dlg]'];
  graph.push(`[0:a]${STEREO}${stems.music ? ',asplit=2[dlg][key]' : '[dlg]'}`);
  order.forEach((k, i) => {
    const idx = i + 1;
    if (k === 'music') {
      graph.push(`[${idx}:a]${STEREO}[mraw]`);
      graph.push(`[mraw][key]sidechaincompress=threshold=0.031623:ratio=8:release=400:attack=20${carve ? ',equalizer=f=2500:t=q:w=1:g=-4' : ''}[music]`);
      mixIn.push('[music]');
    } else {
      graph.push(`[${idx}:a]${STEREO}[${k}]`);
      mixIn.push(`[${k}]`);
    }
  });
  graph.push(`${mixIn.join('')}${mixIn.length > 1 ? `amix=inputs=${mixIn.length}:normalize=0:duration=longest,` : ''}apad=whole_len=${total},atrim=end_sample=${total}[out]`);
  args.push('-filter_complex', graph.join(';'), '-map', '[out]', '-ar', String(SR), '-c:a', 'pcm_f32le', out);
  return args;
}

export async function buildMix(timeline, stems, preset = {}, out, { stemDir, carve } = {}) {
  const dir = stemDir ?? dirname(stems.dialogue);
  await mkdir(dir, { recursive: true });
  await mkdir(dirname(out), { recursive: true });
  const work = await mkdtemp(join(tmpdir(), 'aa-mix-'));
  try {
    const total = samples(timeline.duration_s);
    const byType = (t) => timeline.cues.filter((c) => c.type === t);
    const written = { dialogue: stems.dialogue, speakers: stems.speakers || {} };
    for (const [type, file] of [['sfx', 'sfx.wav'], ['ambience', 'ambience.wav'], ['music', 'music.wav']]) {
      const p = await renderCueStem(byType(type), total, join(dir, file), work, type);
      if (p) written[type] = p;
    }
    const useCarve = carve ?? preset.carve ?? preset.music !== 'none';
    await run(mixArgs(written, { duration_s: timeline.duration_s, out, carve: useCarve }));
    return { path: out, stems: written, duration_s: timeline.duration_s };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
