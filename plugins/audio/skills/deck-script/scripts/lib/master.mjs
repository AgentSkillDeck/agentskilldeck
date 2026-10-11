// Mastering + loudness gate.
// LUFS mode: two-pass loudnorm (measure JSON, then linear apply) + limiter.
// ACX mode: astats RMS/peak, gain to -20 dB RMS, limiter at -3.5 dBFS.
// Both re-measure the result and report {I, TP, LRA, rms, peak, ok, problems}.
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { run, probeDuration, SR } from './ffmpeg.mjs';

export const LU_TOLERANCE = 1;
const TP_TOLERANCE = 0.1;
const SILENCE_MAX_S = 4;
const SILENCE_DB = -50;
const ACX_TARGET_RMS = -20;
const ACX_LIMIT_DB = -3.5;
export const ACX_NOISE_FLOOR_DB = -60;
const SILENT_DB = -70; // a mix whose overall RMS is below this has no programme in it

const dbToLin = (db) => Math.pow(10, db / 20);
const num = (v) => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : -Infinity; // "-inf" from silence
};
const r3 = (x) => Math.round(x * 1000) / 1000;
const round2 = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : x);

export function parseLoudnormJson(stderr) {
  const blocks = stderr.match(/\{[^{}]*"input_i"[^{}]*\}/g);
  if (!blocks) throw new Error('loudnorm: no measurement JSON in ffmpeg output');
  return JSON.parse(blocks[blocks.length - 1]);
}

export function parseAstats(stderr) {
  const idx = stderr.lastIndexOf('Overall');
  const tail = idx >= 0 ? stderr.slice(idx) : stderr;
  const rms = tail.match(/RMS level dB:\s*(\S+)/);
  const peak = tail.match(/Peak level dB:\s*(\S+)/);
  const trough = tail.match(/RMS t(?:h)?rough dB:\s*(\S+)/); // ffmpeg prints "RMS through"
  if (!rms || !peak) throw new Error('astats: no overall RMS/peak in ffmpeg output');
  return { rms: num(rms[1]), peak: num(peak[1]), ...(trough ? { trough: num(trough[1]) } : {}) };
}

export function parseSilences(stderr) {
  const out = [];
  let open = null;
  for (const m of stderr.matchAll(/silence_(start|end):\s*(-?[\d.]+)/g)) {
    if (m[1] === 'start') open = Math.max(0, Number(m[2]));
    else if (open !== null) {
      out.push({ start: open, end: Number(m[2]) });
      open = null;
    }
  }
  if (open !== null) out.push({ start: open, end: null }); // runs to the end
  return out;
}

// One decode: astats + silencedetect (passthrough) before loudnorm's analysis.
async function measure(path, target = {}) {
  const I = target.I ?? -16;
  const TP = target.TP ?? -1;
  const LRA = target.LRA ?? 11;
  const af = `astats=metadata=0:reset=0,silencedetect=n=${SILENCE_DB}dB:d=${SILENCE_MAX_S},loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:print_format=json`;
  const { stderr } = await run(['-i', path, '-af', af, '-f', 'null', '-']);
  const ln = parseLoudnormJson(stderr);
  return { ln, ...parseAstats(stderr), silences: parseSilences(stderr) };
}

