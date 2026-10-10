#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseCli, requireQuery, UsageError } from './lib/args.mjs';
import { ServiceError } from './lib/http.mjs';
import { searchFonts } from './lib/fonts.mjs';
import { searchIcons } from './lib/icons.mjs';
import { searchPacks } from './lib/packs.mjs';
import { toMarkdown } from './lib/format.mjs';

const USAGE = 'Usage: node materials.mjs <font|icon|animated-icon|pack> "<query>" [--limit 1-5] [--category <font category>] [--json]';
const KINDS = ['font', 'icon', 'animated-icon', 'pack'];

export async function main(argv, { fetchImpl, cacheDir, stdout = (s) => process.stdout.write(s), stderr = (s) => process.stderr.write(s) } = {}) {
  let kind;
  try {
    const { values, positionals } = parseCli(argv, { usage: USAGE, options: { category: { type: 'string' } } });
    let rest;
    [kind, ...rest] = positionals;
    if (!KINDS.includes(kind)) throw new UsageError(`Unknown or missing kind "${kind ?? ''}".\n${USAGE}`);
    const query = requireQuery(rest.join(' '), USAGE);
    const deps = { limit: values.limit, fetchImpl, cacheDir };
    const res = kind === 'font' ? await searchFonts(query, { ...deps, category: values.category })
      : kind === 'icon' ? await searchIcons(query, deps)
      : kind === 'animated-icon' ? await searchIcons(query, { ...deps, animated: true })
      : await searchPacks(query, deps);
    stdout(values.json ? JSON.stringify({ kind, query, ...res }, null, 2) + '\n' : toMarkdown({ kind, query, ...res }));
    return 0;
  } catch (e) {
    if (e instanceof UsageError) { stderr(e.message + '\n'); return 1; }
    if (e instanceof ServiceError) { stderr(`Service error: ${e.message}. This is not an empty library; retry later or continue without it.\n`); return 2; }
    stderr(`${kind ?? 'materials'}: unexpected response from service (${e?.message ?? e})\n`);
    return 2;
  }
}

// Compare real paths so the script also runs when invoked through a symlink.
const isMain = (() => { try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; } })();

if (isMain) {
  process.exitCode = await main(process.argv.slice(2));
}
