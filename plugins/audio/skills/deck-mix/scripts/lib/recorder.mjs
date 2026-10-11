// Recording the user's own voice with ffmpeg: device arguments per OS, device
// lists, live capture with push-to-stop (Enter) or auto-stop on silence after
// speech, the clean chain (trim, light denoise, 80 Hz highpass, loudness) and
// the one-take splitter (ASR word times aligned to the script lines).
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { run, ffmpegPath, readWavInfo, FfmpegError, SR } from './ffmpeg.mjs';
import { parseLoudnormJson } from './master.mjs';
import { normaliseForWer } from './qa.mjs';
import { UsageError } from './args.mjs';
import { projectConsent } from './voices.mjs';

// Recordings are stored at -20 LUFS (true peak <= -1.5 dBTP). Supertonic
// renders measure about -26 LUFS (F2 -26.1, M3 -25.3 on the lab clips), so
// produce places a recorded line RECORD_GAIN_DB lower to sit level with the
// synthetic voices before the mix is mastered.
export const RECORD_LUFS = -20;
export const SYNTH_LUFS = -26;
export const RECORD_GAIN_DB = SYNTH_LUFS - RECORD_LUFS;
export const RECORD_PEAK_DB = -1.5;
export const IMPORT_EXTS = ['.wav', '.mp3', '.m4a', '.aac', '.flac', '.ogg'];
export const importable = (file) => IMPORT_EXTS.includes(extname(String(file)).toLowerCase());

// A recording that cannot be used (silent, too short). Exit 1: the user re-records.
export class RecordingError extends Error {
  constructor(message) { super(message); this.name = 'RecordingError'; this.exitCode = 1; }
}

// ffmpeg input arguments for the microphone. device: macOS avfoundation
// audio index or name (default 0), Linux PulseAudio source (default
// "default"), Windows DirectShow device name (required: see --list-devices).
export function inputArgs({ platform = process.platform, device } = {}) {
  const d = device === undefined || device === null || String(device).trim() === '' ? null : String(device).trim();
  if (platform === 'darwin') return ['-f', 'avfoundation', '-i', `:${d ?? '0'}`];
  if (platform === 'linux') return ['-f', 'pulse', '-i', d ?? 'default'];
  if (platform === 'win32') {
    if (!d) throw new UsageError('On Windows pass --device "<microphone name>"; run `node scripts/record.mjs --list-devices` to see the names.');
    return ['-f', 'dshow', '-i', `audio=${d}`];
  }
  throw new UsageError(`Recording from a microphone is not supported on ${platform}; record the lines elsewhere and pass --from <file>.`);
}

export function listDevicesArgs(platform = process.platform) {
  if (platform === 'darwin') return ['-f', 'avfoundation', '-list_devices', 'true', '-i', ''];
  if (platform === 'linux') return ['-sources', 'pulse'];
  if (platform === 'win32') return ['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'];
  throw new UsageError(`Listing microphones is not supported on ${platform}.`);
}

// Audio inputs from the ffmpeg device listing: [{id, name, default?}].
export function parseDeviceList(platform, text) {
  const lines = String(text ?? '').split(/\r?\n/);
  const out = [];
  if (platform === 'darwin') {
    let audio = false;
    for (const l of lines) {
      if (/AVFoundation audio devices:/.test(l)) { audio = true; continue; }
      if (/AVFoundation video devices:/.test(l)) { audio = false; continue; }
      const m = audio && /\]\s*\[(\d+)\]\s+(.+?)\s*$/.exec(l);
      if (m) out.push({ id: m[1], name: m[2] });
    }
  } else if (platform === 'win32') {
    for (const l of lines) {
      const m = /\]\s+"([^"]+)"\s+\(audio\)/.exec(l);
      if (m) out.push({ id: m[1], name: m[1] });
    }
  } else {
    for (const l of lines) {
      const m = /^\s*(\*)?\s*(\S+)\s+\[(.+)\]\s*$/.exec(l);
      if (!m || /\.monitor$/.test(m[2])) continue;
      out.push({ id: m[2], name: m[3], ...(m[1] ? { default: true } : {}) });
    }
  }
  return out;
}

export function captureArgs({ input, out, maxSeconds = 30, silenceS = 1.2, noiseDb = -40 }) {
  return [...input, '-af', `silencedetect=noise=${noiseDb}dB:d=${silenceS}`, '-ac', '1', '-ar', String(SR), '-t', String(maxSeconds), '-c:a', 'pcm_s16le', out];
}

