#!/usr/bin/env node
// Stand-in for engine/synth.py that speaks the same protocol: one JSON job on
// stdin, one JSON result per line on stdout, {progress, total} lines on stderr.
// Behaviour switches live in job.fake so tests can exercise the bridge.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', async () => {
  const job = JSON.parse(input);
  const fake = job.fake ?? {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  if (fake.setup) {
    process.stderr.write('Traceback (most recent call last):\nModuleNotFoundError: No module named \'supertonic\'\n');
    process.exit(2);
  }
  if (fake.hang) {
    // A grandchild in the same process group; aborting must take it down too.
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
    writeFileSync(fake.pidfile, String(child.pid));
    setInterval(() => {}, 1000);
    return;
  }
  if (fake.noise) process.stdout.write('loading model... not json\n');

  const items = job.items ?? [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const result = job.mode === 'asr'
      ? { id: it.id, text: 'hello', words: [{ w: 'hello', start: 0, end: 0.4, p: 0.9 }] }
      : { id: it.id, path: join(job.out_dir ?? '.', `${it.id}.t${it.seed ?? 0}.wav`), duration_s: 1.25, steps: job.steps, text: it.text };
    const line = JSON.stringify(result) + '\n';
    if (fake.chunked) {
      // Split each line across writes to prove the bridge reassembles frames.
      const mid = Math.floor(line.length / 2);
      process.stdout.write(line.slice(0, mid));
      await sleep(15);
      process.stdout.write(line.slice(mid));
    } else {
      process.stdout.write(line);
    }
    process.stderr.write(JSON.stringify({ progress: i + 1, total: items.length }) + '\n');
    if (fake.crash && i === 0) {
      for (let k = 0; k < 40; k++) process.stderr.write(`noise line ${k}\n`);
      process.stderr.write('RuntimeError: onnx session failed\n');
      process.exit(7);
    }
  }
});
