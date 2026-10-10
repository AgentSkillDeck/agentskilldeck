#!/usr/bin/env node
// produce.mjs: script → finished audio (spec §8).
// parse → plan → synth (batched) → QA/retakes → sounds → layout → stems → mix → master → deliver.
// Exit codes: 0 ok · 1 script/usage error · 2 setup missing or service error · 3 QA failed (outputs kept).
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { UsageError, wantsHelp } from './lib/args.mjs';
import { parseScript } from './lib/script.mjs';
import { planRender } from './lib/plan.mjs';
import { normaliseNonverbals } from './lib/nonverbal.mjs';
import { checkLine, retakePlan, pickBest, qaReport } from './lib/qa.mjs';
import { loadNativeTable } from './lib/native.mjs';
import { layoutTimeline, buildDialogueStem, buildMix, isRoomTone } from './lib/mix.mjs';
import { master } from './lib/master.mjs';
import { hasFfmpeg } from './lib/ffmpeg.mjs';
import { SetupError } from './lib/engine.mjs';
import { resolveCue, freesoundTokenFromEnv, parseSources, defaultSources, genderOf } from './lib/sounds/index.mjs';
import { writeTimeline, writeCaptions, writeAudioMeta, writeCredits, alignWords, estimateWords } from './lib/deliver.mjs';
import { selectEngine, openCloneSession, synthBatch, asrBatch, nonverbalClip, activeRmsDb, nvMatchGain, toWav, exitCodeFor } from './lib/render.mjs';
import { recordingsFor } from './lib/recorder.mjs';
import { parseVoice, loadCloneVoice } from './lib/voices.mjs';

const USAGE = 'Usage: node scripts/produce.mjs <script.audio.md> --out <dir> [--preset name] [--draft] [--no-qa] [--offline] [--takes 1-8] [--sources openverse,commons[,archive][,freesound]] [--json]';
const MUSIC_CONTROLS = new Set(['start', 'stop', 'swell', 'duck', 'out']);
const PAUSE_PAD_S = 1;
const ENGINE_TAG_RE = /<[a-z-]+>/;

