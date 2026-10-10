import { fetchJson } from './http.mjs';
import { tokenize, rank } from './rank.mjs';

const DAY = 24 * 60 * 60 * 1000;

export async function searchPacks(query, { limit, fetchImpl, cacheDir }) {
  const list = await fetchJson('https://ui.shadcn.com/r/registries.json', { fetchImpl, cacheDir, cacheTtlMs: DAY, source: 'shadcn registry directory' });
  const healthy = (Array.isArray(list) ? list : []).filter((r) => r?.name && r.health?.status !== 'unhealthy');
  const results = rank(healthy, tokenize(query), (r) => [
    { text: r.name.replace(/^@/, ''), weight: 3 },
    { text: r.description ?? '', weight: 1 },
  ], limit).map((r) => ({
    name: r.name,
    source: 'shadcn registry',
    previewUrl: r.homepage ?? r.url,
    license: { id: 'check registry', url: r.homepage ?? r.url },
    install: `npx shadcn@latest add ${r.name}/<item>   (pick <item> from the registry homepage)`,
    notes: `${r.description ?? ''}${r.health?.score ? ` · health ${Math.round(r.health.score)}/100` : ''}`.trim(),
  }));
  return { results, warnings: [] };
}
