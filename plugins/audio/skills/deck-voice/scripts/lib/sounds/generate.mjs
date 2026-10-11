import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname } from 'node:path';
import { ServiceError } from '../http.mjs';
import { attribution } from './license.mjs';
import { ffmpegPath as findFfmpeg } from '../ffmpeg.mjs';

export const BED_KINDS = ['room-tone', 'rain', 'wind', 'brown', 'pink', 'tone'];
const RATE = 48000;

// Source + shaping filters per bed. Fixed noise seeds keep renders reproducible.
const RECIPES = {
  'room-tone': `anoisesrc=c=brown:a=0.03:r=${RATE}:s=7,highpass=f=30,lowpass=f=320`,
  brown: `anoisesrc=c=brown:a=0.25:r=${RATE}:s=7`,
  pink: `anoisesrc=c=pink:a=0.2:r=${RATE}:s=7`,
  rain: `anoisesrc=c=pink:a=0.35:r=${RATE}:s=7,highpass=f=600,lowpass=f=10000,tremolo=f=11:d=0.15`,
  wind: `anoisesrc=c=brown:a=0.45:r=${RATE}:s=7,lowpass=f=500,highpass=f=40,tremolo=f=0.13:d=0.6`,
  tone: `aevalsrc=0.12*sin(2*PI*110*t)+0.06*sin(2*PI*165*t)+0.03*sin(2*PI*220*t):s=${RATE}`,
};

// Same discovery as the mixer (AGENTSKILLDECK_FFMPEG, PATH, then the usual install dirs).
export const ffmpegPath = () => findFfmpeg();

export function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    let child;
    const bin = ffmpegPath();
    if (!bin) { reject(new ServiceError('ffmpeg', 'ffmpeg not found; install it (brew install ffmpeg / apt install ffmpeg)')); return; }
    try { child = spawn(bin, ['-hide_banner', '-nostdin', '-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] }); } catch (e) { reject(new ServiceError('ffmpeg', e.message)); return; }
    child.stderr.on('data', (d) => { stderr += d; if (stderr.length > 20000) stderr = stderr.slice(-10000); });
    child.on('error', (e) => reject(new ServiceError('ffmpeg', e.code === 'ENOENT' ? 'ffmpeg not found; run setup.mjs --install' : e.message)));
    child.on('close', (code) => (code === 0 ? resolve({ stderr }) : reject(new ServiceError('ffmpeg', `exit ${code}: ${stderr.trim().split('\n').slice(-3).join(' | ')}`))));
  });
}

const codecArgs = (out) => (extname(out).toLowerCase() === '.mp3'
  ? ['-c:a', 'libmp3lame', '-b:a', '128k']
  : ['-c:a', 'pcm_s16le']);

export function generatedSidecar(title) {
  const s = { title, creator: 'agentskilldeck (ffmpeg generator)', license: 'generated', license_url: '', source_url: '' };
  return { ...s, attribution: attribution(s) };
}

// Write a mono 48 kHz bed of `seconds` length with short fades, plus `<out>.license.json`.
export async function generateBed(kind, seconds, out) {
  if (!BED_KINDS.includes(kind)) throw new Error(`generateBed: unknown kind "${kind}" (use ${BED_KINDS.join(', ')})`);
  const secs = Number(seconds);
  if (!(secs > 0)) throw new Error('generateBed: seconds must be > 0');
  const fade = Math.min(1, secs / 4);
  const af = `afade=t=in:d=${fade},afade=t=out:st=${(secs - fade).toFixed(3)}:d=${fade}`;
  await mkdir(dirname(out), { recursive: true });
  await runFfmpeg(['-f', 'lavfi', '-i', RECIPES[kind], '-t', String(secs), '-af', af, '-ac', '1', '-ar', String(RATE), ...codecArgs(out), out]);
  const sidecar = generatedSidecar(`Generated ${kind}`);
  await writeFile(`${out}.license.json`, JSON.stringify(sidecar, null, 2) + '\n');
  return { path: out, sidecar };
}

// Synthetic breath/sigh (band-limited noise with a breath-shaped envelope). Used only as the
// documented fallback in the bundled nonverbal pack when no CC0 recording is available.
export async function generateBreath(tag, out, { gender = 'female', seed = 1 } = {}) {
  const lowpass = gender === 'male' ? 1800 : 2600;
  const shape = tag === 'sigh'
    ? { d: 1.3, fin: 0.18, st: 0.3, fout: 1.0, hp: 180, lp: lowpass * 0.75 }
    : { d: 0.8, fin: 0.32, st: 0.36, fout: 0.44, hp: 350, lp: lowpass };
  const src = `anoisesrc=c=pink:a=0.5:r=${RATE}:s=${seed}`;
  const af = [`highpass=f=${shape.hp}`, `lowpass=f=${Math.round(shape.lp)}`,
    `afade=t=in:d=${shape.fin}:curve=qsin`, `afade=t=out:st=${shape.st}:d=${shape.fout}:curve=exp`,
    'loudnorm=I=-24:TP=-3:LRA=7'].join(',');
  await mkdir(dirname(out), { recursive: true });
  await runFfmpeg(['-f', 'lavfi', '-i', src, '-t', String(shape.d), '-af', af, '-ac', '1', '-ar', '44100', ...codecArgs(out), out]);
  return { path: out };
}