function parse(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv, allowPositionals: true,
      options: {
        out: { type: 'string' }, preset: { type: 'string' }, draft: { type: 'boolean' }, 'no-qa': { type: 'boolean' },
        offline: { type: 'boolean' }, takes: { type: 'string' }, sources: { type: 'string' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (e) {
    throw new UsageError(`${e.message}\n${USAGE}`);
  }
  const { values, positionals } = parsed;
  if (values.help) throw new UsageError(USAGE);
  if (positionals.length !== 1) throw new UsageError(`Expected one script file.\n${USAGE}`);
  if (!values.out) throw new UsageError(`--out <dir> is required.\n${USAGE}`);
  let takes = 4;
  if (values.takes !== undefined) {
    if (!/^\d+$/.test(values.takes) || Number(values.takes) < 1 || Number(values.takes) > 8) throw new UsageError(`--takes must be 1-8.\n${USAGE}`);
    takes = Number(values.takes);
  }
  let sources;
  if (values.sources !== undefined) {
    try { sources = parseSources(values.sources); } catch (e) { throw new UsageError(`${e.message}\n${USAGE}`); }
  }
  return { script: positionals[0], out: values.out, preset: values.preset, draft: Boolean(values.draft), qa: !values['no-qa'], offline: Boolean(values.offline), takes, sources, json: Boolean(values.json) };
}

const fmt = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : String(x));

// The whole pipeline. Returns {code, summary}; throws for exit 1/2 conditions.
// A clone worker opened for the run is closed at the end, error or not.
export async function produce(opts, ctx = {}) {
  const run = {};
  try {
    return await producePipeline(opts, ctx, run);
  } finally {
    await run.cloneSession?.close();
  }
}

async function producePipeline(opts, ctx, run) {
  const env = ctx.env ?? process.env;
  const log = ctx.progress ?? (() => {});
  const warnings = [];
  const warn = (w) => { warnings.push(w); log(`warning: ${w}`); };

  // 1. parse
  const scriptPath = resolve(opts.script);
  let text;
  try { text = readFileSync(scriptPath, 'utf8'); } catch (e) {
    throw new UsageError(e.code === 'ENOENT' ? `Script not found: ${opts.script}` : `Cannot read ${opts.script}: ${e.message}`);
  }
  const parsed = parseScript(text, { file: scriptPath });
  if (parsed.errors.length) {
    throw new UsageError(parsed.errors.map((e) => `${opts.script}:${e.n}: ${e.message}`).join('\n'));
  }
  for (const l of parsed.lines) {
    if (l.kind !== 'speech') continue;
    for (const w of normaliseNonverbals(l.text).warnings) warn(`line ${l.n}: ${w}`);
  }
  log(`[1/8] parse: ${parsed.lines.filter((l) => l.kind === 'speech').length} lines, ${parsed.lines.filter((l) => l.kind === 'cue').length} cues`);

  // 2. plan
  const nativeTable = loadNativeTable({ env });
  let plan = planRender(parsed, { preset: opts.preset, nativeTable, env });
  const preset = plan.preset;
  log(`[2/8] plan: preset ${preset.key}, ${plan.items.length} items`);

  const out = resolve(opts.out);

  // The user's own voice. `record` speakers need consent and a recording of
  // every line (record.mjs, same --out); clone:<name> voices need the stored
  // reference and its consent. Both are script problems (exit 1).
  const speechItems = plan.items.filter((i) => i.kind === 'speech');
  const recItems = speechItems.filter((i) => i.recorded);
  let recordings = new Map();
  if (recItems.length) {
    const r = recordingsFor(out, recItems);
    const cmd = (speaker) => `node scripts/record.mjs "${scriptPath}" --speaker ${speaker} --out "${out}"`;
    if (r.noConsent.length) throw new UsageError(`No consent statement for the recorded speaker${r.noConsent.length === 1 ? '' : 's'} ${r.noConsent.join(', ')} in ${join(out, 'recordings', 'consent.json')}. Record with: ${r.noConsent.map(cmd).join(' ; ')}`);
    if (r.missing.length) {
      const bySpeaker = new Map();
      for (const m of r.missing) bySpeaker.set(m.item.speaker, [...(bySpeaker.get(m.item.speaker) ?? []), m]);
      throw new UsageError([...bySpeaker].map(([sp, ms]) => `Missing recordings for ${sp}: ${ms.map((m) => `${m.item.rec_id}${m.reason === 'not recorded' ? '' : ` (${m.reason})`}`).join(', ')}. Record them: ${cmd(sp)} --line ${ms.map((m) => m.item.n).join(',')}`).join('\n'));
    }
    recordings = r.found;
  }
  const clones = new Map();
  for (const it of speechItems) {
    const f = parseVoice(it.voice);
    if (f.kind === 'clone' && !clones.has(it.voice)) clones.set(it.voice, loadCloneVoice(f.name, { env, ...(f.base ? { base: f.base } : {}) }));
  }

  if (!(await (ctx.hasFfmpeg ?? hasFfmpeg)())) throw new SetupError('ffmpeg not found. Install it (macOS: `brew install ffmpeg`, Linux: `sudo apt install ffmpeg`) or set AGENTATELIER_FFMPEG.');
  const engine = await selectEngine({ draft: opts.draft, engine: ctx.engine, env, checkSetupImpl: ctx.checkSetup, clone: clones.size > 0, checkCloneImpl: ctx.checkCloneSetup });
  const draft = engine.mode === 'draft';
  if (draft) warn('draft voice: rendered with the system voice for timing only (not Supertonic); not for release');
  if (draft && clones.size) warn(`clone voice${clones.size === 1 ? '' : 's'} ${[...new Set([...clones.values()].map((c) => c.name))].join(', ')}: drafted with the system voice, not converted`);
  if (!draft && clones.size) run.cloneSession = openCloneSession(engine, env);
  if (clones.size) log(`      clone voices: ${[...clones.values()].map((c) => `${c.name} (base ${c.base})`).join(', ')}`);
  const cacheDir = join(out, '.cache');
  mkdirSync(cacheDir, { recursive: true });
  const progress = (stage) => ({ onProgress: ({ progress: i, total }) => { if (i === total || i % 10 === 0) log(`      ${stage} ${i}/${total}`); } });

  // 3. synth (take 0 for every speech segment, one worker process)
  // 4. QA per line with retakes (seed + 1, up to --takes); word timestamps come from here
  const takeItem = (it, seed) => ({ text: it.text, voice: it.voice, lang: it.lang, speed: it.speed, seed });
  const doQa = opts.qa && !draft;
  const takes = new Map();
  const byId = new Map();
  let first = [];
  async function renderSpeech(items, label = '') {
    const firstTakes = await synthBatch(items.map((it) => takeItem(it, it.seed ?? 0)), { cacheDir, engine, env, draftSynth: ctx.draftSynth, ...progress('synth') });
    log(`[3/8] synth${label}: ${items.length} segments (${firstTakes.filter((r) => r.cached).length} cached)${draft ? ' [draft voice]' : ''}`);
    for (const [i, it] of items.entries()) {
      byId.set(it.id, it);
      takes.set(it.id, [{ id: it.id, n: it.n, seed: it.seed ?? 0, ...firstTakes[i] }]);
    }
    if (!doQa) return firstTakes;
    let pending = items.map((it) => takes.get(it.id)[0]);
    for (let round = 1; pending.length; round++) {
      const heard = await asrBatch(pending.map((t) => ({ key: t.key, path: t.path, lang: byId.get(t.id).lang })), { cacheDir, engine, env, ...progress('asr') });
      pending.forEach((t, i) => Object.assign(t, { asr: heard[i] }, checkLine({ text: byId.get(t.id).text, lang: byId.get(t.id).lang, native_at: byId.get(t.id).native_at }, heard[i])));
      const retakes = retakePlan(items.flatMap((it) => takes.get(it.id)), opts.takes);
      log(`[4/8] qa${label} round ${round}: ${pending.length} checked, ${pending.filter((t) => t.ok).length} ok, ${retakes.length} retake${retakes.length === 1 ? '' : 's'}`);
      if (!retakes.length) break;
      const again = await synthBatch(retakes.map((r) => takeItem(byId.get(r.id), r.seed)), { cacheDir, engine, env, ...progress('synth') });
      pending = retakes.map((r, i) => {
        const t = { id: r.id, n: r.n, seed: r.seed, ...again[i] };
        takes.get(r.id).push(t);
        return t;
      });
    }
    return firstTakes;
  }
  let speech = plan.items.filter((i) => i.kind === 'speech');
  // Recorded lines: one take each, checked at record time; QA re-checks the
  // stored transcript (a line the speaker chose to keep passes with a note).
  for (const it of speech.filter((i) => i.recorded)) {
    const rec = recordings.get(it.id);
    const verdict = checkLine({ text: it.text, lang: it.lang }, rec.asr ?? { text: rec.heard ?? '' });
    const notes = [...(verdict.notes ?? [])];
    let ok = verdict.ok;
    if (!ok && rec.accepted) { notes.push(`kept by the speaker although: ${verdict.problems.join('; ')}`); ok = true; }
    byId.set(it.id, it);
    takes.set(it.id, [{ id: it.id, n: it.n, seed: 0, key: rec.sha256, path: rec.path, duration_s: rec.duration_s, asr: rec.asr, recorded: true, ...verdict, ok, problems: ok ? [] : verdict.problems, notes }]);
  }
  if (recordings.size) log(`[3/8] recordings: ${recordings.size} recorded line${recordings.size === 1 ? '' : 's'}`);
  first = await renderSpeech(speech.filter((i) => !i.recorded));
  if (!doQa) log(`[4/8] qa: skipped (${draft ? 'draft voice' : '--no-qa'}); word times are estimated`);

  // nonverbals: auto keeps the native tags the voice's row allows inline for the engine. A line whose
  // every take still failed is re-planned with its tags spliced from samples.
  const fallbackLines = new Set();
  if (doQa) {
    for (const it of speech) if (!it.recorded && ENGINE_TAG_RE.test(it.text) && !pickBest(takes.get(it.id)).ok) fallbackLines.add(it.n);
  }
  if (fallbackLines.size) {
    plan = planRender(parsed, { preset: opts.preset, spliceLines: fallbackLines, nativeTable, env });
    for (const it of speech) if (fallbackLines.has(it.n)) takes.delete(it.id);
    speech = plan.items.filter((i) => i.kind === 'speech');
    const redo = speech.filter((it) => fallbackLines.has(it.n));
    warn(`nonverbal fallback: line${fallbackLines.size === 1 ? '' : 's'} ${[...fallbackLines].join(', ')} kept speaking the inline tag; re-rendered with the tag spliced from the sample pack`);
    await renderSpeech(redo, ' (nv fallback)');
  }
  const best = new Map([...takes].map(([id, ts]) => [id, doQa ? pickBest(ts) : ts[0]]));

  // Rendered audio for the layout.
  const rendered = {};
  for (const [id, t] of best) rendered[id] = { path: t.path, duration_s: t.duration_s };
  const provisional = layoutTimeline({ ...plan, items: plan.items.filter((i) => i.kind !== 'cue' && i.kind !== 'nv') }, rendered, preset).duration_s;

  // 5. sounds: nonverbal clips, cues, music bed → <out>/assets with license sidecars
  const assets = new Map();
  const addAsset = (id, type, a) => {
    if (!a?.path) return;
    const key = a.path;
    if (assets.has(key)) assets.get(key).ids.push(id);
    else assets.set(key, { ids: [id], type, path: a.path, source: a.source, title: a.title ?? '', creator: a.creator ?? '', license: a.license ?? '', license_url: a.license_url ?? '', source_url: a.source_url ?? '', attribution: a.attribution ?? '' });
  };
  const freesoundToken = freesoundTokenFromEnv(env);
  const sources = opts.sources ?? defaultSources(freesoundToken);
  const soundOpts = { projectDir: dirname(scriptPath), offline: opts.offline, destDir: join(out, 'assets'), fetchImpl: ctx.fetchImpl, cacheDir: ctx.cacheDir, freesoundToken, sources };
  const items = plan.items.map((it) => ({ ...it, ...(it.cue ? { cue: { ...it.cue } } : {}) }));
  const variants = new Map();
  for (const [i, it] of items.entries()) {
    if (it.kind === 'nv') {
      const vkey = `${genderOf({ voice: it.base_voice ?? it.voice })}-${it.tag}`;
      const variant = ((variants.get(vkey) ?? 0) % 2) + 1;
      variants.set(vkey, variant);
      const clip = await nonverbalClip(it, { outDir: out, cacheDir, offline: opts.offline, variant, sources, fetchImpl: ctx.fetchImpl, freesoundToken, projectDir: dirname(scriptPath) });
      if (clip.warning) warn(clip.warning);
      if (!clip.path) {
        items[i] = { id: it.id, n: it.n, kind: 'pause', lang: it.lang, pre_s: 0.4 };
        continue;
      }
      // Match the clip's level to the speech of the same line.
      const neighbour = speech.find((s) => s.n === it.n);
      if (neighbour && best.get(neighbour.id)) {
        // Active RMS on both sides: the speech clip's own lead-in/tail silence must not make the breath hot.
        const match = nvMatchGain(await activeRmsDb(clip.path), await activeRmsDb(best.get(neighbour.id).path));
        items[i] = { ...it, gain_db: Math.round(((it.gain_db ?? 0) + match) * 100) / 100 };
      }
      rendered[it.id] = { path: clip.path, duration_s: clip.duration_s };
      addAsset(it.id, 'nv', clip.asset);
    } else if (it.kind === 'cue' && ['sfx', 'ambience', 'music'].includes(it.cue.type)) {
      if (it.cue.type === 'music' && MUSIC_CONTROLS.has(String(it.cue.value).trim().toLowerCase())) continue;
      const r = await resolveCue(it.cue, { ...soundOpts, offline: opts.offline || isRoomTone(it.cue), seconds: Math.ceil(provisional) + 2 });
      if (r.warning) warn(`${it.id} ${it.cue.type} "${it.cue.value}": ${r.warning}`);
      if (!r.path) continue;
      it.cue.path = r.path;
      if (it.cue.type === 'sfx') {
        const wav = await toWav(r.path, join(cacheDir, 'sfx', `${basename(r.path)}.wav`));
        rendered[it.id] = { path: r.path, duration_s: wav.duration_s };
      }
      addAsset(it.id, it.cue.type, { ...(r.sidecar ?? {}), path: r.path, source: r.source });
    }
  }
  const meta = { ...plan.meta };
  if (meta.music && typeof meta.music === 'object' && (meta.music.search || meta.music.file || meta.music.path)) {
    const r = await resolveCue({ type: 'music', value: meta.music.file ?? meta.music.path ?? meta.music.search }, { ...soundOpts, seconds: Math.ceil(provisional) + 2 });
    if (r.warning) warn(`music bed "${meta.music.search ?? meta.music.file ?? meta.music.path}": ${r.warning}`);
    meta.music = { ...meta.music, path: r.path };
    if (r.path) addAsset('bed', 'music', { ...(r.sidecar ?? {}), path: r.path, source: r.source });
  }
  log(`[5/8] sounds: ${assets.size} asset${assets.size === 1 ? '' : 's'}${opts.offline ? ' (offline)' : ''}`);

  // 6. layout + stems + mix
  const mixPlan = { ...plan, meta, items };
  const timeline = layoutTimeline(mixPlan, rendered, preset);
  for (const w of timeline.warnings) warn(w);
  const stemsDir = join(out, 'stems');
  const dialogue = await buildDialogueStem(timeline, join(stemsDir, 'dialogue.wav'), { speakerDir: stemsDir });
  const mixed = await buildMix(timeline, dialogue, preset, join(cacheDir, 'premaster.wav'), { stemDir: stemsDir });
  log(`[6/8] mix: ${fmt(timeline.duration_s, 2)} s, stems: ${Object.keys(mixed.stems).filter((k) => k !== 'speakers').join(', ')} + ${Object.keys(dialogue.speakers).length} speaker`);

  // 7. master + gate. Silence that a [pause] asked for is allowed (padded by
  // PAUSE_PAD_S each side: clips carry a little silence of their own).
  const allowSilence = [];
  let lastEnd = 0;
  let paused = false;
  const lineById = new Map(timeline.lines.map((l) => [l.id, l]));
  for (const it of items) {
    if (it.kind === 'pause') paused = true;
    const l = lineById.get(it.id);
    if (!l) continue;
    if (paused) allowSilence.push({ start: Math.max(0, lastEnd - PAUSE_PAD_S), end: l.start + PAUSE_PAD_S });
    paused = false;
    lastEnd = l.end;
  }
  const mastering = await master(mixed.path, join(out, 'mix.wav'), preset.loudness, { allowSilence });
  log(`[7/8] master: ${mastering.mode === 'acx' ? `RMS ${fmt(mastering.rms)} dB, peak ${fmt(mastering.peak)} dBFS` : `${fmt(mastering.I)} LUFS, true peak ${fmt(mastering.TP)} dBTP`}${mastering.ok ? '' : ` (gate failed: ${mastering.problems.join('; ')})`}`);
  if (mastering.mp3_limiter_db !== null && mastering.mp3_limiter_db !== undefined) log(`      mix.mp3: encoding overshot the peak limit; re-encoded through a ${fmt(mastering.mp3_limiter_db)} dBFS limiter (mp3 true peak ${fmt(mastering.mp3_TP)} dBTP)`);

  // 8. deliver
  const words = {};
  for (const l of timeline.lines) {
    if (l.kind !== 'speech') continue;
    const t = best.get(l.id);
    const dur = l.end - l.start;
    words[l.id] = t?.asr?.words?.length ? alignWords(l.text, t.asr.words, dur) : estimateWords(l.text, dur);
  }
  const assetList = [...assets.values()];
  const doc = writeTimeline({ ...timeline, warnings, title: meta.title ?? basename(scriptPath).replace(/\.audio\.md$|\.md$/i, ''), assets: assetList }, words, join(out, 'timeline.json'));
  const speakerLabels = new Set(doc.lines.map((l) => l.speaker)).size > 1;
  writeFileSync(join(out, 'captions.srt'), writeCaptions(doc, { format: 'srt', speakerLabels }));
  writeFileSync(join(out, 'captions.vtt'), writeCaptions(doc, { format: 'vtt', speakerLabels }));
  writeAudioMeta(doc, mixed.stems, join(out, 'audio_meta.json'));
  const recordedSpeakers = [...new Set(speech.filter((i) => i.recorded).map((i) => i.speaker))];
  const cloneCredits = [...new Set(speech.filter((i) => parseVoice(i.voice).kind === 'clone').map((i) => i.speaker))]
    .map((speaker) => ({ speaker, ...clones.get(speech.find((i) => i.speaker === speaker && parseVoice(i.voice).kind === 'clone').voice) }));
  writeCredits(assetList, join(out, 'CREDITS.md'), { draft, recorded: recordedSpeakers, clones: draft ? [] : cloneCredits, synth: speech.some((i) => !i.recorded) });

  const qaLines = doQa ? speech.map((it) => {
    const all = takes.get(it.id);
    const b = best.get(it.id);
    const problems = it.recorded && !b.ok ? [...b.problems, `re-record: node scripts/record.mjs "${scriptPath}" --speaker ${it.speaker} --out "${out}" --line ${it.n}`] : b.problems;
    return { id: it.id, n: it.n, speaker: it.speaker, voice: it.voice, text: it.text, seed: b.seed, takes: all.length, ok: b.ok, wer: Math.round(b.wer * 1000) / 1000, problems, heard: b.asr?.text ?? '', flagged: !b.ok, ...(it.recorded ? { recorded: true } : {}), ...(b.notes?.length ? { notes: b.notes } : {}), ...(fallbackLines.has(it.n) ? { nv_fallback: true } : {}) };
  }) : [];
  const report = qaReport(qaLines, { ...mastering, target: preset.loudness });
  delete report.mastering.silences;
  const qa = { ...report, draft, qa_skipped: !doQa, preset: preset.key, warnings };
  writeFileSync(join(out, 'qa.json'), JSON.stringify(qa, null, 2) + '\n');
  const outputs = ['mix.wav', 'mix.mp3', ...Object.values(mixed.stems).flatMap((v) => (typeof v === 'string' ? [v] : Object.values(v))).map((p) => p.slice(out.length + 1)), 'timeline.json', 'captions.srt', 'captions.vtt', 'audio_meta.json', 'CREDITS.md', 'qa.json'];
  log(`[8/8] deliver: ${outputs.length} files in ${out}`);

  const problems = [...qaLines.filter((l) => !l.ok).map((l) => `${l.id} "${l.text}": ${l.problems.join(', ')} (best of ${l.takes} take${l.takes === 1 ? '' : 's'}, heard "${l.heard}")`), ...mastering.problems];
  const summary = {
    ok: qa.ok, title: doc.title, preset: preset.key, draft, duration_s: doc.duration_s,
    loudness: { mode: mastering.mode, I: mastering.I, TP: mastering.TP, rms: mastering.rms, peak: mastering.peak, target: preset.loudness },
    qa: { checked: qaLines.length, failed: qaLines.filter((l) => !l.ok).length, skipped: !doQa, retakes: qaLines.reduce((a, l) => a + l.takes - 1, 0) },
    problems, warnings, out, outputs,
    cache: { synth_hits: first.filter((r) => r.cached).length, synth_total: first.length },
  };
  return { code: qa.ok ? 0 : 3, summary };
}

function summaryText(s) {
  const lines = [];
  lines.push(`${s.ok ? 'Done' : 'QA FAILED'}: ${s.title} (${s.preset}${s.draft ? ', DRAFT VOICE' : ''}), ${fmt(s.duration_s, 2)} s`);
  const L = s.loudness;
  lines.push(L.mode === 'acx'
    ? `Loudness: RMS ${fmt(L.rms)} dB, peak ${fmt(L.peak)} dBFS (ACX ${L.target.rms_min}…${L.target.rms_max} dB RMS, peak ≤ ${L.target.peak_max} dBFS)`
    : `Loudness: ${fmt(L.I)} LUFS, true peak ${fmt(L.TP)} dBTP (target ${L.target.I} LUFS ±1, ≤ ${L.target.TP} dBTP)`);
  lines.push(s.qa.skipped ? 'QA: transcript check skipped' : `QA: ${s.qa.checked - s.qa.failed}/${s.qa.checked} segments clean${s.qa.retakes ? `, ${s.qa.retakes} retake${s.qa.retakes === 1 ? '' : 's'}` : ''}`);
  for (const p of s.problems) lines.push(`  problem: ${p}`);
  if (s.warnings.length) lines.push(`Warnings (${s.warnings.length}), see qa.json:`, ...s.warnings.map((w) => `  ${w}`));
  lines.push(`Outputs in ${s.out}:`, `  ${s.outputs.join(', ')}`);
  return lines.join('\n') + '\n';
}

export async function main(argv, ctx = {}) {
  const stdout = ctx.stdout ?? ((s) => process.stdout.write(s));
  const stderr = ctx.stderr ?? ((s) => process.stderr.write(s));
  if (wantsHelp(argv)) { stdout(`${USAGE}\n`); return 0; }
  let opts;
  try {
    opts = parse(argv);
    const { code, summary } = await produce(opts, { ...ctx, progress: (l) => stderr(`${l}\n`) });
    stdout(opts.json ? JSON.stringify({ exit: code, ...summary }, null, 2) + '\n' : summaryText(summary));
    return code;
  } catch (e) {
    const code = exitCodeFor(e);
    if (code === 1) stderr(`${e.message}\n`);
    else if (e?.name === 'SetupError') stderr(`Setup missing: ${e.message}\n`);
    else stderr(`Service error: ${e?.message ?? e}\n`);
    if (opts?.json) stdout(JSON.stringify({ exit: code, ok: false, error: e?.message ?? String(e) }, null, 2) + '\n');
    return code;
  }
}

// Compare real paths so the script also runs when invoked through a symlink.
const isMain = (() => { try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; } })();

if (isMain) {
  process.exitCode = await main(process.argv.slice(2));
}

