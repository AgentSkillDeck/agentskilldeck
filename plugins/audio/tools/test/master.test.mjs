import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { master, parseLoudnormJson, parseAstats, parseSilences, gateProblems, mp3TrimDb, encodeMp3 } from '../lib/master.mjs';
import { run, hasFfmpeg } from '../lib/ffmpeg.mjs';

const HAVE_FFMPEG = await hasFfmpeg();
const SKIP = HAVE_FFMPEG ? false : 'ffmpeg not found (install ffmpeg or set AGENTATELIER_FFMPEG) - skipping real-audio test';

async function tone(path, { d = 8, db = 0 } = {}) {
  await run(['-filter_complex', `sine=f=440:d=${d},volume=${db}dB,aformat=sample_fmts=s16:sample_rates=44100:channel_layouts=stereo`, '-c:a', 'pcm_s16le', path]);
  return path;
}

test('parsers read loudnorm JSON, astats overall and silencedetect from stderr', () => {
  const stderr = [
    '[Parsed_astats_0 @ 0x1] Channel: 1',
    '[Parsed_astats_0 @ 0x1] RMS level dB: -30.000000',
    '[Parsed_astats_0 @ 0x1] Overall',
    '[Parsed_astats_0 @ 0x1] Peak level dB: -17.500000',
    '[Parsed_astats_0 @ 0x1] RMS level dB: -21.000000',
    '[Parsed_astats_0 @ 0x1] RMS through dB: -48.500000',
    '[silencedetect @ 0x2] silence_start: 3.5',
    '[silencedetect @ 0x2] silence_end: 9.25 | silence_duration: 5.75',
    '[Parsed_loudnorm_2 @ 0x3] ',
    '{',
    '\t"input_i" : "-23.10",',
    '\t"input_tp" : "-5.02",',
    '\t"input_lra" : "1.20",',
    '\t"input_thresh" : "-33.40",',
    '\t"target_offset" : "0.10"',
    '}',
  ].join('\n');
  assert.deepEqual(parseAstats(stderr), { rms: -21, peak: -17.5, trough: -48.5 });
  assert.equal(parseLoudnormJson(stderr).input_i, '-23.10');
  assert.deepEqual(parseSilences(stderr), [{ start: 3.5, end: 9.25 }]);
});

test('gateProblems flags loudness, true peak, clipping, ACX ranges and long silences', () => {
  const lufs = { mode: 'lufs', I: -16, TP: -1 };
  assert.deepEqual(gateProblems({ I: -16.4, TP: -1.2, rms: -19, peak: -1.3, silences: [] }, lufs, { duration_s: 30 }), []);
  const p = gateProblems({ I: -18.5, TP: 0.2, rms: -19, peak: 0, silences: [{ start: 10, end: 16 }] }, lufs, { duration_s: 30 });
  assert.equal(p.length, 4, p.join('\n'));
  assert.deepEqual(gateProblems({ I: -16, TP: -1, rms: -19, peak: -2, silences: [{ start: 10, end: 16 }] }, lufs, { duration_s: 30, allowSilence: [{ start: 10, end: 16 }] }), []);
  // Leading/trailing room tone is not a gap.
  assert.deepEqual(gateProblems({ I: -16, TP: -1, rms: -19, peak: -2, silences: [{ start: 25, end: 30 }] }, lufs, { duration_s: 30 }), []);
  const acx = { mode: 'acx', rms_min: -23, rms_max: -18, peak_max: -3 };
  assert.equal(gateProblems({ rms: -25, peak: -2, silences: [] }, acx, { duration_s: 30 }).length, 2);
});

