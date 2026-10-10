#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { parseCli, requireQuery, UsageError } from './lib/args.mjs';
import { ServiceError } from './lib/http.mjs';
import { searchFonts } from './lib/fonts.mjs';
import { searchIcons } from './lib/icons.mjs';
import { searchPacks } from './lib/packs.mjs';
import { toMarkdown } from './lib/format.mjs';

const USAGE = 'Usage: node materials.mjs <font|icon|animated-icon|pack> "<query>" [--limit 1-5] [--category <font category>] [--json]';
const KINDS = ['font', 'icon', 'animated-icon', 'pack'];

export async function main(argv, { fetchImpl, cacheDir, stdout = (s) => process.stdout.write(s), stderr = (s) => process.stderr.write(s) } = {}) {
  try {
    const { values, positionals } = parseCli(argv, { usage: USAGE, options: { category: { type: 'string' } } });
    const [kind, ...rest] = positionals;
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
    throw e;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main(process.argv.slice(2));
}
