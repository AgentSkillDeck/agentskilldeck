import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export class ServiceError extends Error {
  constructor(source, message) {
    super(`${source}: ${message}`);
    this.name = 'ServiceError';
    this.source = source;
  }
}

const DEFAULT_CACHE = join(tmpdir(), 'agentatelier-cache');

async function readCache(file, ttl) {
  try {
    const info = await stat(file);
    if (Date.now() - info.mtimeMs > ttl) return undefined;
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return undefined; // missing, unreadable or corrupt: refetch
  }
}

async function fetchWithCache(url, {
  source, fetchImpl = globalThis.fetch, timeoutMs = 8000, retries = 1,
  cacheTtlMs = 0, cacheDir = DEFAULT_CACHE, accept, parse, invalidMessage,
}) {
  const cacheFile = cacheTtlMs > 0
    ? join(cacheDir, createHash('sha256').update(url).digest('hex').slice(0, 32) + '.json')
    : undefined;
  if (cacheFile) {
    const hit = await readCache(cacheFile, cacheTtlMs);
    if (hit !== undefined) return hit;
  }
  let lastError = 'request failed';
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res;
    try {
      res = await fetchImpl(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'user-agent': 'agentatelier', accept },
      });
    } catch (e) {
      lastError = e?.name === 'TimeoutError' ? `timed out after ${timeoutMs} ms` : (e?.message ?? String(e));
      continue;
    }
    if (res.status === 429 || res.status >= 500) { lastError = `HTTP ${res.status}`; continue; }
    if (!res.ok) throw new ServiceError(source, `HTTP ${res.status}`);
    let data;
    try { data = await parse(res); } catch { throw new ServiceError(source, invalidMessage); }
    if (cacheFile) {
      try { await mkdir(cacheDir, { recursive: true }); await writeFile(cacheFile, JSON.stringify(data)); } catch { /* cache is best-effort */ }
    }
    return data;
  }
  throw new ServiceError(source, lastError);
}

export async function fetchJson(url, opts = {}) {
  return fetchWithCache(url, { ...opts, accept: 'application/json', parse: (res) => res.json(), invalidMessage: 'invalid JSON response' });
}

export async function fetchText(url, opts = {}) {
  return fetchWithCache(url, { ...opts, accept: 'text/plain', parse: (res) => res.text(), invalidMessage: 'invalid text response' });
}
