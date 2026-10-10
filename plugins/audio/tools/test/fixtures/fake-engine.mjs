#!/usr/bin/env node
// Fake engine/synth.py for produce/audition tests: same protocol, real audio.
// synth: writes a 44.1 kHz mono 16-bit WAV (a tone ~0.28 s per word) at
//        <out_dir>/<id>.t<seed>.wav, with {text, seed} in a private "fake" RIFF chunk.
// asr:   reads that chunk and "hears" the text back with even word times.
// Env switches: FAKE_ENGINE_TAG_TAKE0=1 → take 0 is heard with a spoken
// "breath" (forces a retake); FAKE_ENGINE_SPEAK_COUGH=1 → every take of a text
// with an inline <cough> is heard as "Cough."; FAKE_ENGINE_LOG=<file> → one line per job.
// A file without the chunk (a cleaned "recording") is heard as FAKE_ENGINE_ASR_JSON
// ({text, words} file: a whole take with word times) or FAKE_ENGINE_ASR_TEXT.
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SR = 44100;

function wav(seconds, freq, info) {
  const n = Math.round(seconds * SR);
  let note = Buffer.from(JSON.stringify(info));
  if (note.length % 2) note = Buffer.concat([note, Buffer.from(' ')]);
  const head = 12 + 24 + 8 + note.length;
  const buf = Buffer.alloc(head + 8 + n * 2);
  buf.write('RIFF', 0, 'ascii'); buf.writeUInt32LE(buf.length - 8, 4); buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii'); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('fake', 36, 'ascii'); buf.writeUInt32LE(note.length, 40); note.copy(buf, 44);
  buf.write('data', head, 'ascii'); buf.writeUInt32LE(n * 2, head + 4);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.02, (seconds - t) / 0.02) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 3 * t) ** 2);
    buf.writeInt16LE(Math.round(9000 * env * Math.sin(2 * Math.PI * freq * t)), head + 8 + i * 2);
  }
  return buf;
}

function readNote(path) {
  const b = readFileSync(path);
  for (let pos = 12; pos + 8 <= b.length;) {
    const id = b.toString('ascii', pos, pos + 4);
    const len = b.readUInt32LE(pos + 4);
    if (id === 'fake') return JSON.parse(b.toString('utf8', pos + 8, pos + 8 + len));
    pos += 8 + len + (len % 2);
  }
  return { text: '', seed: 0, none: true };
}

const words = (text) => String(text).replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean);

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  const job = JSON.parse(input);
  const items = job.items ?? [];
  if (process.env.FAKE_ENGINE_LOG) appendFileSync(process.env.FAKE_ENGINE_LOG, `${job.mode} ${items.length}\n`);
  items.forEach((it, i) => {
    let result;
    if (job.mode === 'synth') {
      mkdirSync(job.out_dir, { recursive: true });
      const seed = it.seed ?? 0;
      const path = join(job.out_dir, `${it.id}.t${seed}.wav`);
      const secs = Math.round((0.25 + 0.28 * Math.max(1, words(it.text).length) / (it.speed || 1)) * SR) / SR;
      const voiceFreq = { F: 210, M: 120 }[String(it.voice)[0]] ?? 160;
      writeFileSync(path, wav(secs, voiceFreq + seed * 7, { text: it.text, seed }));
      result = { id: it.id, path, duration_s: secs };
    } else if (job.mode === 'asr') {
      const side = readNote(it.path);
      if (side.none && process.env.FAKE_ENGINE_ASR_JSON) {
        process.stdout.write(JSON.stringify({ id: it.id, ...JSON.parse(readFileSync(process.env.FAKE_ENGINE_ASR_JSON, 'utf8')) }) + '\n');
        process.stderr.write(JSON.stringify({ progress: i + 1, total: items.length }) + '\n');
        return;
      }
      if (side.none && process.env.FAKE_ENGINE_ASR_TEXT !== undefined) side.text = process.env.FAKE_ENGINE_ASR_TEXT;
      const heard = words(side.text);
      if (process.env.FAKE_ENGINE_TAG_TAKE0 === '1' && side.seed === 0) heard.unshift('Breath,');
      if (process.env.FAKE_ENGINE_SPEAK_COUGH === '1' && String(side.text).includes('<cough>')) heard.unshift('Cough.');
      const step = 0.28;
      result = { id: it.id, text: heard.join(' '), words: heard.map((w, k) => ({ w, start: 0.1 + k * step, end: 0.1 + (k + 1) * step - 0.02, p: 0.9 })) };
    } else {
      result = { id: it.id, voice: it.id };
    }
    process.stdout.write(JSON.stringify(result) + '\n');
    process.stderr.write(JSON.stringify({ progress: i + 1, total: items.length }) + '\n');
  });
});
