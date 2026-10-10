#!/usr/bin/env node
// render-preview.mjs: a GitHub-friendly MP4 of a rendered audio piece.
// 1280x720, dark, waveform (ffmpeg showwaves) plus burned-in speaker captions
// and scene labels. Text is rasterised by headless Chrome (one screenshot of a
// strip of caption blocks), so it works with an ffmpeg built without libass or
// drawtext, and every script (Latin, Devanagari, CJK, Hangul) uses system fonts.
//
//   node scripts/render-preview.mjs <dir> [--out <dir>/preview.mp4] [--max-mb 3] [--chrome <path>] [--ffmpeg <path>]
//
// <dir> holds timeline.json, captions.vtt and mix.wav (or mix.mp3).
// Exit codes: 0 ok, 1 usage error, 2 a tool (ffmpeg, Chrome) is missing or failed.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const W = 1280;
const H = 720;
const CAP_H = 150; // height of one caption block in the strip
const SCENE_H = 40;
const FPS = 20;
export const PALETTE = ['#7dd3fc', '#fca5a5', '#86efac', '#fcd34d', '#c4b5fd', '#f9a8d4'];

const USAGE = 'Usage: node scripts/render-preview.mjs <dir> [--out file.mp4] [--max-mb 3] [--chrome path] [--ffmpeg path]';

export const vttTime = (s) => {
  const m = String(s).trim().match(/^(?:(\d+):)?(\d+):(\d+)[.,](\d+)$/);
  if (!m) return NaN;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(`0.${m[4]}`);
};

// WebVTT → [{start, end, speaker, text}] (speaker from `<v NAME>`, else null).
export function parseVtt(src) {
  const cues = [];
  for (const block of String(src).replace(/\r/g, '').split(/\n\n+/)) {
    const lines = block.split('\n').filter(Boolean);
    const i = lines.findIndex((l) => l.includes('-->'));
    if (i < 0) continue;
    const [a, b] = lines[i].split('-->');
    let speaker = null;
    const text = lines.slice(i + 1).map((l) => {
      const v = l.match(/^<v ([^>]+)>(.*)$/);
      if (v) { speaker = v[1].trim(); return v[2]; }
      return l;
    }).join('\n').replace(/<\/?[^>]+>/g, '').trim();
    cues.push({ start: vttTime(a), end: vttTime(b.trim().split(/\s+/)[0]), speaker, text });
  }
  return cues.filter((c) => Number.isFinite(c.start) && Number.isFinite(c.end) && c.text);
}

