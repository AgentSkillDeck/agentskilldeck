import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { lintPlugin, discoverPluginDirs } from '../lint-skills.mjs';

async function plugin(skillMd, extra = {}) {
  const root = await mkdtemp(join(tmpdir(), 'lint-'));
  const p = join(root, 'plugins', 'ui');
  await mkdir(join(p, 'skills', 'deck-x', 'reference'), { recursive: true });
  await writeFile(join(p, 'skills', 'deck-x', 'SKILL.md'), skillMd);
  for (const [rel, body] of Object.entries(extra)) await writeFile(join(p, rel), body);
  return { p, root };
}
const good = '---\nname: deck-x\ndescription: Builds product-specific interfaces from the brief.\n---\n\nSee [craft](reference/craft.md).\n';

test('clean skill passes', async () => {
  const { p, root } = await plugin(good, { 'skills/deck-x/reference/craft.md': '# Craft' });
  assert.deepEqual(await lintPlugin(p, { repoRoot: root }), []);
});

test('name mismatch, broken link, forbidden word are reported', async () => {
  const bad = '---\nname: other\ndescription: Builds product-specific interfaces from the brief.\n---\nUse uizze. [x](reference/missing.md)\n';
  const { p, root } = await plugin(bad);
  const problems = (await lintPlugin(p, { repoRoot: root })).join('\n');
  assert.match(problems, /name "other" must equal "deck-x"/);
  assert.match(problems, /broken link reference\/missing\.md/);
  assert.match(problems, /forbidden "uizze"/i);
});

test('provenance comment line is allowed', async () => {
  const { p, root } = await plugin(good, { 'skills/deck-x/reference/craft.md': '<!-- Adapted from Impeccable reference/craft.md (npx impeccable) -->\n# Craft' });
  assert.deepEqual(await lintPlugin(p, { repoRoot: root }), []);
});

test('a provenance line may not name uizze', async () => {
  const { p, root } = await plugin(good, { 'skills/deck-x/reference/craft.md': '<!-- Adapted from uizze ui-design craft.md -->\n# Craft' });
  assert.match((await lintPlugin(p, { repoRoot: root })).join('\n'), /forbidden "uizze"/i);
});

test('overlong SKILL.md is reported', async () => {
  const { p, root } = await plugin(good + 'line\n'.repeat(130), { 'skills/deck-x/reference/craft.md': '# C' });
  assert.match((await lintPlugin(p, { repoRoot: root })).join('\n'), /exceeds 120 lines/);
});

test('a plugin with zero skills lints clean', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lint-empty-'));
  const p = join(root, 'plugins', 'audio');
  await mkdir(join(p, 'library'), { recursive: true });
  await writeFile(join(p, 'sync.json'), JSON.stringify({ skills: {} }));
  assert.deepEqual(await lintPlugin(p), []);
});

test('discoverPluginDirs finds every plugin with a sync.json', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lint-multi-'));
  await mkdir(join(root, 'plugins', 'p1'), { recursive: true });
  await mkdir(join(root, 'plugins', 'p2'), { recursive: true });
  await mkdir(join(root, 'plugins', 'p3'), { recursive: true }); // no sync.json: must be skipped
  await writeFile(join(root, 'plugins', 'p1', 'sync.json'), '{"skills":{}}');
  await writeFile(join(root, 'plugins', 'p2', 'sync.json'), '{"skills":{}}');
  const dirs = (await discoverPluginDirs(root)).map((d) => relative(root, d).split('\\').join('/'));
  assert.deepEqual(dirs.sort(), ['plugins/p1', 'plugins/p2']);
});
