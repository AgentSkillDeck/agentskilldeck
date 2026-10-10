import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lintPlugin } from '../lint-skills.mjs';

async function plugin(skillMd, extra = {}) {
  const root = await mkdtemp(join(tmpdir(), 'lint-'));
  const p = join(root, 'plugins', 'ui');
  await mkdir(join(p, 'skills', 'atelier-x', 'reference'), { recursive: true });
  await writeFile(join(p, 'skills', 'atelier-x', 'SKILL.md'), skillMd);
  for (const [rel, body] of Object.entries(extra)) await writeFile(join(p, rel), body);
  return { p, root };
}
const good = '---\nname: atelier-x\ndescription: Builds product-specific interfaces from the brief.\n---\n\nSee [craft](reference/craft.md).\n';

test('clean skill passes', async () => {
  const { p, root } = await plugin(good, { 'skills/atelier-x/reference/craft.md': '# Craft' });
  assert.deepEqual(await lintPlugin(p, { repoRoot: root }), []);
});

test('name mismatch, broken link, forbidden word are reported', async () => {
  const bad = '---\nname: other\ndescription: Builds product-specific interfaces from the brief.\n---\nUse uizze. [x](reference/missing.md)\n';
  const { p, root } = await plugin(bad);
  const problems = (await lintPlugin(p, { repoRoot: root })).join('\n');
  assert.match(problems, /name "other" must equal "atelier-x"/);
  assert.match(problems, /broken link reference\/missing\.md/);
  assert.match(problems, /forbidden "uizze"/i);
});

test('provenance comment line is allowed', async () => {
  const { p, root } = await plugin(good, { 'skills/atelier-x/reference/craft.md': '<!-- Adapted from uizze ui-design craft.md -->\n# Craft' });
  assert.deepEqual(await lintPlugin(p, { repoRoot: root }), []);
});

test('overlong SKILL.md is reported', async () => {
  const { p, root } = await plugin(good + 'line\n'.repeat(130), { 'skills/atelier-x/reference/craft.md': '# C' });
  assert.match((await lintPlugin(p, { repoRoot: root })).join('\n'), /exceeds 120 lines/);
});