export function gateProblems(m, loudness, { duration_s, allowSilence = [] } = {}) {
  const problems = [];
  if (!(m.rms > SILENT_DB)) {
    problems.push(`silent mix: overall RMS ${round2(m.rms)} dB (nothing audible was rendered)`);
    return problems;
  }
  if (loudness.mode === 'acx') {
    // Noise floor = the quietest 50 ms RMS window (room tone between phrases).
    if (Number.isFinite(m.noise_floor) && m.noise_floor > ACX_NOISE_FLOOR_DB) problems.push(`noise floor ${round2(m.noise_floor)} dB above ACX limit ${ACX_NOISE_FLOOR_DB} dB`);
    const { rms_min = -23, rms_max = -18, peak_max = -3 } = loudness;
    if (!(m.rms >= rms_min && m.rms <= rms_max)) problems.push(`RMS ${round2(m.rms)} dB outside ACX range ${rms_min}…${rms_max} dB`);
    if (m.peak > peak_max) problems.push(`peak ${round2(m.peak)} dBFS above ACX limit ${peak_max} dBFS`);
  } else {
    const I = loudness.I ?? -16;
    const TP = loudness.TP ?? -1;
    if (!(Math.abs(m.I - I) <= LU_TOLERANCE)) problems.push(`integrated loudness ${round2(m.I)} LUFS outside ${I} ±${LU_TOLERANCE} LU`);
    if (m.TP > TP + TP_TOLERANCE) problems.push(`true peak ${round2(m.TP)} dBTP above ${TP} dBTP`);
  }
  if (m.peak >= -0.01) problems.push(`clipping: sample peak ${round2(m.peak)} dBFS`);
  const end = duration_s ?? Infinity;
  for (const s of m.silences || []) {
    const sEnd = s.end ?? end;
    if (s.start <= 0.05 || sEnd >= end - 0.05) continue; // head/tail room tone
    if (sEnd - s.start <= SILENCE_MAX_S) continue;
    const asked = allowSilence.some((w) => w.start <= s.start + 0.5 && w.end >= sEnd - 0.5);
    if (!asked) problems.push(`silence gap of ${round2(sEnd - s.start)} s at ${round2(s.start)} s (max ${SILENCE_MAX_S} s)`);
  }
  return problems;
}

// MP3 encoding can overshoot the master's peak (bedtime: -1.3 dBTP in the WAV,
// -1.1 after VBR, 0.0 at 112 kbps). If the decoded MP3 is over the limit, it
// is re-encoded through a peak limiter (4x oversampled, so it catches
// inter-sample peaks) set under the limit by the overshoot plus a margin. Only
// the peaks move: the bedtime MP3 stays at -16.5 LUFS, where turning the whole
// file down 1.2 dB would have left it at -17.7.
const MP3_MARGIN_DB = 0.2;
export function mp3TrimDb(peak, limit) {
  if (!(peak > limit + TP_TOLERANCE)) return 0;
  return round2(limit - peak - MP3_MARGIN_DB);
}

export async function encodeMp3(wav, mp3, loudness, { rate } = {}) {
  // ACX requires constant 192 kbps (sample peak <= -3 dBFS); everything else
  // uses LAME VBR -q:a 2 (true peak <= the target).
  const acx = loudness.mode === 'acx';
  const bitrate = rate ?? (acx ? ['-b:a', '192k'] : ['-q:a', '2']);
  const limit = acx ? (loudness.peak_max ?? -3) : (loudness.TP ?? -1);
  let ceiling = null; // limiter ceiling in dBFS, once one is needed
  let m;
  for (let pass = 0; pass < 4; pass++) {
    const af = ceiling === null ? [] : ['-af', `aresample=${SR * 4},alimiter=limit=${dbToLin(ceiling).toFixed(4)}:attack=1:release=50:level=false,aresample=${SR}`];
    await run(['-i', wav, ...af, '-c:a', 'libmp3lame', ...bitrate, mp3]);
    m = await measure(mp3, { I: loudness.I, TP: loudness.TP });
    const peak = acx ? m.peak : num(m.ln.input_tp);
    const trim = mp3TrimDb(peak, limit);
    if (!trim) break;
    ceiling = (ceiling ?? limit) + trim;
  }
  return { TP: round2(num(m.ln.input_tp)), peak: round2(m.peak), limiter_db: ceiling === null ? null : round2(ceiling) };
}