// Speaker for a caption: its <v> label, else the timeline line it overlaps most.
export function speakerAt(cue, lines) {
  if (cue.speaker) return cue.speaker;
  let best = null;
  let most = 0;
  for (const l of lines ?? []) {
    if (l.kind && l.kind !== 'speech') continue;
    const o = Math.min(cue.end, l.end) - Math.max(cue.start, l.start);
    if (o > most) { most = o; best = l.speaker; }
  }
  return best;
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const FONT = `-apple-system, "Segoe UI", "Helvetica Neue", "Hiragino Sans", "Apple SD Gothic Neo", "Kohinoor Devanagari", "Noto Sans", "Noto Sans CJK JP", "Noto Sans Devanagari", sans-serif`;
const pretty = (name) => String(name ?? '').replace(/_/g, ' ');

// The static frame: title, subtitle, waveform track and brand line.
export function backgroundHtml({ title, subtitle }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:#0b0f17;font-family:${FONT};}
.bg{position:absolute;inset:0;background:radial-gradient(1200px 500px at 50% 40%, #131b2b 0%, #0b0f17 70%);}
.t{position:absolute;left:80px;top:56px;color:#f3f4f6;font-size:40px;font-weight:650;letter-spacing:-0.01em;}
.s{position:absolute;left:80px;top:112px;color:#9ca3af;font-size:20px;}
.line{position:absolute;left:80px;right:80px;top:330px;height:1px;background:#1f2937;}
.b{position:absolute;right:80px;top:64px;color:#6b7280;font-size:17px;letter-spacing:0.08em;text-transform:uppercase;}
.track{position:absolute;left:0;right:0;bottom:0;height:4px;background:#111827;}
</style></head><body><div class="bg"></div><div class="t">${esc(title)}</div><div class="s">${esc(subtitle)}</div><div class="line"></div><div class="b">agentatelier audio</div><div class="track"></div></body></html>`;
}

// One tall page: a caption block per cue (CAP_H high), then a scene label block per scene (SCENE_H).
export function stripHtml(cues, scenes, colors) {
  const caps = cues.map((c) => {
    const color = colors[c.speaker] ?? '#e5e7eb';
    return `<div class="c"><div class="in">${c.speaker ? `<div class="n" style="color:${color}">${esc(pretty(c.speaker))}</div>` : ''}<div class="x">${esc(c.text.replace(/\n/g, ' '))}</div></div></div>`;
  }).join('');
  const sc = scenes.map((s) => `<div class="sc"><span>${esc(s.name)}</span></div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:transparent;font-family:${FONT};}
.c{width:${W}px;height:${CAP_H}px;display:flex;align-items:flex-start;justify-content:center;overflow:hidden;}
.in{max-width:1040px;text-align:center;}
.n{font-size:18px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;}
.x{color:#f9fafb;font-size:34px;line-height:1.3;font-weight:500;text-shadow:0 2px 12px rgba(0,0,0,.6);}
.sc{width:${W}px;height:${SCENE_H}px;display:flex;align-items:center;padding-left:80px;box-sizing:border-box;}
.sc span{color:#d1d5db;font-size:17px;border:1px solid #374151;border-radius:999px;padding:4px 14px;background:#111827;}
</style></head><body>${caps}${sc}</body></html>`;
}

function findChrome(explicit) {
  const c = [explicit, process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  return c.find((p) => p && existsSync(p));
}

function screenshot(chrome, html, file, height, work) {
  const page = join(work, `${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
  writeFileSync(page, html);
  try {
    execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${join(work, 'chrome')}`,
      '--default-background-color=00000000', `--window-size=${W},${height}`, `--screenshot=${file}`, pathToFileURL(page).href], { stdio: 'ignore', timeout: 120000 });
  } catch (e) {
    // Headless Chrome on macOS can exit non-zero from its teardown watchdog after writing the file.
    if (!existsSync(file)) throw Object.assign(new Error(`Chrome failed: ${e.message}`), { exitCode: 2 });
  }
  if (!existsSync(file)) throw Object.assign(new Error(`Chrome did not write ${file}`), { exitCode: 2 });
}

const r3 = (x) => Math.round(x * 1000) / 1000;

export function filterGraph({ cues, scenes, duration }) {
  const n = cues.length + scenes.length;
  const parts = [];
  // [0] background still, [1] audio, [2] caption/scene strip, [3] progress bar
  parts.push(`[1:a]aformat=channel_layouts=mono,showwaves=s=1120x200:mode=cline:rate=${FPS}:colors=0x7dd3fc@0.85:scale=sqrt,format=rgba[wave]`);
  parts.push(`[0:v]fps=${FPS},format=yuv420p[bg]`);
  parts.push(`[bg][wave]overlay=80:230:shortest=1[v0]`);
  parts.push(`[3:v]format=rgba[bar]`);
  parts.push(`[v0][bar]overlay=x='-${W}+${W}*t/${r3(duration)}':y=${H - 4}:shortest=1[v1]`);
  let last = 'v1';
  if (n) parts.push(`[2:v]format=rgba,split=${n}${Array.from({ length: n }, (_, i) => `[s${i}]`).join('')}`);
  cues.forEach((c, i) => {
    parts.push(`[s${i}]crop=${W}:${CAP_H}:0:${i * CAP_H}[c${i}]`);
    parts.push(`[${last}][c${i}]overlay=0:${H - CAP_H - 60}:enable='between(t,${r3(c.start)},${r3(c.end)})'[o${i}]`);
    last = `o${i}`;
  });
  scenes.forEach((s, j) => {
    const i = cues.length + j;
    const end = j + 1 < scenes.length ? scenes[j + 1].start : duration;
    parts.push(`[s${i}]crop=${W}:${SCENE_H}:0:${cues.length * CAP_H + j * SCENE_H}[c${i}]`);
    parts.push(`[${last}][c${i}]overlay=0:150:enable='between(t,${r3(s.start)},${r3(end)})'[o${i}]`);
    last = `o${i}`;
  });
  return { graph: parts.join(';'), out: last };
}

export async function renderPreview(dir, { out, maxMb = 3, chrome: chromeOpt, ffmpeg = process.env.AGENTATELIER_FFMPEG ?? 'ffmpeg' } = {}) {
  const tl = JSON.parse(readFileSync(join(dir, 'timeline.json'), 'utf8'));
  const cues = parseVtt(readFileSync(join(dir, 'captions.vtt'), 'utf8'));
  const audio = ['mix.wav', 'mix.mp3'].map((f) => join(dir, f)).find((p) => existsSync(p));
  if (!audio) throw Object.assign(new Error(`no mix.wav or mix.mp3 in ${dir}`), { exitCode: 1 });
  const chrome = findChrome(chromeOpt);
  if (!chrome) throw Object.assign(new Error('Chrome or Chromium not found (set CHROME_PATH or pass --chrome)'), { exitCode: 2 });
  const speakers = [...new Set(tl.lines.filter((l) => l.kind !== 'nv').map((l) => l.speaker))];
  const colors = Object.fromEntries(speakers.map((s, i) => [s, PALETTE[i % PALETTE.length]]));
  for (const c of cues) c.speaker = speakerAt(c, tl.lines);
  const voices = speakers.map((s) => `${pretty(s)} (${tl.lines.find((l) => l.speaker === s)?.voice ?? '?'})`).join(' · ');
  const mins = Math.floor(tl.duration_s / 60);
  const secs = Math.round(tl.duration_s % 60);
  const subtitle = `${voices}  ·  ${mins ? `${mins} min ` : ''}${secs} s`;
  const scenes = (tl.scenes ?? []).filter((s) => s.name);
  const work = mkdtempSync(join(tmpdir(), 'aa-preview-'));
  try {
    const bg = join(work, 'bg.png');
    const strip = join(work, 'strip.png');
    const bar = join(work, 'bar.png');
    screenshot(chrome, backgroundHtml({ title: tl.title, subtitle }), bg, H, work);
    const stripH = Math.max(SCENE_H, cues.length * CAP_H + scenes.length * SCENE_H);
    screenshot(chrome, stripHtml(cues, scenes, colors), strip, stripH, work);
    execFileSync(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=0x7dd3fc:s=${W}x4`, '-frames:v', '1', bar]);
    const { graph, out: label } = filterGraph({ cues, scenes, duration: tl.duration_s });
    writeFileSync(join(work, 'graph.txt'), graph);
    const target = out ?? join(dir, 'preview.mp4');
    const audioKbps = 96;
    const budgetKbits = maxMb * 0.94 * 8 * 1024 * 1024 / 1000;
    let videoKbps = Math.max(60, Math.floor(budgetKbits / tl.duration_s - audioKbps));
    for (let attempt = 0; attempt < 4; attempt++) {
      execFileSync(ffmpeg, ['-v', 'error', '-y', '-loop', '1', '-framerate', String(FPS), '-i', bg, '-i', audio, '-loop', '1', '-framerate', String(FPS), '-i', strip, '-loop', '1', '-framerate', String(FPS), '-i', bar,
        '-filter_complex_script', join(work, 'graph.txt'), '-map', `[${label}]`, '-map', '1:a',
        '-c:v', 'libx264', '-preset', 'slow', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-b:v', `${Math.min(videoKbps, 900)}k`, '-maxrate', `${Math.min(videoKbps, 900) * 2}k`, '-bufsize', `${Math.min(videoKbps, 900) * 4}k`,
        '-c:a', 'aac', '-b:a', `${audioKbps}k`, '-movflags', '+faststart', '-shortest', '-t', String(tl.duration_s), target], { stdio: ['ignore', 'ignore', 'inherit'] });
      const mb = statSync(target).size / 1024 / 1024;
      if (mb <= maxMb) return { path: target, mb, video_kbps: Math.min(videoKbps, 900), cues: cues.length, scenes: scenes.length };
      videoKbps = Math.floor(videoKbps * 0.75);
    }
    throw Object.assign(new Error(`could not fit ${target} under ${maxMb} MB`), { exitCode: 2 });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

const isMain = (() => { try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; } })();
if (isMain) {
  if (process.argv.slice(2).some((a) => a === '--help' || a === '-h')) { process.stdout.write(`${USAGE}\n`); process.exit(0); }
  let parsed;
  try {
    parsed = parseArgs({ allowPositionals: true, options: { out: { type: 'string' }, 'max-mb': { type: 'string' }, chrome: { type: 'string' }, ffmpeg: { type: 'string' } } });
  } catch (e) {
    process.stderr.write(`${e.message}\n${USAGE}\n`);
    process.exit(1);
  }
  const { values, positionals } = parsed;
  if (positionals.length !== 1) { process.stderr.write(`${USAGE}\n`); process.exit(1); }
  try {
    const r = await renderPreview(resolve(positionals[0]), { out: values.out && resolve(values.out), maxMb: values['max-mb'] ? Number(values['max-mb']) : 3, chrome: values.chrome, ffmpeg: values.ffmpeg });
    process.stdout.write(`${r.path}: ${r.mb.toFixed(2)} MB, ${r.cues} captions, ${r.scenes} scenes, video ${r.video_kbps} kbps\n`);
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exit(e.exitCode ?? 2);
  }
}
