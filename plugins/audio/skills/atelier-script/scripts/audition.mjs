#!/usr/bin/env node
// audition.mjs: one line read by several voices, one mp3 each, plus audition.md.
// Exit codes: 0 ok · 1 usage error · 2 setup missing or service error.
import { mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { UsageError, wantsHelp } from './lib/args.mjs';
import { planRender } from './lib/plan.mjs';
import { DELIVERY_PRESETS, EMOTION_NAMES } from './lib/presets.mjs';
import { layoutTimeline, buildDialogueStem } from './lib/mix.mjs';
import { hasFfmpeg, run } from './lib/ffmpeg.mjs';
import { SetupError } from './lib/engine.mjs';
import { selectEngine, synthBatch, nonverbalClip, exitCodeFor, VOICES } from './lib/render.mjs';

const USAGE = 'Usage: node scripts/audition.mjs "<line>" --out <dir> [--voices all|F1,M3] [--emotion name] [--lang en] [--seed 0] [--draft]';

// Measured on one sentence, seed 0 (median pitch, pitch range, words per second).
export const VOICE_NOTES = {
  F1: 'female, mid pitch (188 Hz), even, 2.8 words/s',
  F2: 'female, brightest (207 Hz), most expressive, 3.0 words/s',
  F3: 'female, mid-low (179 Hz), gentle range, 2.8 words/s',
  F4: 'female, mid (196 Hz), brisk, 3.3 words/s (default narrator)',
  F5: 'female, lowest and flattest (158 Hz), 2.9 words/s',
  M1: 'male, highest (141 Hz), lively, 2.8 words/s',
  M2: 'male, deep (89 Hz), expressive, 2.9 words/s',
  M3: 'male, deep (96 Hz), steady, quick 3.5 words/s',
  M4: 'male, mid (120 Hz), moderate range, 3.0 words/s',
  M5: 'male, deep (89 Hz), steady, 2.9 words/s',
};

function parse(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv, allowPositionals: true,
      options: { out: { type: 'string' }, voices: { type: 'string' }, emotion: { type: 'string' }, lang: { type: 'string' }, seed: { type: 'string' }, draft: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } },
    });
  } catch (e) {
    throw new UsageError(`${e.message}\n${USAGE}`);
  }
  const { values, positionals } = parsed;
  if (values.help) throw new UsageError(USAGE);
  const line = positionals.join(' ').trim();
  if (!line) throw new UsageError(`Give the line to read, in quotes.\n${USAGE}`);
  if (!values.out) throw new UsageError(`--out <dir> is required.\n${USAGE}`);
  const want = (values.voices ?? 'all').trim();
  const voices = want.toLowerCase() === 'all' ? VOICES : [...new Set(want.split(',').map((v) => v.trim().toUpperCase()).filter(Boolean))];
  const bad = voices.filter((v) => !VOICES.includes(v));
  if (!voices.length || bad.length) throw new UsageError(`Unknown voice${bad.length > 1 ? 's' : ''} ${bad.join(', ')}. Use all or a comma list of ${VOICES.join(', ')}.\n${USAGE}`);
  const emotion = values.emotion?.trim().toLowerCase();
  if (emotion && !DELIVERY_PRESETS[emotion]) throw new UsageError(`Unknown emotion "${emotion}". Valid emotions: ${EMOTION_NAMES.join(', ')}.\n${USAGE}`);
  if (values.seed !== undefined && !/^\d+$/.test(values.seed)) throw new UsageError(`--seed must be a whole number.\n${USAGE}`);
  return { line, out: values.out, voices, emotion, lang: values.lang?.trim() || 'en', seed: Number(values.seed ?? 0), draft: Boolean(values.draft) };
}

