import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseVtt, speakerAt, stripHtml, filterGraph, vttTime } from '../render-preview.mjs';

const VTT = `WEBVTT

1
00:00:00.600 --> 00:00:03.100
<v NARRATOR>For forty years, the lamp
never missed a night.

2
00:01:02.250 --> 00:01:04.000
Stay behind me.
`;

test('parseVtt reads times, <v> speakers and multi-line text', () => {
  const cues = parseVtt(VTT);
  assert.equal(cues.length, 2);
  assert.deepEqual(cues[0], { start: 0.6, end: 3.1, speaker: 'NARRATOR', text: 'For forty years, the lamp\nnever missed a night.' });
  assert.equal(cues[1].start, 62.25);
  assert.equal(cues[1].speaker, null);
  assert.equal(vttTime('01:00:00.5'), 3600.5);
});

test('speakerAt falls back to the timeline line the caption overlaps most', () => {
  const lines = [{ kind: 'speech', speaker: 'ELI', start: 0, end: 2 }, { kind: 'nv', speaker: 'MAYA', start: 2, end: 9 }, { kind: 'speech', speaker: 'MAYA', start: 2.5, end: 5 }];
  assert.equal(speakerAt({ start: 2.4, end: 4.8, speaker: null }, lines), 'MAYA');
  assert.equal(speakerAt({ start: 0, end: 1, speaker: 'GUIDE' }, lines), 'GUIDE');
});

test('stripHtml escapes text and lets captions wrap; filterGraph places one overlay per cue and scene', () => {
  const html = stripHtml([{ speaker: 'A_B', text: 'x < y\nz' }], [{ name: 'Step one' }], { A_B: '#fff' });
  assert.match(html, /x &lt; y z/);
  assert.match(html, />A B</);
  const { graph, out } = filterGraph({ cues: [{ start: 0, end: 1 }, { start: 1, end: 2 }], scenes: [{ name: 's', start: 0 }], duration: 3 });
  assert.equal((graph.match(/overlay=0:/g) ?? []).length, 3);
  assert.match(graph, /split=3/);
  assert.match(graph, /between\(t,1,2\)/);
  assert.equal(out, 'o2');
});

test('the CLI exits 1 on usage errors, also through a symlink', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aa preview '));
  try {
    const link = join(dir, 'render-preview.mjs');
    symlinkSync(fileURLToPath(new URL('../render-preview.mjs', import.meta.url)), link);
    for (const p of [fileURLToPath(new URL('../render-preview.mjs', import.meta.url)), link]) {
      const r = spawnSync(process.execPath, [p], { encoding: 'utf8' });
      assert.equal(r.status, 1, r.stderr);
      assert.match(r.stderr, /Usage/);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
