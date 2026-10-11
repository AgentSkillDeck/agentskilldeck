#!/usr/bin/env node
// build-openui-index.mjs: merge Open UI's design-system component data into the
// bundled references index (plugins/ui/tools/patterns.json).
//
//   node scripts/build-openui-index.mjs <dir of open-ui site/src/sources/*.json> --sha <open-ui commit>
//
// Open UI (https://github.com/openui/open-ui) is licensed under the W3C Software and
// Document License; the credit is in NOTICE. Only names and documentation links are
// taken. Systems the curated index already covers are skipped, every link is checked
// live, and a link that fails or redirects to a site's home page is dropped.
// Re-running replaces the previous Open UI entries.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const INDEX = new URL('../plugins/ui/tools/patterns.json', import.meta.url);
const VIA = 'Open UI';

// Covered by the hand-curated entries, or listed by Open UI without documentation links.
const SKIP = new Set(['Ant Design', 'Atlaskit', 'Carbon Design System', 'Lightning Design System', 'Material Components Web',
  'Primer Design System', 'Chromium', 'Firefox', 'WebKit']);
// Display names for the systems we keep.
const RENAME = { 'UI Fabric': 'Microsoft Fluent UI (Fabric)', 'U.S. Web Design System (USWDS)': 'USWDS', Spectrum: 'Adobe Spectrum',
  'Web Platform': 'HTML Standard', 'WAI-ARIA': 'WAI-ARIA Authoring Practices' };

// Extra search words per component, so "modal" finds dialogs and so on.
const SYNONYMS = {
  dialog: ['modal', 'popup', 'confirmation'], modal: ['dialog', 'popup'], toast: ['notification', 'snackbar', 'feedback'],
  snackbar: ['toast', 'notification'], alert: ['banner', 'notification', 'feedback'], notification: ['toast', 'alert'],
  tooltip: ['hint', 'popover'], popover: ['tooltip', 'overlay'], dropdown: ['menu', 'select'], menu: ['dropdown', 'navigation'],
  select: ['dropdown', 'picker', 'form'], combobox: ['autocomplete', 'typeahead', 'select', 'form'], checkbox: ['form', 'toggle'],
  radio: ['form', 'choice'], switch: ['toggle', 'form'], toggle: ['switch'], slider: ['range', 'form'], input: ['text field', 'form'],
  textarea: ['text field', 'form'], 'text field': ['input', 'form'], form: ['validation', 'input'], datepicker: ['date', 'calendar', 'form'],
  tabs: ['navigation', 'tablist'], breadcrumb: ['navigation', 'wayfinding'], pagination: ['navigation', 'paging'],
  accordion: ['disclosure', 'collapse', 'expand'], disclosure: ['accordion', 'expand'], table: ['data table', 'grid', 'list'],
  progress: ['loading', 'progress bar'], spinner: ['loading', 'progress'], skeleton: ['loading', 'placeholder'],
  badge: ['tag', 'status', 'label'], tag: ['badge', 'chip', 'label'], chip: ['tag', 'badge'], avatar: ['profile', 'user'],
  card: ['tile', 'container'], carousel: ['slider', 'gallery'], drawer: ['side panel', 'sheet'], sidebar: ['navigation', 'drawer'],
  stepper: ['wizard', 'steps', 'progress'], upload: ['file', 'form'], file: ['upload', 'form'], search: ['search field', 'input'],
  link: ['navigation', 'anchor'], button: ['action', 'cta'], icon: ['iconography', 'symbol'], tree: ['tree view', 'hierarchy'],
};

const words = (name) => name.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

export function tagsFor(name) {
  const base = words(name);
  const tags = new Set([base, ...(SYNONYMS[base] ?? [])]);
  for (const w of base.split(' ')) for (const s of SYNONYMS[w] ?? []) tags.add(s);
  tags.add('component');
  return [...tags].filter(Boolean);
}

export function candidates(sources) {
  const out = [];
  for (const s of sources) {
    if (SKIP.has(s.name)) continue;
    const system = RENAME[s.name] ?? s.name;
    for (const c of s.components ?? []) {
      if (!c.url || !c.name) continue;
      const url = c.url.replace(/^http:\/\//, 'https://');
      if (!/^https:\/\//.test(url)) continue;
      out.push({ system, title: c.name.trim(), url, platform: ['web'], tags: tagsFor(c.name), via: VIA });
    }
  }
  return out;
}

async function check(entry) {
  try {
    const res = await fetch(entry.url, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Mozilla/5.0 agentskilldeck-linkcheck' } });
    if (res.status >= 400) return null;
    const from = new URL(entry.url); const to = new URL(res.url || entry.url);
    if (to.pathname.replace(/\/$/, '') === '' && from.pathname.replace(/\/$/, '') !== '') return null; // bounced to the home page
    if (to.protocol !== 'https:') return null;
    return { ...entry, url: to.href };
  } catch {
    return null;
  }
}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { sha: { type: 'string' } } });
  const dir = positionals[0];
  if (!dir || !values.sha) { console.error('Usage: node scripts/build-openui-index.mjs <sources dir> --sha <open-ui commit>'); process.exitCode = 1; return; }
  const sources = [];
  for (const f of (await readdir(dir)).filter((f) => f.endsWith('.json')).sort()) sources.push(JSON.parse(await readFile(join(dir, f), 'utf8')));
  const index = JSON.parse(await readFile(INDEX, 'utf8'));
  const curated = index.entries.filter((e) => e.via !== VIA);
  const seen = new Set(curated.map((e) => e.url));
  const todo = candidates(sources);
  const kept = [];
  for (let i = 0; i < todo.length; i += 8) {
    for (const r of await Promise.all(todo.slice(i, i + 8).map(check))) {
      if (!r || seen.has(r.url)) continue;
      const key = `${r.system}|${r.title.toLowerCase()}`;
      if (kept.some((k) => `${k.system}|${k.title.toLowerCase()}` === key)) continue;
      seen.add(r.url); kept.push(r);
    }
  }
  index.entries = [...curated, ...kept];
  index.openui = { repository: 'https://github.com/openui/open-ui', commit: values.sha, license: 'W3C Software and Document License' };
  await writeFile(INDEX, JSON.stringify(index, null, 2) + '\n');
  const systems = new Set(kept.map((k) => k.system));
  console.log(`Open UI: ${todo.length} candidate links, ${kept.length} kept from ${systems.size} systems (${todo.length - kept.length} dead, duplicate or redirected home).`);
  console.log(`Index: ${index.entries.length} entries from ${new Set(index.entries.map((e) => e.system)).size} systems.`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