// Watches ffmpeg's silencedetect lines; feed() returns true when the take
// should stop: silence after the user has spoken. Speech is a silence_end, or
// a first silence that starts after minSpeechS of sound.
export function autoStopper({ minSpeechS = 0.3 } = {}) {
  let spoke = false;
  return {
    feed(line) {
      const s = /silence_start:\s*(-?[\d.]+)/.exec(line);
      if (s) return spoke || Number(s[1]) >= minSpeechS;
      if (/silence_end:/.test(line)) spoke = true;
      return false;
    },
    get spoke() { return spoke; },
  };
}

const MIC_HINT = 'If this is macOS, allow microphone access for your terminal app (System Settings > Privacy & Security > Microphone) and try again; or record elsewhere and pass --from <file>.';

// One live take. Resolves {path, stoppedBy: 'silence'|'enter'|'max'}.
// `keys`: a readable stream (a TTY's stdin) where Enter stops the take.
export function captureLive({ input, out, maxSeconds = 30, silenceS = 1.2, noiseDb = -40, minSpeechS = 0.3, keys = null } = {}) {
  const bin = ffmpegPath();
  if (!bin) return Promise.reject(new FfmpegError('ffmpeg not found on PATH; install ffmpeg', { missing: true }));
  mkdirSync(dirname(out), { recursive: true });
  const args = ['-hide_banner', '-nostats', '-loglevel', 'info', '-y', ...captureArgs({ input, out, maxSeconds, silenceS, noiseDb })];
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['pipe', 'ignore', 'pipe'] });
    const stopper = autoStopper({ minSpeechS });
    let stoppedBy = null;
    let buf = '';
    const tail = [];
    const stop = (why) => {
      if (stoppedBy) return;
      stoppedBy = why;
      try { child.stdin.write('q'); } catch { /* already exiting */ }
    };
    const onKey = (chunk) => { if (String(chunk).includes('\n') || String(chunk).includes('\r')) stop('enter'); };
    keys?.on('data', onKey);
    const guard = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* gone */ } }, (maxSeconds + 15) * 1000);
    child.stdin.on('error', () => {});
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (c) => {
      const parts = (buf + c).split(/\r?\n|\r/);
      buf = parts.pop();
      for (const l of parts) {
        tail.push(l); if (tail.length > 8) tail.shift();
        if (stopper.feed(l)) stop('silence');
      }
    });
    child.on('error', (e) => { clearTimeout(guard); keys?.off('data', onKey); reject(new FfmpegError(e.message)); });
    child.on('close', (code) => {
      clearTimeout(guard);
      keys?.off('data', onKey);
      if (existsSync(out) && (code === 0 || stoppedBy)) return resolve({ path: out, stoppedBy: stoppedBy ?? 'max', spoke: stopper.spoke });
      reject(new FfmpegError(`could not record from the microphone (exit ${code}).\n${tail.join('\n')}\n${MIC_HINT}`));
    });
  });
}

// highpass and light denoise first, then the silence at both ends is trimmed
// (keeping 0.15 s of air before and 0.3 s after the speech).
export function cleanFilter({ trim = true, thresholdDb = -45 } = {}) {
  const chain = ['highpass=f=80', 'afftdn=nr=10:nf=-50'];
  if (trim) {
    const cut = (keep) => `silenceremove=start_periods=1:start_threshold=${thresholdDb}dB:start_silence=${keep}`;
    chain.push(cut(0.15), 'areverse', cut(0.3), 'areverse');
  }
  return chain.join(',');
}

const num = (v) => { const n = Number.parseFloat(v); return Number.isFinite(n) ? n : -Infinity; };
export async function measureLoudness(path) {
  const { stderr } = await run(['-i', path, '-af', 'loudnorm=print_format=json', '-f', 'null', '-']);
  const j = parseLoudnormJson(stderr);
  return { I: num(j.input_i), TP: num(j.input_tp) };
}

