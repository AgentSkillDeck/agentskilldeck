#!/usr/bin/env node
// Fake engine/clone.py for tests: same protocol (one JSON job per stdin line,
// results then {"_done": true}; serves jobs until stdin closes). "Converts" by
// copying the source WAV (so the fake ASR still reads its text chunk). Logs to
// FAKE_CLONE_LOG: "start" once per process, then "<mode> <n> <ref dir>" per job.
import { appendFileSync, copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { createInterface } from 'node:readline';

const log = (s) => { if (process.env.FAKE_CLONE_LOG) appendFileSync(process.env.FAKE_CLONE_LOG, `${s}\n`); };
log('start');
const out = (o) => process.stdout.write(JSON.stringify(o) + '\n');
const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (!line.trim()) return;
  const job = JSON.parse(line);
  const items = job.items ?? [];
  log(`${job.mode} ${items.length} ${items[0] ? basename(dirname(items[0].ref_path)) : ''}`.trim());
  if (job.mode === 'warm') out({ id: 'warm', device: 'cpu' });
  items.forEach((it, i) => {
    readFileSync(it.ref_path); // the reference must exist
    mkdirSync(dirname(it.out), { recursive: true });
    copyFileSync(it.src_path, it.out);
    const b = readFileSync(it.out);
    out({ id: it.id, path: it.out, duration_s: Math.round(((b.length - 44) / (44100 * 2)) * 10000) / 10000, sample_rate: 44100 });
    process.stderr.write(JSON.stringify({ progress: i + 1, total: items.length }) + '\n');
  });
  out({ _done: true });
});
