import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../lib/ffmpeg.mjs';
import { rmsDb, activeRmsDb, nvMatchGain, NV_HEADROOM_DB } from '../lib/render.mjs';

// A tone of `db` dB peak for `on` seconds, framed by `pad` seconds of silence each side.
async function padded(path, { db, on, pad }) {
  await run(['-filter_complex', `sine=f=300:d=${on},volume=${db}dB,apad=pad_dur=${pad},areverse,apad=pad_dur=${pad},areverse,aformat=sample_fmts=s16:sample_rates=44100:channel_layouts=mono`, '-c:a', 'pcm_s16le', path]);
}

test('activeRmsDb ignores the leading and trailing silence that overall RMS counts', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aa-render-'));
  try {
    const p = join(dir, 'speech.wav');
    await padded(p, { db: -12, on: 1, pad: 1.5 });
    const overall = await rmsDb(p);
    const active = await activeRmsDb(p);
    // ffmpeg's sine is 1/8 full scale (RMS -21.1 dB); -12 dB → -33.1 dB while sounding.
    // A quarter of the clip sounds, so overall RMS is about 6 dB lower.
    assert.ok(Math.abs(active - -33.1) < 0.7, `active ${active}`);
    assert.ok(active - overall > 5, `overall ${overall} vs active ${active}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('activeRmsDb falls back to overall RMS for a clip that is all quiet', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aa-render-'));
  try {
    const p = join(dir, 'quiet.wav');
    await run(['-filter_complex', 'sine=f=300:d=1,volume=-60dB,aformat=sample_fmts=s16:sample_rates=44100:channel_layouts=mono', '-c:a', 'pcm_s16le', p]);
    const active = await activeRmsDb(p);
    assert.ok(Number.isFinite(active));
    assert.ok(Math.abs(active - (await rmsDb(p))) < 0.5);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('activeRmsDb is level-independent: the same clip 12 dB down measures 12 dB lower', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aa-render-'));
  try {
    // A sigh-like clip: a loud middle and a long quiet tail that an absolute floor would cut only when attenuated.
    const make = (p, db) => run(['-filter_complex', `sine=f=300:d=0.5,volume=${db}dB[a];sine=f=300:d=1,volume=${db - 26}dB[b];[a][b]concat=n=2:v=0:a=1,aformat=sample_fmts=s16:sample_rates=44100:channel_layouts=mono`, '-c:a', 'pcm_s16le', p]);
    await make(join(dir, 'a.wav'), 0);
    await make(join(dir, 'b.wav'), -12);
    const [a, b] = [await activeRmsDb(join(dir, 'a.wav')), await activeRmsDb(join(dir, 'b.wav'))];
    assert.ok(Math.abs(a - b - 12) < 0.5, `${a} vs ${b}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('nvMatchGain puts the nonverbal NV_HEADROOM_DB under the speech, clamped to ±12 dB', () => {
  assert.ok(NV_HEADROOM_DB >= 3 && NV_HEADROOM_DB <= 6);
  assert.equal(nvMatchGain(-20, -20), -NV_HEADROOM_DB);
  assert.equal(nvMatchGain(-30, -20), 10 - NV_HEADROOM_DB);
  assert.equal(nvMatchGain(-60, -10), 12);
  assert.equal(nvMatchGain(-5, -40), -12);
  assert.equal(nvMatchGain(NaN, -20), 0);
});
