import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Run the CLIs as real child processes, both from their real path and through a
// symlinked directory (how plugin caches and skill installs may expose them).
const toolsDir = fileURLToPath(new URL('..', import.meta.url));
const linkRoot = mkdtempSync(join(tmpdir(), 'aa-link-'));
const linkedTools = join(linkRoot, 'tools');
symlinkSync(toolsDir, linkedTools, 'dir');
after(() => rmSync(linkRoot, { recursive: true, force: true }));

const run = (dir, script, args) => spawnSync(process.execPath, [join(dir, script), ...args], { encoding: 'utf8', timeout: 20_000 });

for (const [label, dir] of [['real path', toolsDir], ['symlinked dir', linkedTools]]) {
  test(`materials.mjs runs as a CLI via ${label}`, () => {
    const r = run(dir, 'materials.mjs', ['font']);
    assert.equal(r.status, 1, r.stderr);
    assert.match(r.stderr, /Usage/);
  });

  test(`references.mjs runs as a CLI via ${label}`, () => {
    const r = run(dir, 'references.mjs', ['empty state']);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(r.stdout.trim().length > 0, 'expected non-empty stdout');
    assert.match(r.stdout, /https:\/\//);
  });
}