export async function audition(opts, ctx = {}) {
  const env = ctx.env ?? process.env;
  const log = ctx.progress ?? (() => {});
  if (!(await (ctx.hasFfmpeg ?? hasFfmpeg)())) throw new SetupError('ffmpeg not found. Install it (macOS: `brew install ffmpeg`, Linux: `sudo apt install ffmpeg`).');
  const engine = await selectEngine({ draft: opts.draft, engine: ctx.engine, env, checkSetupImpl: ctx.checkSetup });
  const out = resolve(opts.out);
  const cacheDir = join(out, '.cache');
  mkdirSync(cacheDir, { recursive: true });
  const warnings = [];
  if (engine.mode === 'draft') warnings.push('draft voice: the system voice reads every take (timing only); the voices below are not Supertonic');

  // One script line per voice, through the real planner (nonverbal splice, delivery preset).
  const cast = Object.fromEntries(opts.voices.map((v) => [v, { voice: v }]));
  const lines = opts.voices.map((v, i) => ({ n: i + 1, kind: 'speech', speaker: v, emotion: opts.emotion, modifiers: [], text: opts.line, lang: opts.lang }));
  const plan = planRender({ meta: { lang: opts.lang, cast }, lines }, { preset: 'education' });
  const speech = plan.items.filter((i) => i.kind === 'speech').map((it) => ({ ...it, seed: opts.seed }));
  if (!speech.length) throw new UsageError('The line has no words to read once its nonverbal tags are removed.');
  log(`audition: ${opts.voices.length} voice${opts.voices.length > 1 ? 's' : ''}, ${speech.length} segment${speech.length > 1 ? 's' : ''}${engine.mode === 'draft' ? ' [draft voice]' : ''}`);
  const takes = await synthBatch(speech, { cacheDir, engine, env, draftSynth: ctx.draftSynth, onProgress: ({ progress, total }) => log(`      synth ${progress}/${total}`) });
  const rendered = Object.fromEntries(speech.map((it, i) => [it.id, takes[i]]));
  const items = [];
  for (const it of plan.items) {
    if (it.kind === 'nv') {
      const clip = await nonverbalClip(it, { outDir: out, cacheDir, offline: true });
      if (!clip.path) { warnings.push(clip.warning); items.push({ id: it.id, n: it.n, kind: 'pause', pre_s: 0.4 }); continue; }
      rendered[it.id] = clip;
    }
    items.push(it.kind === 'speech' ? { ...it, seed: opts.seed } : it);
  }

  const rows = [];
  for (const voice of opts.voices) {
    const mine = items.filter((it) => it.speaker === voice || (it.kind === 'pause' && items.find((x) => x.n === it.n)?.speaker === voice));
    const tl = layoutTimeline({ meta: {}, items: mine }, rendered, { gap_s: 0, lead_s: 0.15, tail_s: 0.3 });
    const wav = join(cacheDir, 'audition', `${voice}.wav`);
    await buildDialogueStem(tl, wav, { speakerDir: join(cacheDir, 'audition', 'speakers') });
    const mp3 = join(out, `${voice}.mp3`);
    await run(['-i', wav, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-q:a', '2', mp3]);
    rows.push({ voice, file: `${voice}.mp3`, duration_s: tl.duration_s, note: VOICE_NOTES[voice] ?? '' });
    log(`      ${voice}.mp3 (${tl.duration_s.toFixed(2)} s)`);
  }
  rmSync(join(cacheDir, 'audition', 'speakers'), { recursive: true, force: true });

  const md = [
    '# Audition',
    '',
    `Line: ${opts.line}`,
    `Delivery: ${opts.emotion ?? 'neutral'} · language: ${opts.lang} · seed: ${opts.seed}${engine.mode === 'draft' ? ' · DRAFT VOICE (system voice, timing only)' : ''}`,
    '',
    '| Voice | File | Length | Character |',
    '|---|---|---|---|',
    ...rows.map((r) => `| ${r.voice} | ${r.file} | ${r.duration_s.toFixed(1)} s | ${r.note} |`),
    '',
    'Listen, pick one per character, then cast it in the script front matter, for example `ELI: { voice: M3 }`.',
    ...warnings.map((w) => `\nWarning: ${w}`),
    '',
  ].join('\n');
  writeFileSync(join(out, 'audition.md'), md);
  return { out, rows, warnings, draft: engine.mode === 'draft' };
}

export async function main(argv, ctx = {}) {
  const stdout = ctx.stdout ?? ((s) => process.stdout.write(s));
  const stderr = ctx.stderr ?? ((s) => process.stderr.write(s));
  if (wantsHelp(argv)) { stdout(`${USAGE}\n`); return 0; }
  try {
    const opts = parse(argv);
    const r = await audition(opts, { ...ctx, progress: (l) => stderr(`${l}\n`) });
    for (const w of r.warnings) stderr(`warning: ${w}\n`);
    stdout(`Wrote ${r.rows.length} take${r.rows.length > 1 ? 's' : ''} and audition.md to ${r.out}:\n${r.rows.map((x) => `  ${x.file}  ${x.duration_s.toFixed(1)} s  ${x.note}`).join('\n')}\n`);
    return 0;
  } catch (e) {
    const code = exitCodeFor(e);
    if (code === 1) stderr(`${e.message}\n`);
    else if (e?.name === 'SetupError') stderr(`Setup missing: ${e.message}\n`);
    else stderr(`Service error: ${e?.message ?? e}\n`);
    return code;
  }
}

// Compare real paths so the script also runs when invoked through a symlink.
const isMain = (() => { try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; } })();

if (isMain) {
  process.exitCode = await main(process.argv.slice(2));
}
