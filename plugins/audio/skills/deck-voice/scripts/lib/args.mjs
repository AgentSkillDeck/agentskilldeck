import { parseArgs } from 'node:util';

export class UsageError extends Error {}

const words = (q) => String(q ?? '').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

export function parseCli(argv, { usage, options = {}, maxLimit = 5 }) {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, allowPositionals: true, options: { limit: { type: 'string' }, json: { type: 'boolean' }, ...options } });
  } catch (e) {
    throw new UsageError(`${e.message}\n${usage}`);
  }
  const { values, positionals } = parsed;
  let limit = 3;
  if (values.limit !== undefined) {
    if (!/^-?\d+$/.test(values.limit)) throw new UsageError(`--limit must be a number.\n${usage}`);
    limit = Math.min(maxLimit, Math.max(1, Number(values.limit)));
  }
  return { values: { ...values, limit }, positionals };
}

export function requireQuery(q, usage) {
  if (words(q).length === 0) throw new UsageError(`Query must contain at least one word.\n${usage}`);
  return q.trim();
}

// --help / -h anywhere: print the usage to stdout and exit 0 (every CLI).
export const wantsHelp = (argv) => argv.includes('--help') || argv.includes('-h');
