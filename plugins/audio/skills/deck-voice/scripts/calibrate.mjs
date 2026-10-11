#!/usr/bin/env node
// calibrate.mjs: measures which native nonverbal tags each voice performs as a
// sound rather than a spoken word, and writes the table produce.mjs plans with
// (assets/native-tags.json). Every tag is sent as a joined stack at its
// NATIVE_STACK count (a laugh at its normal size), in two positions x N seeds per voice, and
// checked by the production QA (tag words, words inserted where the tag sat,
// fuzzy tag stems). A tag is ok for a voice only if every take passes. The
// table's owner_overrides (listening tests) are kept and always win.
// Exit codes: 0 ok · 1 usage error · 2 setup missing or service error.
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { UsageError, wantsHelp } from './lib/args.mjs';
import { CANDIDATE_TAGS, NATIVE_TABLE_PATH, nativeVerdict, stackOf } from './lib/native.mjs';
import { checkLine, nativePositions } from './lib/qa.mjs';
import { selectEngine, synthBatch, asrBatch, exitCodeFor, VOICES } from './lib/render.mjs';

const USAGE = 'Usage: node scripts/calibrate.mjs [--voices all|F1,M3] [--tags laugh] [--seeds 4] [--out <native-tags.json>] [--cache <dir>]';

// Only the laugh is calibrated by default: the placement test ruled every other
// tag out for all voices (owner_overrides "*"). --tags can still measure them.
export const DEFAULT_TAGS = ['laugh'];

// Two positions: the tag opening a line and the tag between two sentences.
export const SENTENCES = [
  (stack) => `${stack} I did not expect to see you here tonight.`,
  (stack) => `That was close. ${stack} Okay, let us go home now.`,
];

function parse(argv) {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, allowPositionals: false, options: { voices: { type: 'string' }, tags: { type: 'string' }, seeds: { type: 'string' }, out: { type: 'string' }, cache: { type: 'string' }, help: { type: 'boolean', short: 'h' } } });
  } catch (e) {
    throw new UsageError(`${e.message}\n${USAGE}`);
  }
  const { values } = parsed;
  if (values.help) throw new UsageError(USAGE);
  const want = (values.voices ?? 'all').trim();
  const voices = want.toLowerCase() === 'all' ? VOICES : [...new Set(want.split(',').map((v) => v.trim().toUpperCase()).filter(Boolean))];
  const badV = voices.filter((v) => !VOICES.includes(v));
  if (!voices.length || badV.length) throw new UsageError(`Unknown voice ${badV.join(', ')}. Use all or a comma list of ${VOICES.join(', ')}.\n${USAGE}`);
  const tags = values.tags ? [...new Set(values.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))] : DEFAULT_TAGS;
  const badT = tags.filter((t) => !CANDIDATE_TAGS.includes(t));
  if (!tags.length || badT.length) throw new UsageError(`Unknown tag ${badT.join(', ')}. Tags: ${CANDIDATE_TAGS.join(', ')}.\n${USAGE}`);
  if (values.seeds !== undefined && !/^[1-9]\d*$/.test(values.seeds)) throw new UsageError(`--seeds must be a whole number of at least 1.\n${USAGE}`);
  return { voices, tags, seeds: Number(values.seeds ?? 4), out: resolve(values.out ?? NATIVE_TABLE_PATH), cache: resolve(values.cache ?? join(tmpdir(), 'agentskilldeck-calibrate')) };
}

// Merges measured rows into a table, keeping owner_overrides and other rows.
export function mergeTable(table, rows, meta) {
  const next = { ...table, _meta: { ...(table._meta ?? {}), ...meta, status: 'calibrated' } };
  for (const [voice, tags] of Object.entries(rows)) next[voice] = { ...(table[voice] ?? {}), ...tags };
  next.owner_overrides = table.owner_overrides ?? {};
  // Stable key order: _meta, voices, owner_overrides.
  const ordered = { _meta: next._meta };
  for (const v of Object.keys(next).filter((k) => k !== '_meta' && k !== 'owner_overrides').sort()) ordered[v] = next[v];
  ordered.owner_overrides = next.owner_overrides;
  return ordered;
}