export async function master(input, out, loudness = { mode: 'lufs', I: -16, TP: -1 }, { allowSilence = [], mp3 = true } = {}) {
  await mkdir(dirname(out), { recursive: true });
  const mp3Path = out.replace(/\.wav$/i, '') + '.mp3';
  const mode = loudness.mode === 'acx' ? 'acx' : 'lufs';
  let gain_db = 0;
  if (mode === 'lufs') {
    const I = loudness.I ?? -16;
    const TP = loudness.TP ?? -1;
    const first = await measure(input, { I, TP });
    const ln = first.ln;
    if (!(first.rms > SILENT_DB)) return silentResult(first, out, mode);
    // Linear mode needs the target LRA to cover the measured LRA.
    const LRA = Math.min(20, Math.max(11, Math.ceil(num(ln.input_lra)) + 1));
    const limit = Math.min(1, Math.max(0.0625, dbToLin(TP - 0.3)));
    const af = [
      `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:measured_I=${ln.input_i}:measured_TP=${ln.input_tp}:measured_LRA=${ln.input_lra}:measured_thresh=${ln.input_thresh}:offset=${ln.target_offset}:linear=true:print_format=summary`,
      `alimiter=limit=${limit.toFixed(6)}:level=0`,
    ].join(',');
    gain_db = I - num(ln.input_i);
    await run(['-i', input, '-af', af, '-ar', String(SR), '-c:a', 'pcm_s16le', out]);
  } else {
    const first = await measure(input);
    if (!(first.rms > SILENT_DB)) return silentResult(first, out, mode);
    gain_db = ACX_TARGET_RMS - first.rms;
    if (!Number.isFinite(gain_db)) gain_db = 0; // digital silence: nothing to scale
    const af = `volume=${gain_db.toFixed(3)}dB,alimiter=limit=${dbToLin(ACX_LIMIT_DB).toFixed(6)}:level=0`;
    await run(['-i', input, '-af', af, '-ar', String(SR), '-c:a', 'pcm_s16le', out]);
  }
  const target = mode === 'lufs' ? { I: loudness.I ?? -16, TP: loudness.TP ?? -1 } : {};
  const after = await measure(out, target);
  const m = {
    I: round2(num(after.ln.input_i)),
    TP: round2(num(after.ln.input_tp)),
    LRA: round2(num(after.ln.input_lra)),
    rms: round2(after.rms),
    peak: round2(after.peak),
    noise_floor: noiseFloor(after),
    silences: after.silences,
  };
  const duration_s = await probeDuration(out);
  if (mode === 'acx' && duration_s > 3) {
    // Measure the floor away from the head/tail fades (they reach digital silence).
    const { stderr } = await run(['-ss', '1', '-t', String(r3(duration_s - 2)), '-i', out, '-af', 'astats=metadata=0:reset=0', '-f', 'null', '-']);
    m.noise_floor = noiseFloor({ ...parseAstats(stderr) });
  }
  const problems = gateProblems(m, { ...loudness, mode }, { duration_s, allowSilence });
  const enc = mp3 ? await encodeMp3(out, mp3Path, loudness) : null;
  return {
    I: m.I,
    TP: m.TP,
    LRA: m.LRA,
    rms: m.rms,
    peak: m.peak,
    ok: problems.length === 0,
    problems,
    mode,
    gain_db: round2(gain_db),
    noise_floor: m.noise_floor,
    duration_s,
    wav: out,
    mp3: mp3 ? mp3Path : null,
    ...(enc ? { mp3_TP: enc.TP, mp3_peak: enc.peak, mp3_limiter_db: enc.limiter_db } : {}),
  };
}

// The quietest 50 ms window, if it is clearly a pause (15 dB under the
// programme); a piece with no pauses has no measurable noise floor (null).
function noiseFloor(m) {
  if (!Number.isFinite(m.trough)) return m.trough === -Infinity ? -Infinity : null;
  return m.trough < m.rms - 15 ? round2(m.trough) : null;
}

// Digital silence in: loudnorm cannot scale it, so nothing is written and the
// gate fails with "silent mix" (QA exit 3) instead of crashing.
function silentResult(m, out, mode) {
  const problems = gateProblems({ rms: m.rms, peak: m.peak }, { mode });
  return { I: -Infinity, TP: -Infinity, LRA: 0, rms: round2(m.rms), peak: round2(m.peak), ok: false, problems, mode, gain_db: 0, noise_floor: null, duration_s: null, wav: null, mp3: null };
}
