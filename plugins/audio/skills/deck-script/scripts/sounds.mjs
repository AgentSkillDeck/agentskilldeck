#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseCli, requireQuery, UsageError, wantsHelp } from './lib/args.mjs';
import { ServiceError } from './lib/http.mjs';
import { searchSounds, KINDS, freesoundTokenFromEnv, parseSources } from './lib/sounds/index.mjs';

const USAGE = 'Usage: node scripts/sounds.mjs search "<query>" --kind sfx|music|ambience [--limit 1-5] [--min-duration s] [--max-duration s] [--sources openverse,commons[,archive][,freesound]] [--json]';

const fmtDuration = (s) => (s == null ? 'unknown' : s >= 90 ? `${Math.floor(s / 60)} min ${Math.round(s % 60)} s` : `${s.toFixed(1)} s`);

export function toMarkdown({ kind, query, results, warnings }) {
  const lines = [];
  if (!results.length) {
    lines.push(`No licensed ${kind} found for "${query}". Try a broader or different term (an object, a place or a mood), or use a generated bed for ambience.`);
  } else {
    lines.push(`${results.length} ${kind} result${results.length > 1 ? 's' : ''} for "${query}" (CC0 / CC BY only):`, '');
    results.forEach((r, i) => {
      lines.push(`${i + 1}. **${r.title}** (${r.source})`);
      lines.push(`   Duration: ${fmtDuration(r.duration_s)}`);
      lines.push(`   License: ${r.license}${r.license_url ? ` (${r.license_url})` : ''}`);
      lines.push(`   Attribution: ${r.attribution}`);
      lines.push(`   Preview: ${r.download_url}`);
      lines.push(`   Source: ${r.source_url}`);
    });
    lines.push('', 'Verify the license fits this project before use. Nothing was downloaded; produce.mjs fetches cues into <out>/assets/ with a license sidecar.');
  }
  for (const w of warnings) lines.push(`Warning: ${w}`);
  return lines.join('\n') + '\n';
}

function num(v, name) {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new UsageError(`${name} must be a number of seconds.\n${USAGE}`);
  return n;
}

export async function main(argv, { fetchImpl, cacheDir, env = process.env, stdout = (s) => process.stdout.write(s), stderr = (s) => process.stderr.write(s) } = {}) {
  if (wantsHelp(argv)) { stdout(`${USAGE}\n`); return 0; }
  try {
    const { values, positionals } = parseCli(argv, {
      usage: USAGE,
      options: { kind: { type: 'string' }, 'min-duration': { type: 'string' }, 'max-duration': { type: 'string' }, sources: { type: 'string' } },
    });
    const [cmd, ...rest] = positionals;
    if (cmd !== 'search') throw new UsageError(`Unknown or missing command "${cmd ?? ''}".\n${USAGE}`);
    const kind = values.kind ?? 'sfx';
    if (!KINDS.includes(kind)) throw new UsageError(`Unknown kind "${kind}".\n${USAGE}`);
    const query = requireQuery(rest.join(' '), USAGE);
    const freesoundToken = freesoundTokenFromEnv(env);
    let sources;
    if (values.sources !== undefined) {
      try { sources = parseSources(values.sources); } catch (e) { throw new UsageError(`${e.message}\n${USAGE}`); }
    }
    const res = await searchSounds(query, {
      kind, limit: values.limit, fetchImpl, cacheDir, freesoundToken, sources,
      minDuration: num(values['min-duration'], '--min-duration'), maxDuration: num(values['max-duration'], '--max-duration'),
    });
    const { results, warnings, failed } = res;
    stdout(values.json ? JSON.stringify({ kind, query, results, warnings }, null, 2) + '\n' : toMarkdown({ kind, query, results, warnings }));
    // Every source down and nothing found: a service problem, not an empty catalogue.
    if (!results.length && res.sources.length > 0 && failed.length === res.sources.length) {
      stderr('Service error: every sound source failed. This is not an empty library; retry later, use a local file, or rely on the generator.\n');
      return 2;
    }
    return 0;
  } catch (e) {
    if (e instanceof UsageError) { stderr(e.message + '\n'); return 1; }
    if (e instanceof ServiceError) { stderr(`Service error: ${e.message}.\n`); return 2; }
    stderr(`sounds: unexpected error (${e?.message ?? e})\n`);
    return 2;
  }
}

// Compare real paths so the script also runs when invoked through a symlink.
const isMain = (() => { try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; } })();

if (isMain) {
  process.exitCode = await main(process.argv.slice(2));
}