export async function calibrate(opts, ctx = {}) {
  const env = ctx.env ?? process.env;
  const log = ctx.progress ?? (() => {});
  const engine = await selectEngine({ engine: ctx.engine, env, checkSetupImpl: ctx.checkSetup });
  mkdirSync(opts.cache, { recursive: true });
  const items = [];
  for (const voice of opts.voices) for (const tag of opts.tags) {
    const stack = Array(stackOf(tag, 2)).fill(`<${tag}>`).join(''); // joined, as the planner sends it
    SENTENCES.forEach((make, pos) => {
      for (let seed = 0; seed < opts.seeds; seed++) items.push({ voice, tag, pos, seed, text: make(stack), lang: 'en', speed: 1 });
    });
  }
  log(`calibrate: ${opts.voices.length} voice(s) x ${opts.tags.length} tag(s) x ${SENTENCES.length} positions x ${opts.seeds} seeds = ${items.length} takes`);
  const progress = (stage) => ({ onProgress: ({ progress: i, total }) => { if (i === total || i % 25 === 0) log(`  ${stage} ${i}/${total}`); } });
  const synth = await synthBatch(items, { cacheDir: opts.cache, engine, env, calibrate: true, ...progress('synth') });
  const heard = await asrBatch(synth.map((s) => ({ key: s.key, path: s.path, lang: 'en' })), { cacheDir: opts.cache, engine, env, ...progress('asr') });
  const rows = {};
  items.forEach((it, i) => {
    const r = checkLine({ text: it.text, lang: 'en', native_at: nativePositions(it.text) }, heard[i]);
    const row = ((rows[it.voice] ??= {})[it.tag] ??= { pass: 0, total: 0, ok: false, failed: [] });
    row.total++;
    if (r.ok) row.pass++;
    else if (row.failed.length < 3) row.failed.push(heard[i].text.trim());
  });
  for (const tags of Object.values(rows)) for (const row of Object.values(tags)) {
    row.ok = row.pass === row.total;
    if (!row.failed.length) delete row.failed;
  }
  let table = {};
  try { table = JSON.parse(readFileSync(opts.out, 'utf8')); } catch { /* new table */ }
  const meta = {
    calibrated_at: (ctx.now ?? new Date()).toLocaleDateString('en-CA'),
    engine: 'supertonic 3 (supertonic 1.3.1), 10 steps; QA faster-whisper',
    seeds: opts.seeds,
    sentences: SENTENCES.map((f) => f('<tag> x N')),
    stack: Object.fromEntries(opts.tags.map((t) => [t, stackOf(t, 2)])),
  };
  const next = mergeTable(table, rows, meta);
  writeFileSync(opts.out, `${JSON.stringify(next, null, 2)}\n`);
  return { out: opts.out, rows, table: next };
}

export function summary(table, voices, tags) {
  const head = `| Voice | ${tags.join(' | ')} |`;
  const rule = `|---|${tags.map(() => '---').join('|')}|`;
  const body = voices.map((v) => `| ${v} | ${tags.map((t) => {
    const r = table[v]?.[t];
    const verdict = nativeVerdict(v, t, table);
    const measured = r?.total ? `${r.pass}/${r.total}` : '-';
    return `${measured} ${verdict.ok ? 'native' : 'sample'}${verdict.source === 'owner' ? ' (owner)' : ''}`;
  }).join(' | ')} |`);
  return [head, rule, ...body].join('\n');
}

export async function main(argv, ctx = {}) {
  const stdout = ctx.stdout ?? ((s) => process.stdout.write(s));
  const stderr = ctx.stderr ?? ((s) => process.stderr.write(s));
  if (wantsHelp(argv)) { stdout(`${USAGE}\n`); return 0; }
  try {
    const opts = parse(argv);
    const r = await calibrate(opts, { ...ctx, progress: (l) => stderr(`${l}\n`) });
    stdout(`Wrote ${r.out}\n${summary(r.table, opts.voices, opts.tags)}\n`);
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
