#!/usr/bin/env node
// record.mjs: the user's own voice.
//   Recorded lines: a speaker cast as `voice: record` reads their lines, line by
//   line from the microphone, in one take (--one-take), or from a file the user
//   already has (--from). Each line is cleaned (trim, light denoise, 80 Hz
//   highpass, -20 LUFS), transcribed and checked against the script; produce
//   then uses the recordings in place of synthesis.
//   Reference for cloning: --reference --name me stores a 10-60 s cleaned
//   reference in ~/.agentskilldeck/voices/me/; cast `voice: clone:me`.
// Both need a typed consent statement (--consent, or typed at the prompt).
// Exit codes: 0 ok · 1 usage/script/consent error or unusable audio · 2 setup
// missing or service error · 3 a line failed the check (recordings kept).
import { readFileSync, realpathSync, existsSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { UsageError, wantsHelp } from './lib/args.mjs';
import { parseScript } from './lib/script.mjs';
import { planRender } from './lib/plan.mjs';
import { checkLine } from './lib/qa.mjs';
import { hasFfmpeg, run } from './lib/ffmpeg.mjs';
import { SetupError } from './lib/engine.mjs';
import { selectEngine, asrBatch, exitCodeFor } from './lib/render.mjs';
import {
  inputArgs, listDevicesArgs, parseDeviceList, captureLive, cleanRecording, cutClip, splitTake, importable,
  saveRecordings, recordingsDir, RecordingError, IMPORT_EXTS,
} from './lib/recorder.mjs';
import {
  parseConsent, projectConsent, addProjectConsent, CONSENT_HELP, NAME_RE, readCloneVoice, writeCloneVoice,
  medianF0, readPcm16, nearestVoice, voicesDir, privateDir,
} from './lib/voices.mjs';

const USAGE = [
  'Usage:',
  '  node scripts/record.mjs <script.audio.md> --speaker NAME --out <dir> [--one-take] [--from <file>] [--line N[,N]] [--device ID] [--consent "<statement>"] [--keep-failed] [--json]',
  '  node scripts/record.mjs --reference --name <name> [--from <file>] [--device ID] [--consent "<statement>"] [--force]',
  '  node scripts/record.mjs --list-devices',
].join('\n');

const REF_MIN_S = 10;
const REF_MAX_S = 60;
const LINE_MAX_S = 30;
const TAKE_MAX_S = 900;

// Read aloud for a clone reference: original text, every English vowel and
// most consonant clusters, questions, a list and a quiet close (~45 s).
export const REFERENCE_TEXT = 'Every morning the baker on our street rolls up the shutter at six, and the smell of warm bread drifts out over the wet pavement. Children chase pigeons past the fountain while a man in a yellow jacket sweeps the steps. Would you like the usual? she asks, and I nod, because the sourdough is perfect: chewy, sour, and just a little burnt on top. On Thursdays she bakes ginger biscuits shaped like zebras, foxes and owls. I usually buy three, eat one on the way home, and promise myself I will save the others. I never do. Measure joy however you like, but for me it is a quiet street, a hot loaf, and the first page of a good book.';

function parse(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv, allowPositionals: true,
      options: {
        speaker: { type: 'string' }, out: { type: 'string' }, 'one-take': { type: 'boolean' }, from: { type: 'string' },
        line: { type: 'string' }, device: { type: 'string' }, 'list-devices': { type: 'boolean' }, reference: { type: 'boolean' },
        name: { type: 'string' }, consent: { type: 'string' }, force: { type: 'boolean' }, 'keep-failed': { type: 'boolean' },
        json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (e) {
    throw new UsageError(`${e.message}\n${USAGE}`);
  }
  const { values: v, positionals } = parsed;
  if (v.help) throw new UsageError(USAGE);
  const o = {
    speaker: v.speaker, out: v.out, oneTake: Boolean(v['one-take']), from: v.from, device: v.device, consent: v.consent,
    force: Boolean(v.force), keepFailed: Boolean(v['keep-failed']), json: Boolean(v.json), name: v.name,
  };
  if (v.from !== undefined && !importable(v.from)) throw new UsageError(`--from must be one of ${IMPORT_EXTS.join(', ')} (got ${v.from}).`);
  if (v['list-devices']) return { mode: 'devices', ...o };
  if (v.reference) {
    if (positionals.length) throw new UsageError(`--reference takes no script.\n${USAGE}`);
    if (!v.name) throw new UsageError(`--reference needs --name <name> (the clone is then cast as voice: clone:<name>).\n${USAGE}`);
    const name = v.name.trim().toLowerCase();
    if (!NAME_RE.test(name)) throw new UsageError(`--name must be 1-40 letters, digits, - or _ (got "${v.name}").`);
    return { mode: 'reference', ...o, name };
  }
  if (positionals.length !== 1) throw new UsageError(`Expected one script file.\n${USAGE}`);
  if (!v.speaker) throw new UsageError(`--speaker NAME is required.\n${USAGE}`);
  if (!v.out) throw new UsageError(`--out <dir> is required (use the same --out as produce.mjs).\n${USAGE}`);
  let lines = null;
  if (v.line !== undefined) {
    lines = v.line.split(',').map((x) => x.trim()).filter(Boolean);
    if (!lines.length || lines.some((x) => !/^L?\d+$/i.test(x))) throw new UsageError(`--line takes script line numbers, e.g. --line 7,9 (got ${v.line}).`);
    lines = lines.map((x) => Number(x.replace(/^L/i, '')));
  }
  return { mode: 'lines', ...o, script: positionals[0], lines };
}

const fileSha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const r3 = (x) => Math.round(x * 1000) / 1000;

// Consent: already given for this speaker/voice, from --consent, or typed at a prompt.
async function getConsent({ given, existing, ctx, what }) {
  if (existing) return existing;
  if (given !== undefined) {
    const c = parseConsent(given);
    if (!c) throw new UsageError(`--consent was not one of the accepted statements.\n${CONSENT_HELP}`);
    return { ...c, via: 'flag' };
  }
  if (!ctx.interactive) throw new UsageError(`Recording ${what} needs a consent statement first. Ask the user to type it, then pass it with --consent "<statement>".\n${CONSENT_HELP}`);
  ctx.say(`Before recording ${what}: ${CONSENT_HELP}`);
  for (let i = 0; i < 3; i++) {
    const c = parseConsent(await ctx.ask('Consent statement: '));
    if (c) return { ...c, via: 'prompt' };
    ctx.say('That is not one of the two statements; try again.');
  }
  throw new UsageError(`No consent statement given; nothing was recorded.\n${CONSENT_HELP}`);
}

// Live capture needs the user at a terminal to read the lines. An agent's
// shell has no TTY: refuse there (before any consent is stored) and point to
// running the command in a terminal, or to --from.
function assertCanRecordLive(o, ctx) {
  if (o.from || ctx.interactive || ctx.inputArgs || ctx.env.AGENTSKILLDECK_RECORD_INPUT) return;
  throw new UsageError('Live recording needs a terminal: the user reads each line as it appears. Run this command yourself in a terminal (not through an agent), or give an existing recording with --from <file>.');
}

function micInput(o, ctx) {
  if (ctx.inputArgs) return ctx.inputArgs;
  if (ctx.env.AGENTSKILLDECK_RECORD_INPUT) return JSON.parse(ctx.env.AGENTSKILLDECK_RECORD_INPUT); // test seam: an ffmpeg lavfi source
  return inputArgs({ platform: ctx.platform, device: o.device });
}

async function liveTake(o, ctx, out, { maxSeconds, silenceS, intro }) {
  ctx.say(intro);
  if (ctx.interactive) await ctx.ask('Press Enter to start recording. ');
  ctx.say(ctx.interactive ? 'Recording... press Enter when done (it also stops by itself after a pause).' : `Recording... it stops by itself after ${silenceS} s of silence (or ${maxSeconds} s).`);
  ctx.keys?.resume?.();
  try {
    return await captureLive({ input: micInput(o, ctx), out, maxSeconds, silenceS, keys: ctx.keys });
  } finally {
    ctx.keys?.pause?.();
  }
}

async function listDevices(o, ctx) {
  let text = '';
  try { text = (await run(listDevicesArgs(ctx.platform))).stderr; } catch (e) { text = `${e.stderr ?? ''}\n${e.message}`; }
  const devices = parseDeviceList(ctx.platform, text);
  if (o.json) ctx.stdout(JSON.stringify({ devices }, null, 2) + '\n');
  else ctx.stdout(devices.length ? `Microphones (pass --device <id>):\n${devices.map((d) => `  ${d.id}  ${d.name}${d.default ? ' (default)' : ''}`).join('\n')}\n` : 'No microphones found.\n');
  return 0;
}

async function reference(o, ctx) {
  const existing = readCloneVoice(o.name, { env: ctx.env });
  if (existing && !o.force) throw new UsageError(`A clone voice "${o.name}" already exists in ${voicesDir({ env: ctx.env })}. Pass --force to replace its reference, or pick another --name.`);
  assertCanRecordLive(o, ctx);
  const consent = await getConsent({ given: o.consent, existing: null, ctx, what: `a reference for the clone voice "${o.name}"` });
  const work = join(voicesDir({ env: ctx.env }), '.work');
  privateDir(voicesDir({ env: ctx.env }));
  privateDir(work);
  const raw = join(work, `${o.name}-raw.wav`);
  const clean = join(work, `${o.name}-clean.wav`);
  try {
    let src = o.from ? resolve(o.from) : null;
    if (src && !existsSync(src)) throw new UsageError(`File not found: ${o.from}`);
    if (!src) {
      await liveTake(o, ctx, raw, { maxSeconds: REF_MAX_S, silenceS: 2.5, intro: `Read this aloud in your natural voice, at an easy pace (about 45 s):\n\n${REFERENCE_TEXT}\n` });
      src = raw;
    }
    const c = await cleanRecording(src, clean, { maxSeconds: REF_MAX_S });
    if (c.duration_s < REF_MIN_S) throw new RecordingError(`the reference has ${c.duration_s.toFixed(1)} s of speech; a clone needs ${REF_MIN_S}-${REF_MAX_S} s. Record the full paragraph (record.mjs --reference) or give a longer file.`);
    const { samples, sampleRate } = readPcm16(clean);
    const f0 = medianF0(samples, sampleRate);
    const meta = writeCloneVoice(o.name, { reference: clean, f0_median_hz: f0, base: nearestVoice(f0) ?? undefined, duration_s: c.duration_s, source: o.from ? 'file' : 'mic', consent }, { env: ctx.env });
    const summary = { ok: true, name: o.name, voice: `clone:${o.name}`, base: meta.base, f0_median_hz: meta.f0_median_hz, duration_s: c.duration_s, dir: join(voicesDir({ env: ctx.env }), o.name), trimmed_to_60s: c.duration_s >= REF_MAX_S - 0.05 };
    if (o.json) ctx.stdout(JSON.stringify(summary, null, 2) + '\n');
    else {
      ctx.stdout([
        `Clone voice "${o.name}" saved: ${c.duration_s.toFixed(1)} s reference, median pitch ${meta.f0_median_hz ?? '?'} Hz, base voice ${meta.base}.`,
        `Cast it in the script front matter as  NAME: { voice: clone:${o.name} }  (clone:${o.name}@F2 forces another base voice).`,
        'The first render with it needs the free clone engine: node scripts/setup.mjs --install-clone (asks once, about 2.6 GB).',
      ].join('\n') + '\n');
    }
    return 0;
  } finally {
    rmSync(raw, { force: true });
    rmSync(clean, { force: true });
  }
}

// The lines the speaker reads: one plan item each (voice: record).
function speakerLines(o, ctx) {
  const scriptPath = resolve(o.script);
  let text;
  try { text = readFileSync(scriptPath, 'utf8'); } catch (e) {
    throw new UsageError(e.code === 'ENOENT' ? `Script not found: ${o.script}` : `Cannot read ${o.script}: ${e.message}`);
  }
  const parsed = parseScript(text, { file: scriptPath });
  if (parsed.errors.length) throw new UsageError(parsed.errors.map((e) => `${o.script}:${e.n}: ${e.message}`).join('\n'));
  const cast = parsed.meta.cast ?? {};
  if (!Object.prototype.hasOwnProperty.call(cast, o.speaker)) throw new UsageError(`Speaker "${o.speaker}" is not in the cast. Speakers: ${Object.keys(cast).join(', ') || 'none'}.`);
  if (String(cast[o.speaker]?.voice ?? '').trim().toLowerCase() !== 'record') throw new UsageError(`Speaker "${o.speaker}" is cast as voice ${cast[o.speaker]?.voice ?? '(default)'}. Set  ${o.speaker}: { voice: record }  in the cast to use recordings for this speaker.`);
  const items = planRender(parsed, { env: ctx.env }).items.filter((i) => i.kind === 'speech' && i.recorded && i.speaker === o.speaker);
  if (!items.length) throw new UsageError(`Speaker "${o.speaker}" has no lines in ${o.script}.`);
  if (!o.lines) return { scriptPath, items };
  const pick = items.filter((i) => o.lines.includes(i.n));
  const unknown = o.lines.filter((n) => !items.some((i) => i.n === n));
  if (unknown.length) throw new UsageError(`Line${unknown.length === 1 ? '' : 's'} ${unknown.join(', ')} ${unknown.length === 1 ? 'is' : 'are'} not ${o.speaker}'s. ${o.speaker}'s lines: ${items.map((i) => i.n).join(', ')}.`);
  return { scriptPath, items: pick };
}

function entryFor(it, { out, path, duration_s, asr, source, mode }) {
  const verdict = checkLine({ text: it.text, lang: it.lang }, asr);
  return {
    speaker: it.speaker, n: it.n, text: it.text, path: relative(out, path), duration_s: r3(duration_s), sha256: fileSha(path),
    ok: verdict.ok, wer: Math.round(verdict.wer * 1000) / 1000, problems: verdict.problems, heard: asr.text,
    asr: { text: asr.text, words: asr.words ?? [] }, source, mode, consent: 'recordings/consent.json', recorded_at: new Date().toISOString(),
  };
}

async function lines(o, ctx) {
  const out = resolve(o.out);
  const { scriptPath, items } = speakerLines(o, ctx);
  assertCanRecordLive(o, ctx);
  const consent = await getConsent({ given: o.consent, existing: projectConsent(out, o.speaker), ctx, what: `${o.speaker}'s lines` });
  if (!projectConsent(out, o.speaker)) addProjectConsent(out, o.speaker, consent);
  if (!(await (ctx.hasFfmpeg ?? hasFfmpeg)())) throw new SetupError('ffmpeg not found. Install it (macOS: `brew install ffmpeg`, Linux: `sudo apt install ffmpeg`) or set AGENTSKILLDECK_FFMPEG.');
  const engine = await selectEngine({ engine: ctx.engine, env: ctx.env, checkSetupImpl: ctx.checkSetup });
  const cacheDir = join(out, '.cache');
  const dir = recordingsDir(out);
  privateDir(dir);
  privateDir(join(dir, 'raw'));
  const hear = async (path, lang) => (await asrBatch([{ key: fileSha(path), path, lang }], { cacheDir, engine, env: ctx.env }))[0];
  const oneTake = o.oneTake || (o.from && items.length > 1);
  if (o.from && !o.oneTake && items.length > 1) ctx.say(`--from with ${items.length} lines: reading it as one take of all of them (--one-take).`);
  const entries = {};
  const source = o.from ? 'file' : 'mic';

  if (oneTake) {
    const take = join(dir, 'takes', `${o.speaker.toLowerCase()}-${Date.now()}.wav`);
    let src = o.from ? resolve(o.from) : null;
    if (src && !existsSync(src)) throw new UsageError(`File not found: ${o.from}`);
    if (!src) {
      const raw = join(dir, 'raw', `${o.speaker.toLowerCase()}-take.wav`);
      const list = items.map((it, k) => `  ${k + 1}. ${it.prompt}`).join('\n');
      await liveTake(o, ctx, raw, { maxSeconds: Math.min(TAKE_MAX_S, 60 + items.length * 15), silenceS: 4, intro: `Read all of ${o.speaker}'s lines in order, with a short pause between them:\n${list}\n` });
      src = raw;
    }
    const clean = await cleanRecording(src, take, { maxSeconds: TAKE_MAX_S });
    ctx.say(`Take: ${clean.duration_s.toFixed(1)} s; transcribing and splitting into ${items.length} lines...`);
    const asr = await hear(take, items[0].lang);
    const parts = splitTake(items.map((it) => ({ id: it.rec_id, text: it.text, lang: it.lang })), asr.words ?? [], { duration_s: clean.duration_s, lang: items[0].lang });
    for (const [k, it] of items.entries()) {
      const p = parts[k];
      if (p.missing) { entries[it.rec_id] = null; continue; }
      const clip = await cutClip(take, join(dir, `${it.rec_id}.wav`), p.start, p.end);
      entries[it.rec_id] = entryFor(it, { out, path: clip.path, duration_s: clip.duration_s, asr: { text: p.heard, words: p.words }, source, mode: 'one-take' });
    }
  } else {
    for (const it of items) {
      for (;;) {
        const dest = join(dir, `${it.rec_id}.wav`);
        let src = o.from ? resolve(o.from) : null;
        if (src && !existsSync(src)) throw new UsageError(`File not found: ${o.from}`);
        if (!src) {
          src = join(dir, 'raw', `${it.rec_id}.wav`);
          await liveTake(o, ctx, src, { maxSeconds: LINE_MAX_S, silenceS: 1.2, intro: `\nLine ${it.n} (${o.speaker}${it.emotion ? `, ${it.emotion}` : ''}):\n  ${it.prompt}` });
        }
        const clean = await cleanRecording(src, dest);
        const e = entryFor(it, { out, path: clean.path, duration_s: clean.duration_s, asr: await hear(clean.path, it.lang), source, mode: 'line' });
        entries[it.rec_id] = e;
        if (e.ok || o.from || !ctx.interactive) break;
        ctx.say(`Heard "${e.heard}" (${e.problems.join('; ')}).`);
        const a = (await ctx.ask('Enter = record again, k = keep this take, s = skip the line: ')).trim().toLowerCase();
        if (a === 'k') { e.accepted = true; break; }
        if (a === 's') { entries[it.rec_id] = null; break; }
      }
    }
  }

  // Keep failing takes on disk; mark them accepted only when asked.
  const saved = {};
  const failed = [];
  for (const it of items) {
    const e = entries[it.rec_id];
    if (!e) { failed.push({ id: it.rec_id, n: it.n, text: it.text, problems: ['not heard in the take'] }); continue; }
    if (!e.ok && o.keepFailed) e.accepted = true;
    saved[it.rec_id] = e;
    if (!e.ok && !e.accepted) failed.push({ id: it.rec_id, n: it.n, text: it.text, heard: e.heard, wer: e.wer, problems: e.problems });
  }
  saveRecordings(out, saved);
  const rerecord = failed.length ? `node scripts/record.mjs "${scriptPath}" --speaker ${o.speaker} --out "${out}" --line ${failed.map((f) => f.n).join(',')}` : null;
  const summary = {
    ok: failed.length === 0, speaker: o.speaker, out, recorded: Object.keys(saved).length, lines: items.length,
    failed, rerecord, recordings: Object.fromEntries(Object.entries(saved).map(([id, e]) => [id, { path: e.path, duration_s: e.duration_s, wer: e.wer, ok: e.ok, ...(e.accepted ? { accepted: true } : {}) }])),
  };
  if (o.json) ctx.stdout(JSON.stringify(summary, null, 2) + '\n');
  else {
    const rows = items.map((it) => {
      const e = saved[it.rec_id];
      return e ? `  ${it.rec_id} ${e.ok ? 'ok' : e.accepted ? 'kept (failed the check)' : 'FAILED'}  ${e.duration_s.toFixed(1)} s  wer ${e.wer.toFixed(2)}  heard "${e.heard}"` : `  ${it.rec_id} MISSING  "${it.text}"`;
    });
    ctx.stdout([`${summary.ok ? 'Recorded' : 'Recorded with problems'}: ${o.speaker}, ${summary.recorded}/${items.length} lines in ${dir}`, ...rows,
      ...(rerecord ? [`Re-record the failed lines: ${rerecord}`, 'Or keep them as they are with --keep-failed.'] : [`Next: node scripts/produce.mjs "${scriptPath}" --out "${out}"`])].join('\n') + '\n');
  }
  return summary.ok ? 0 : 3;
}

export async function main(argv, ctx = {}) {
  const stdout = ctx.stdout ?? ((s) => process.stdout.write(s));
  const stderr = ctx.stderr ?? ((s) => process.stderr.write(s));
  if (wantsHelp(argv)) { stdout(`${USAGE}\n`); return 0; }
  const env = ctx.env ?? process.env;
  const interactive = ctx.interactive ?? Boolean(process.stdin.isTTY && process.stderr.isTTY);
  const ask = ctx.ask ?? (async (q) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    try { return await rl.question(q); } finally { rl.close(); }
  });
  const c = {
    ...ctx, env, stdout, interactive, ask, say: (s) => stderr(`${s}\n`), platform: ctx.platform ?? process.platform,
    keys: ctx.keys ?? (interactive ? process.stdin : null),
  };
  let o;
  try {
    o = parse(argv);
    if (o.mode === 'devices') return await listDevices(o, c);
    if (o.mode === 'reference') return await reference(o, c);
    return await lines(o, c);
  } catch (e) {
    const code = exitCodeFor(e);
    if (code === 1) stderr(`${e.message}\n`);
    else if (e?.name === 'SetupError') stderr(`Setup missing: ${e.message}\n`);
    else stderr(`Service error: ${e?.message ?? e}\n`);
    if (o?.json) stdout(JSON.stringify({ exit: code, ok: false, error: e?.message ?? String(e) }, null, 2) + '\n');
    return code;
  }
}

// Compare real paths so the script also runs when invoked through a symlink.
const isMain = (() => { try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; } })();

if (isMain) {
  process.exitCode = await main(process.argv.slice(2));
}
