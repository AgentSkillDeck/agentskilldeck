import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOMAIN_PRESETS, DELIVERY_PRESETS, EMOTION_NAMES, MODIFIERS, clampSpeed } from '../lib/presets.mjs';

const DOMAIN_KEYS = ['education', 'audiobook', 'drama', 'podcast', 'playbook', 'ad', 'meditation', 'kids', 'language', 'video'];
const EMOTION_KEYS = ['neutral', 'happy', 'excited', 'sad', 'angry', 'scared', 'hushed', 'calm', 'surprised', 'sarcastic', 'tender', 'tired', 'authoritative', 'nervous'];

test('DOMAIN_PRESETS has exactly the 10 spec §5 keys, each shaped correctly', () => {
  assert.deepEqual(Object.keys(DOMAIN_PRESETS).sort(), [...DOMAIN_KEYS].sort());
  for (const key of DOMAIN_KEYS) {
    const p = DOMAIN_PRESETS[key];
    assert.equal(typeof p.speed, 'number');
    assert.equal(typeof p.gap_s, 'number');
    assert.equal(typeof p.lead_s, 'number');
    assert.equal(typeof p.tail_s, 'number');
    assert.ok(['none', 'bed', 'scored', 'stinger'].includes(p.music));
    assert.equal(typeof p.duck_db, 'number');
    assert.ok(p.loudness.mode === 'lufs' || p.loudness.mode === 'acx');
    assert.equal(typeof p.captions, 'boolean');
  }
});

test('drama.gap_s is 0.25 per spec', () => {
  assert.equal(DOMAIN_PRESETS.drama.gap_s, 0.25);
});

test('audiobook.loudness matches the ACX numbers from spec §5', () => {
  assert.deepEqual(DOMAIN_PRESETS.audiobook.loudness, { mode: 'acx', rms_min: -23, rms_max: -18, peak_max: -3 });
});

test('audiobook has a room_tone head/tail shape', () => {
  assert.ok(DOMAIN_PRESETS.audiobook.room_tone);
  assert.equal(typeof DOMAIN_PRESETS.audiobook.room_tone.head_s, 'number');
  assert.equal(typeof DOMAIN_PRESETS.audiobook.room_tone.tail_s, 'number');
});

test('DELIVERY_PRESETS has exactly the 14 spec §6 emotions, each shaped correctly', () => {
  assert.deepEqual(Object.keys(DELIVERY_PRESETS).sort(), [...EMOTION_KEYS].sort());
  assert.deepEqual(EMOTION_NAMES.sort(), [...EMOTION_KEYS].sort());
  for (const key of EMOTION_KEYS) {
    const p = DELIVERY_PRESETS[key];
    assert.equal(typeof p.speed, 'number');
    assert.equal(typeof p.gain_db, 'number');
    assert.equal(typeof p.af, 'string');
    assert.equal(typeof p.pre_s, 'number');
    assert.equal(typeof p.post_s, 'number');
  }
});

test('delivery speeds/gains/fx match the lab emotion presets (docs/coverage/delivery-tuning.md)', () => {
  assert.deepEqual(DELIVERY_PRESETS.neutral, { speed: 1.00, gain_db: 0, af: '', pre_s: 0.1, post_s: 0.1 });
  assert.equal(DELIVERY_PRESETS.sad.af, 'lowpass=f=6500');
  assert.equal(DELIVERY_PRESETS.angry.af, 'acompressor=threshold=-18dB:ratio=4');
  assert.equal(DELIVERY_PRESETS.tender.af, 'lowpass=f=8000');
});

test('hushed uses gain -9 with highpass=f=250,lowpass=f=5000', () => {
  assert.equal(DELIVERY_PRESETS.hushed.gain_db, -9);
  assert.equal(DELIVERY_PRESETS.hushed.af, 'highpass=f=250,lowpass=f=5000');
});

test('MODIFIERS: slow x0.9, fast x1.1, loud +3dB, soft -4dB', () => {
  assert.equal(MODIFIERS.slow.speed, 0.9);
  assert.equal(MODIFIERS.fast.speed, 1.1);
  assert.equal(MODIFIERS.loud.gain_db, 3);
  assert.equal(MODIFIERS.soft.gain_db, -4);
});

test('clampSpeed clamps to 0.7..2.0', () => {
  assert.equal(clampSpeed(0.5), 0.7);
  assert.equal(clampSpeed(3), 2.0);
  assert.equal(clampSpeed(1.2), 1.2);
});

test('delivery speeds are the T10 tuned values (docs/coverage/delivery-tuning.md)', () => {
  const tuned = { neutral: 1.00, happy: 1.08, excited: 1.24, sad: 0.79, angry: 1.02, scared: 1.18, hushed: 0.96, calm: 0.82, surprised: 1.11, sarcastic: 0.94, tender: 0.90, tired: 0.76, authoritative: 1.01, nervous: 1.04 };
  for (const [k, v] of Object.entries(tuned)) assert.equal(DELIVERY_PRESETS[k].speed, v, k);
});
