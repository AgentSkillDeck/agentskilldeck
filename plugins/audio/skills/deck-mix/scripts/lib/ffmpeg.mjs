// Thin ffmpeg/ffprobe wrapper: binary discovery, a bounded spawn helper, and a
// cheap WAV header reader (so hundreds of clips never need one ffprobe each).
import { spawn } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { open, stat } from 'node:fs/promises';
import { delimiter, join } from 'node:path';

export const SR = 44100;

// Named ServiceError so CLIs that map `err.name === 'ServiceError'` to exit 2
// treat a missing or failing ffmpeg as a setup/service problem.
export class FfmpegError extends Error {
  constructor(message, { missing = false, stderr = '' } = {}) {
    super(`ffmpeg: ${message}`);
    this.name = 'ServiceError';
    this.source = 'ffmpeg';
    this.missing = missing;
    this.stderr = stderr;
  }
}

const EXTRA_DIRS = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin'];

function findBinary(name, envVar) {
  const override = process.env[envVar];
  if (override) return override;
  const dirs = [...(process.env.PATH || '').split(delimiter).filter(Boolean), ...EXTRA_DIRS];
  for (const dir of dirs) {
    const candidate = join(dir, name);
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {}
  }
  return null;
}

export function ffmpegPath() {
  return findBinary('ffmpeg', 'AGENTSKILLDECK_FFMPEG');
}

export function ffprobePath() {
  return findBinary('ffprobe', 'AGENTSKILLDECK_FFPROBE');
}

// Observers for every ffmpeg invocation (tests use this to bound input counts).
const listeners = new Set();
export function onRun(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function countInputs(args) {
  return args.filter((a) => a === '-i').length;
}

function spawnCollect(bin, args, { signal } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], signal });
    const out = [];
    const err = [];
    child.stdout.on('data', (d) => out.push(d));
    child.stderr.on('data', (d) => err.push(d));
    child.on('error', (e) => {
      if (e.code === 'ENOENT') reject(new FfmpegError(`${bin} not found; install ffmpeg`, { missing: true }));
      else if (e.name === 'AbortError') reject(e);
      else reject(new FfmpegError(e.message));
    });
    child.on('close', (code) => {
      const stdout = Buffer.concat(out).toString('utf8');
      const stderr = Buffer.concat(err).toString('utf8');
      if (code === 0) resolve({ stdout, stderr });
      else {
        const tail = stderr.trim().split('\n').slice(-6).join('\n');
        reject(new FfmpegError(`exited with code ${code}\n${tail}`, { stderr }));
      }
    });
  });
}

export async function run(args, { signal } = {}) {
  const bin = ffmpegPath();
  if (!bin) throw new FfmpegError('ffmpeg not found on PATH; install ffmpeg (brew install ffmpeg / apt-get install ffmpeg)', { missing: true });
  const full = ['-hide_banner', '-nostdin', '-nostats', '-y', ...args];
  for (const fn of listeners) fn(full);
  return spawnCollect(bin, full, { signal });
}

let ffmpegChecked;
export async function hasFfmpeg() {
  if (ffmpegChecked === undefined) {
    const bin = ffmpegPath();
    if (!bin) ffmpegChecked = false;
    else {
      try {
        await spawnCollect(bin, ['-hide_banner', '-version']);
        ffmpegChecked = true;
      } catch {
        ffmpegChecked = false;
      }
    }
  }
  return ffmpegChecked;
}

export async function probeDuration(path, { signal } = {}) {
  const wav = await readWavInfo(path);
  if (wav) return wav.samples / wav.sampleRate;
  const probe = ffprobePath();
  if (probe) {
    const { stdout } = await spawnCollect(probe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', path], { signal });
    const d = Number.parseFloat(stdout.trim());
    if (Number.isFinite(d)) return d;
  }
  // No ffprobe: decode once and read the final timestamp.
  const { stderr } = await run(['-i', path, '-f', 'null', '-'], { signal });
  const times = [...stderr.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)];
  if (!times.length) throw new FfmpegError(`cannot determine duration of ${path}`);
  const [, h, m, s] = times[times.length - 1];
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

// Reads a RIFF/WAVE header. Returns {format, channels, sampleRate, bits,
// blockAlign, samples, dataOffset} or null if the file is not a plain PCM WAV.
export async function readWavInfo(path) {
  let fh;
  try {
    fh = await open(path, 'r');
    const { size: fileSize } = await stat(path);
    const head = Buffer.alloc(12);
    await fh.read(head, 0, 12, 0);
    if (head.toString('ascii', 0, 4) !== 'RIFF' || head.toString('ascii', 8, 12) !== 'WAVE') return null;
    let pos = 12;
    let fmt = null;
    const chunk = Buffer.alloc(8);
    while (pos + 8 <= fileSize) {
      await fh.read(chunk, 0, 8, pos);
      const id = chunk.toString('ascii', 0, 4);
      const len = chunk.readUInt32LE(4);
      if (id === 'fmt ') {
        const b = Buffer.alloc(Math.min(len, 40));
        await fh.read(b, 0, b.length, pos + 8);
        fmt = {
          format: b.readUInt16LE(0),
          channels: b.readUInt16LE(2),
          sampleRate: b.readUInt32LE(4),
          blockAlign: b.readUInt16LE(12),
          bits: b.readUInt16LE(14),
        };
      } else if (id === 'data') {
        if (!fmt || !fmt.blockAlign) return null;
        const dataOffset = pos + 8;
        const avail = fileSize - dataOffset;
        const bytes = len === 0 || len === 0xffffffff || len > avail ? avail : len;
        return { ...fmt, samples: Math.floor(bytes / fmt.blockAlign), dataOffset };
      }
      pos += 8 + len + (len % 2);
    }
    return null;
  } catch {
    return null;
  } finally {
    await fh?.close();
  }
}

export function isPcm16Mono(info, sampleRate = SR) {
  return Boolean(info && (info.format === 1 || info.format === 0xfffe) && info.bits === 16 && info.channels === 1 && info.sampleRate === sampleRate);
}
