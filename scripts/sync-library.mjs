#!/usr/bin/env node
import { readFile, writeFile, readdir, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const MANAGED = ['reference', 'scripts'];

async function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

export async function buildExpected(pluginDir) {
  const repoRoot = resolve(pluginDir, '..', '..');
  const cfg = JSON.parse(await readFile(join(pluginDir, 'sync.json'), 'utf8'));
  const license = await readFile(join(repoRoot, 'LICENSE'));
  const notice = await readFile(join(repoRoot, 'NOTICE'));
  const toolsDir = join(pluginDir, 'tools');
  const toolFiles = (await walk(toolsDir)).filter((f) => !relative(toolsDir, f).startsWith('test'));
  const expected = new Map();
  for (const [skill, { guides = [], tools = false }] of Object.entries(cfg.skills)) {
    const base = `skills/${skill}`;
    const files = new Map();
    for (const g of guides) {
      const src = join(pluginDir, 'library', `${g}.md`);
      if (!existsSync(src)) throw new Error(`sync.json: skill "${skill}" lists unknown guide "${g}"`);
      files.set(`reference/${g}.md`, await readFile(src));
    }
    if (tools) for (const f of toolFiles) files.set(`scripts/${relative(toolsDir, f).split('\\').join('/')}`, await readFile(f));
    files.set('LICENSE', license);
    files.set('NOTICE', notice);
    const sums = [...files].sort(([a], [b]) => a.localeCompare(b))
      .map(([p, buf]) => `${createHash('sha256').update(buf).digest('hex')}  ${p}`).join('\n') + '\n';
    files.set('CHECKSUMS.sha256', Buffer.from(sums));
    for (const [p, buf] of files) expected.set(`${base}/${p}`, buf);
  }
  return { expected, skills: Object.keys(cfg.skills) };
}

async function actualManaged(pluginDir, skills) {
  const found = [];
  for (const s of skills) for (const m of MANAGED) {
    for (const f of await walk(join(pluginDir, 'skills', s, m))) found.push(relative(pluginDir, f).split('\\').join('/'));
  }
  return found;
}

export async function check(pluginDir) {
  const { expected, skills } = await buildExpected(pluginDir);
  const problems = [];
  for (const [p, buf] of expected) {
    const abs = join(pluginDir, p);
    if (!existsSync(abs)) problems.push(`missing ${p}`);
    else if (!(await readFile(abs)).equals(buf)) problems.push(`differs ${p}`);
  }
  for (const p of await actualManaged(pluginDir, skills)) if (!expected.has(p)) problems.push(`unexpected ${p}`);
  // CHECKSUMS differ whenever a file differs; report only the root cause.
  return problems.filter((x) => !(x.endsWith('CHECKSUMS.sha256') && problems.length > 1));
}

export async function apply(pluginDir) {
  const { expected, skills } = await buildExpected(pluginDir);
  const written = [], removed = [];
  for (const p of await actualManaged(pluginDir, skills)) {
    if (!expected.has(p)) { await rm(join(pluginDir, p)); removed.push(p); }
  }
  for (const [p, buf] of expected) {
    const abs = join(pluginDir, p);
    if (existsSync(abs) && (await readFile(abs)).equals(buf)) continue;
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, buf);
    written.push(p);
  }
  return { written, removed };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const pluginDir = resolve(args.find((a) => !a.startsWith('--')) ?? 'plugins/ui');
  if (args.includes('--check')) {
    const problems = await check(pluginDir);
    if (problems.length) { console.error(`Skill copies are out of sync (run npm run sync):\n  ${problems.join('\n  ')}`); process.exitCode = 1; }
    else console.log('Skills in sync.');
  } else {
    const { written, removed } = await apply(pluginDir);
    console.log(`Synced: ${written.length} written, ${removed.length} removed.`);
  }
}
