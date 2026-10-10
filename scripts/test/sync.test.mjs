import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { apply, check, discoverPluginDirs } from '../sync-library.mjs';

async function walkAll(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walkAll(p)));
    else out.push(p);
  }
  return out;
}

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

test('apply excludes __pycache__, .pyc files and .DS_Store from tool copies', async () => {
  const p = await fixture();
  await mkdir(join(p, 'tools', '__pycache__'), { recursive: true });
  await writeFile(join(p, 'tools', '__pycache__', 'x.pyc'), 'bin');
  await writeFile(join(p, 'tools', 'y.pyc'), 'bin');
  await writeFile(join(p, 'tools', '.DS_Store'), 'ds');
  await apply(p);
  const files = (await walkAll(join(p, 'skills', 's1', 'scripts'))).map((f) => relative(p, f).split('\\').join('/'));
  assert.ok(!files.some((f) => f.includes('__pycache__')), files.join(','));
  assert.ok(!files.some((f) => f.endsWith('.pyc')), files.join(','));
  assert.ok(!files.some((f) => f.endsWith('.DS_Store')), files.join(','));
  assert.deepEqual(await check(p), []);
});

test('discoverPluginDirs finds every plugin with a sync.json', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sync-multi-'));
  await mkdir(join(root, 'plugins', 'p1'), { recursive: true });
  await mkdir(join(root, 'plugins', 'p2'), { recursive: true });
  await mkdir(join(root, 'plugins', 'p3'), { recursive: true }); // no sync.json: must be skipped
  await writeFile(join(root, 'plugins', 'p1', 'sync.json'), '{"skills":{}}');
  await writeFile(join(root, 'plugins', 'p2', 'sync.json'), '{"skills":{}}');
  const dirs = (await discoverPluginDirs(root)).map((d) => relative(root, d).split('\\').join('/'));
  assert.deepEqual(dirs.sort(), ['plugins/p1', 'plugins/p2']);
});

test('syncing two plugins syncs both, and --check reports drift in either', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sync-multi-'));
  await writeFile(join(root, 'LICENSE'), 'L');
  await writeFile(join(root, 'NOTICE'), 'N');
  async function makePlugin(name) {
    const plugin = join(root, 'plugins', name);
    await mkdir(join(plugin, 'library'), { recursive: true });
    await mkdir(join(plugin, 'skills', 's1'), { recursive: true });
    await writeFile(join(plugin, 'library', 'a.md'), `# ${name}`);
    await writeFile(join(plugin, 'skills', 's1', 'SKILL.md'), 'skill');
    await writeFile(join(plugin, 'sync.json'), JSON.stringify({ skills: { s1: { guides: ['a'], tools: false } } }));
    return plugin;
  }
  const p1 = await makePlugin('p1');
  const p2 = await makePlugin('p2');
  const dirs = await discoverPluginDirs(root);
  assert.equal(dirs.length, 2);
  for (const dir of dirs) await apply(dir);
  assert.equal(await readFile(join(p1, 'skills', 's1', 'reference', 'a.md'), 'utf8'), '# p1');
  assert.equal(await readFile(join(p2, 'skills', 's1', 'reference', 'a.md'), 'utf8'), '# p2');
  assert.deepEqual(await check(p1), []);
  assert.deepEqual(await check(p2), []);
  await writeFile(join(p2, 'skills', 's1', 'reference', 'a.md'), '# edited');
  assert.deepEqual(await check(p1), []);
  assert.match((await check(p2)).join('\n'), /differs skills\/s1\/reference\/a\.md/);
});