test('LUFS mastering of a sine lands within ±1 LU of -16 and writes wav + mp3', { skip: SKIP, timeout: 60000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aa master '));
  try {
    const src = await tone(join(dir, 'in.wav'), { db: -12 });
    const res = await master(src, join(dir, 'mix.wav'), { mode: 'lufs', I: -16, TP: -1 });
    assert.ok(Math.abs(res.I - -16) <= 1, `measured ${res.I} LUFS`);
    assert.ok(res.TP <= -0.9, `true peak ${res.TP}`);
    assert.equal(res.ok, true, res.problems.join('\n'));
    assert.ok((await stat(join(dir, 'mix.mp3'))).size > 1000);
    assert.ok((await stat(join(dir, 'mix.wav'))).size > 1000);
    for (const k of ['I', 'TP', 'LRA', 'rms', 'peak']) assert.equal(typeof res[k], 'number', k);
    assert.equal(typeof res.mp3_TP, 'number', 'the mp3 is measured too');
    assert.ok(res.mp3_TP <= -0.9, `mp3 true peak ${res.mp3_TP}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('ACX mastering of a quiet tone passes after gain', { skip: SKIP, timeout: 60000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aa acx '));
  try {
    const src = await tone(join(dir, 'quiet.wav'), { db: -30 });
    const res = await master(src, join(dir, 'book.wav'), { mode: 'acx', rms_min: -23, rms_max: -18, peak_max: -3 });
    assert.ok(res.rms >= -23 && res.rms <= -18, `rms ${res.rms}`);
    assert.ok(res.peak <= -3, `peak ${res.peak}`);
    assert.equal(res.ok, true, res.problems.join('\n'));
    assert.ok((await stat(join(dir, 'book.mp3'))).size > 1000);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('gate: a silent mix and an ACX noise floor above -60 dB are problems', () => {
  const lufs = { mode: 'lufs', I: -16, TP: -1 };
  assert.match(gateProblems({ I: -Infinity, TP: -Infinity, rms: -Infinity, peak: -Infinity, silences: [] }, lufs, { duration_s: 5 })[0], /^silent mix/);
  const acx = { mode: 'acx', rms_min: -23, rms_max: -18, peak_max: -3 };
  assert.deepEqual(gateProblems({ rms: -20, peak: -4, noise_floor: -65, silences: [] }, acx, { duration_s: 30 }), []);
  assert.match(gateProblems({ rms: -20, peak: -4, noise_floor: -52, silences: [] }, acx, { duration_s: 30 })[0], /noise floor -52 dB above ACX limit -60 dB/);
});

test('master on digital silence fails the gate with "silent mix" instead of crashing', { skip: SKIP }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aa master silent '));
  try {
    const input = join(dir, 'silence.wav');
    await run(['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '3', '-c:a', 'pcm_s16le', input]);
    const r = await master(input, join(dir, 'out.wav'), { mode: 'lufs', I: -16, TP: -1 });
    assert.equal(r.ok, false);
    assert.match(r.problems[0], /^silent mix/);
    const a = await master(input, join(dir, 'acx.wav'), { mode: 'acx', rms_min: -23, rms_max: -18, peak_max: -3 });
    assert.equal(a.ok, false);
    assert.match(a.problems[0], /^silent mix/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('mp3TrimDb: an encode that overshoots the true-peak target is turned down by the overshoot plus a margin', () => {
  assert.equal(mp3TrimDb(-1.3, -1), 0, 'under the target: unchanged');
  assert.equal(mp3TrimDb(-1.0, -1), 0, 'at the target (with tolerance): unchanged');
  assert.equal(mp3TrimDb(-0.8, -1), -0.4);
  assert.equal(mp3TrimDb(0, -1), -1.2);
  assert.equal(mp3TrimDb(-2.5, -3), -0.7, 'ACX peak limit');
});

test('an MP3 encode that overshoots the true-peak limit is re-encoded through a limiter', { skip: SKIP, timeout: 120000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aa mp3peak '));
  try {
    // Sparse square bursts over a quiet tone: mastering pushes their peaks to
    // -1 dBTP, and a 48 kbps MP3 rings over that.
    const src = join(dir, 'bursts.wav');
    await run(['-filter_complex', "aevalsrc='0.004*sin(2*PI*220*t)+0.9*lt(mod(t\\,1)\\,0.006)*sgn(sin(2*PI*5000*t))':d=8:s=44100,aformat=sample_fmts=s16:channel_layouts=stereo", '-c:a', 'pcm_s16le', src]);
    const wav = join(dir, 'mix.wav');
    const res = await master(src, wav, { mode: 'lufs', I: -16, TP: -1 });
    const enc = await encodeMp3(wav, join(dir, 'low.mp3'), { mode: 'lufs', I: -16, TP: -1 }, { rate: ['-b:a', '48k'] });
    assert.ok(enc.TP <= -0.9, `mp3 true peak ${enc.TP}`);
    assert.equal(typeof res.mp3_TP, 'number');
    assert.ok(enc.limiter_db !== null && enc.limiter_db < -1, `the limiter was needed and sits under the limit (${enc.limiter_db})`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