// Any importable file or raw take → <dest>: 44.1 kHz mono 16-bit WAV, cleaned,
// at RECORD_LUFS by a linear gain (no compression), true peak capped.
export async function cleanRecording(src, dest, { trim = true, maxSeconds, lufs = RECORD_LUFS, peakDb = RECORD_PEAK_DB } = {}) {
  mkdirSync(dirname(dest), { recursive: true });
  const stage = `${dest}.stage.wav`;
  const af = [cleanFilter({ trim }), maxSeconds ? `atrim=0:${maxSeconds}` : '', `aresample=${SR}`].filter(Boolean).join(',');
  try {
    await run(['-i', src, '-vn', '-af', af, '-ac', '1', '-ar', String(SR), '-c:a', 'pcm_s16le', stage]);
    const info = await readWavInfo(stage);
    const dur = info ? info.samples / info.sampleRate : 0;
    if (dur < 0.2) throw new RecordingError(`no speech found in ${src} (nothing above the noise floor after trimming)`);
    const m = await measureLoudness(stage);
    if (!Number.isFinite(m.I) || m.I < -70) throw new RecordingError(`the recording ${src} is silent or far too quiet (${Number.isFinite(m.I) ? m.I.toFixed(1) : '-inf'} LUFS); move closer to the microphone or check the input device`);
    let gain = lufs - m.I;
    if (Number.isFinite(m.TP) && m.TP + gain > peakDb) gain = peakDb - m.TP;
    gain = Math.max(-30, Math.min(30, gain));
    await run(['-i', stage, '-af', `volume=${gain.toFixed(2)}dB`, '-c:a', 'pcm_s16le', `${dest}.part.wav`]);
    renameSync(`${dest}.part.wav`, dest);
    const out = await readWavInfo(dest);
    return { path: dest, duration_s: Math.round((out.samples / out.sampleRate) * 10000) / 10000, input_lufs: Math.round(m.I * 10) / 10, gain_db: Math.round(gain * 100) / 100 };
  } finally {
    rmSync(stage, { force: true });
    rmSync(`${dest}.part.wav`, { force: true });
  }
}

// One piece of a take, with 10 ms fades so a cut never clicks.
export async function cutClip(src, dest, start, end) {
  mkdirSync(dirname(dest), { recursive: true });
  const d = Math.max(0.05, end - start);
  await run(['-ss', start.toFixed(3), '-t', d.toFixed(3), '-i', src, '-af', `afade=t=in:d=0.01,afade=t=out:st=${Math.max(0, d - 0.01).toFixed(3)}:d=0.01`, '-ac', '1', '-ar', String(SR), '-c:a', 'pcm_s16le', `${dest}.part.wav`]);
  renameSync(`${dest}.part.wav`, dest);
  const info = await readWavInfo(dest);
  return { path: dest, duration_s: Math.round((info.samples / info.sampleRate) * 10000) / 10000 };
}

const CUT_PRE_S = 0.15;
const CUT_POST_S = 0.3;

