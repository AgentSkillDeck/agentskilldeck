#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
import { join, dirname, resolve, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const FORBIDDEN = [/uizze/i, /npx impeccable/i, /impeccable context/i, /\{\{scripts_path\}\}/];
const EXEMPT_FILES = new Set(['LICENSE', 'NOTICE', 'CHECKSUMS.sha256']);

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'test') out.push(...(await walk(p))); }
    else out.push(p);
  }
  return out;
}

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-z-]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return fm;
}

export async function lintPlugin(pluginDir) {
  const problems = [];
  const skillsDir = join(pluginDir, 'skills');
  for (const e of existsSync(skillsDir) ? await readdir(skillsDir, { withFileTypes: true }) : []) {
    if (!e.isDirectory()) continue;
    const file = join(skillsDir, e.name, 'SKILL.md');
    const rel = `skills/${e.name}/SKILL.md`;
    if (!existsSync(file)) { problems.push(`${rel}: missing`); continue; }
    const text = await readFile(file, 'utf8');
    const fm = frontmatter(text);
    if (!fm) problems.push(`${rel}: missing frontmatter`);
    else {
      if (fm.name !== e.name) problems.push(`${rel}: name "${fm.name}" must equal "${e.name}"`);
      const len = (fm.description ?? '').length;
      if (len < 20 || len > 1024) problems.push(`${rel}: description length ${len} (20–1024)`);
    }
    if (text.split('\n').length > 120) problems.push(`${rel}: exceeds 120 lines`);
  }
  for (const f of await walk(pluginDir)) {
    const rel = relative(pluginDir, f).split('\\').join('/');
    if (EXEMPT_FILES.has(basename(f))) continue;
    if (!/\.(md|mjs|js|json)$/.test(f)) continue;
    const text = await readFile(f, 'utf8');
    text.split('\n').forEach((line, i) => {
      if (line.trimStart().startsWith('<!-- Adapted from')) return;
      for (const re of FORBIDDEN) if (re.test(line)) problems.push(`${rel}:${i + 1}: forbidden "${re.source.replace(/\\/g, '')}"`);
    });
    if (f.endsWith('.md') && rel.startsWith('skills/')) {
      for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
        if (/^(https?:|mailto:|#)/.test(target)) continue;
        const path = target.split('#')[0];
        if (!existsSync(resolve(dirname(f), path))) problems.push(`${rel}: broken link ${path}`);
      }
    }
  }
  return problems;
}

// Compare real paths so the script also runs when invoked through a symlink.
const isMain = (() => { try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; } })();

if (isMain) {
  const pluginDir = resolve(process.argv[2] ?? 'plugins/ui');
  const problems = await lintPlugin(pluginDir);
  if (problems.length) { console.error(`Lint failed:\n  ${problems.join('\n  ')}`); process.exitCode = 1; }
  else console.log('Lint clean.');
}
