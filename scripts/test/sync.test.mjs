import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apply, check } from '../sync-library.mjs';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'sync-'));
  const plugin = join(root, 'plugins', 'ui');
  await writeFile(join(root, 'LICENSE'), 'L');
  await writeFile(join(root, 'NOTICE'), 'N');
  await mkdir(join(plugin, 'library'), { recursive: true });
  await mkdir(join(plugin, 'tools', 'lib'), { recursive: true });
  await mkdir(join(plugin, 'tools', 'test'), { recursive: true });
  await mkdir(join(plugin, 'skills', 's1'), { recursive: true });
  await writeFile(join(plugin, 'library', 'a.md'), '# A');
  await writeFile(join(plugin, 'library', 'b.md'), '# B');
  await writeFile(join(plugin, 'tools', 'm.mjs'), 'x');
  await writeFile(join(plugin, 'tools', 'lib', 'h.mjs'), 'y');
  await writeFile(join(plugin, 'tools', 'test', 't.mjs'), 'z');
  await writeFile(join(plugin, 'skills', 's1', 'SKILL.md'), 'skill');
  await writeFile(join(plugin, 'sync.json'), JSON.stringify({ skills: { s1: { guides: ['a'], tools: true } } }));
  return plugin;
}

test('apply copies guides, tools (minus tests), license, notice, checksums', async () => {
  const p = await fixture();
  await apply(p);
  const s = join(p, 'skills', 's1');
  assert.equal(await readFile(join(s, 'reference', 'a.md'), 'utf8'), '# A');
  assert.equal(await readFile(join(s, 'scripts', 'lib', 'h.mjs'), 'utf8'), 'y');
  assert.deepEqual((await readdir(join(s, 'scripts'))).sort(), ['lib', 'm.mjs']);
  assert.equal(await readFile(join(s, 'LICENSE'), 'utf8'), 'L');
  assert.match(await readFile(join(s, 'CHECKSUMS.sha256'), 'utf8'), /[0-9a-f]{64}  reference\/a\.md/);
  assert.deepEqual(await check(p), []);
});

test('check reports drift when a skill copy is edited directly', async () => {
  const p = await fixture();
  await apply(p);
  await writeFile(join(p, 'skills', 's1', 'reference', 'a.md'), '# edited');
  const problems = await check(p);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /differs skills\/s1\/reference\/a\.md/);
});

test('apply removes stale managed files but keeps SKILL.md', async () => {
  const p = await fixture();
  await apply(p);
  await writeFile(join(p, 'skills', 's1', 'reference', 'old.md'), 'stale');
  assert.match((await check(p)).join('\n'), /unexpected skills\/s1\/reference\/old\.md/);
  await apply(p);
  assert.deepEqual(await check(p), []);
  assert.equal(await readFile(join(p, 'skills', 's1', 'SKILL.md'), 'utf8'), 'skill');
});

test('unknown guide name fails loudly', async () => {
  const p = await fixture();
  await writeFile(join(p, 'sync.json'), JSON.stringify({ skills: { s1: { guides: ['nope'], tools: false } } }));
  await assert.rejects(apply(p), /nope/);
});