// One take of several script lines → where each line is. lines: [{id, text, lang?}];
// words: ASR [{w, start, end}] for the whole take. Word-level edit-distance
// alignment of the normalised script words against the heard words, so a
// misread, a skipped word or an "um" only affects its own line. A heard word
// with no script partner belongs to the line before it. Returns per line
// {id, start, end, heard, words (relative to start), missing?}; cut points
// sit between lines and never overlap.
export function splitTake(lines, words, { duration_s, lang = 'en' } = {}) {
  const ref = [];
  lines.forEach((l, i) => {
    for (const t of normaliseForWer(String(l.text ?? '').replace(/<[^>]*>/g, ' '), l.lang ?? lang).split(' ').filter(Boolean)) ref.push({ t, line: i });
  });
  const hyp = [];
  words.forEach((w, j) => {
    for (const t of normaliseForWer(w.w, lang).split(' ').filter(Boolean)) hyp.push({ t, word: j });
  });
  const m = ref.length;
  const n = hyp.length;
  const dp = Array.from({ length: m + 1 }, () => new Float64Array(n + 1));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const sub = ref[i - 1].t === hyp[j - 1].t ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j - 1] + sub, dp[i - 1][j] + 1, dp[i][j - 1] + 1);
    }
  }
  // Backtrace: heard token → script line (null for insertions, filled after).
  const lineOfHyp = new Array(n).fill(null);
  for (let i = m, j = n; i > 0 || j > 0;) {
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + (ref[i - 1].t === hyp[j - 1].t ? 0 : 1)) {
      lineOfHyp[j - 1] = ref[i - 1].line; i--; j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      i--;
    } else {
      j--;
    }
  }
  // An inserted word ("um", a repeat) joins the aligned neighbour nearer in time.
  const aligned = lineOfHyp.map((x) => x !== null);
  for (let j = 0; j < n; j++) {
    if (aligned[j]) continue;
    let p = j - 1; while (p >= 0 && !aligned[p]) p--;
    let q = j + 1; while (q < n && !aligned[q]) q++;
    const w = words[hyp[j].word];
    const gapPrev = p >= 0 ? w.start - words[hyp[p].word].end : Infinity;
    const gapNext = q < n ? words[hyp[q].word].start - w.end : Infinity;
    lineOfHyp[j] = gapPrev <= gapNext ? (p >= 0 ? lineOfHyp[p] : 0) : (q < n ? lineOfHyp[q] : 0);
  }
  // Per line: the words whose tokens landed there (a word goes to its first token's line).
  const wordLine = new Map();
  hyp.forEach((h, j) => { if (!wordLine.has(h.word)) wordLine.set(h.word, lineOfHyp[j]); });
  const per = lines.map(() => []);
  words.forEach((w, j) => { if (wordLine.has(j)) per[wordLine.get(j)].push(w); });
  const total = duration_s ?? Math.max(0, ...words.map((w) => w.end)) + CUT_POST_S;
  const spans = per.map((ws) => (ws.length ? { s: Math.min(...ws.map((w) => w.start)), e: Math.max(...ws.map((w) => w.end)) } : null));
  return lines.map((l, i) => {
    const sp = spans[i];
    if (!sp) return { id: l.id, start: null, end: null, heard: '', words: [], missing: true };
    const before = spans.slice(0, i).filter(Boolean).at(-1);
    const after = spans.slice(i + 1).find(Boolean);
    const start = Math.max(0, sp.s - CUT_PRE_S, before ? (before.e + sp.s) / 2 : 0);
    const end = Math.min(total, sp.e + CUT_POST_S, after ? (sp.e + after.s) / 2 : Infinity);
    const r = (x) => Math.round(x * 1000) / 1000;
    return {
      id: l.id, start: r(start), end: r(end),
      heard: per[i].map((w) => w.w).join(' '),
      words: per[i].map((w) => ({ ...w, start: r(w.start - start), end: r(w.end - start) })),
    };
  });
}

// --- the project's recordings (<out>/recordings/recordings.json) ----------

export const recordingsDir = (out) => join(out, 'recordings');
export const recordingsFile = (out) => join(out, 'recordings', 'recordings.json');

export function readRecordings(out) {
  try {
    const j = JSON.parse(readFileSync(recordingsFile(out), 'utf8'));
    return { version: 1, ...j, lines: j.lines ?? {} };
  } catch {
    return { version: 1, lines: {} };
  }
}

// entry: {speaker, text, path (relative to out), duration_s, wer, ok, problems, heard, asr, ...}
export function saveRecordings(out, entries) {
  const doc = readRecordings(out);
  for (const [id, e] of Object.entries(entries)) doc.lines[id] = e;
  mkdirSync(recordingsDir(out), { recursive: true });
  writeFileSync(`${recordingsFile(out)}.part`, JSON.stringify(doc, null, 2) + '\n');
  renameSync(`${recordingsFile(out)}.part`, recordingsFile(out));
  return doc;
}

export const sameText = (a, b, lang = 'en') => normaliseForWer(a, lang) === normaliseForWer(b, lang);

// For produce: the recording of every `record` item, or what is missing.
// Returns {found: Map(item id → entry with absolute path), missing: [{item, reason}], noConsent: [speaker]}.
export function recordingsFor(out, items) {
  const doc = readRecordings(out);
  const found = new Map();
  const missing = [];
  const noConsent = new Set();
  for (const it of items) {
    if (!projectConsent(out, it.speaker)) noConsent.add(it.speaker);
    const e = doc.lines[it.rec_id];
    const abs = e?.path ? join(out, e.path) : null;
    if (!e || !abs || !existsSync(abs)) missing.push({ item: it, reason: 'not recorded' });
    else if (e.speaker !== it.speaker || !sameText(e.text, it.text, it.lang)) missing.push({ item: it, reason: 'the line changed since it was recorded' });
    else found.set(it.id, { ...e, path: abs });
  }
  return { found, missing, noConsent: [...noConsent] };
}
