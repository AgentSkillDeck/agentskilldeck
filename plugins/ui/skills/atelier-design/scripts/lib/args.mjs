import { parseArgs } from 'node:util';
import { tokenize } from './rank.mjs';

export class UsageError extends Error {}

export function parseCli(argv, { usage, options = {} }) {
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
    limit = Math.min(5, Math.max(1, Number(values.limit)));
  }
  return { values: { ...values, limit }, positionals };
}

export function requireQuery(q, usage) {
  if (!q || tokenize(q).length === 0) throw new UsageError(`Query must contain at least one word.\n${usage}`);
  return q.trim();
}
