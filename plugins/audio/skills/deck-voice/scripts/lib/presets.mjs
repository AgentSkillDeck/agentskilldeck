// Domain presets (spec §5) and delivery/emotion presets (spec §6).
//
// Supertonic has no emotion parameter (spec §2.1): delivery presets carry
// emotion through speed, gain and an ffmpeg filter chain, tuned from the
// owner's ratings in the lab measurements (docs/coverage/delivery-tuning.md).
// Honest labelling: "delivery presets", not "emotional TTS".

// Values come straight from spec §5's table. Where the table only gives a
// qualitative note (e.g. "upbeat", "ambience") rather than the concrete
// duck_db/lead_s/tail_s/captions values the planner needs, a reasonable
// default is chosen below; see the Task 3 report for the exact mapping.
export const DOMAIN_PRESETS = {
  education: {
    speed: 1.0, gap_s: 0.5, lead_s: 0.5, tail_s: 1.0,
    music: 'bed', duck_db: -12,
    loudness: { mode: 'lufs', I: -16, TP: -1 },
    captions: true,
  },
  audiobook: {
    speed: 0.95, gap_s: 0.6, lead_s: 0.5, tail_s: 1.0,
    music: 'none', duck_db: 0,
    loudness: { mode: 'acx', rms_min: -23, rms_max: -18, peak_max: -3 },
    captions: false,
    room_tone: { head_s: 0.75, tail_s: 2 },
  },
  drama: {
    speed: 1.0, gap_s: 0.25, lead_s: 0.5, tail_s: 1.0,
    music: 'scored', duck_db: -12,
    loudness: { mode: 'lufs', I: -16, TP: -1 },
    captions: true,
  },
  podcast: {
    speed: 1.03, gap_s: 0.3, lead_s: 0.3, tail_s: 0.5,
    music: 'stinger', duck_db: -12,
    loudness: { mode: 'lufs', I: -16, TP: -1 },
    captions: true,
  },
  playbook: {
    speed: 0.95, gap_s: 0.7, lead_s: 0.5, tail_s: 1.0,
    music: 'none', duck_db: 0,
    loudness: { mode: 'lufs', I: -16, TP: -1 },
    captions: true,
  },
  ad: {
    speed: 1.1, gap_s: 0.2, lead_s: 0.2, tail_s: 0.3,
    music: 'bed', duck_db: -10,
    loudness: { mode: 'lufs', I: -14, TP: -1 },
    captions: true,
  },
  meditation: {
    speed: 0.82, gap_s: 1.2, lead_s: 1.0, tail_s: 2.0,
    music: 'bed', duck_db: -14,
    loudness: { mode: 'lufs', I: -20, TP: -1 },
    captions: false,
  },
  kids: {
    speed: 0.92, gap_s: 0.5, lead_s: 0.5, tail_s: 1.0,
    music: 'bed', duck_db: -12,
    loudness: { mode: 'lufs', I: -16, TP: -1 },
    captions: true,
  },
  language: {
    speed: 0.8, gap_s: 1.0, lead_s: 0.5, tail_s: 1.0,
    music: 'none', duck_db: 0,
    loudness: { mode: 'lufs', I: -16, TP: -1 },
    captions: true,
  },
  video: {
    speed: 1.0, gap_s: 0.45, lead_s: 0.3, tail_s: 0.5,
    music: 'bed', duck_db: -12,
    loudness: { mode: 'lufs', I: -14, TP: -1 },
    captions: true,
  },
};

// Gain/fx from the lab measurements (docs/coverage/delivery-tuning.md). Speeds were
// re-tuned in T10: each lab line rendered at the lab speed and ±0.06 on M3 and
// F4, transcribed (WER ≤ 0.1, no spoken tag), and the variant whose words/s
// sat in the target band kept (docs/coverage/delivery-tuning.md).
// pre_s/post_s (pause around the line) were added in T3. Nonverbals
// are never injected by a preset: the writer places <laugh>/<breath>/<sigh>
// where the line needs one (the guides suggest which emotions pair with which).
export const DELIVERY_PRESETS = {
  neutral: { speed: 1.00, gain_db: 0, af: '', pre_s: 0.1, post_s: 0.1 },
  happy: { speed: 1.08, gain_db: 1, af: '', pre_s: 0.05, post_s: 0.1 },
  excited: { speed: 1.24, gain_db: 2, af: '', pre_s: 0.05, post_s: 0.1 },
  sad: { speed: 0.79, gain_db: -3, af: 'lowpass=f=6500', pre_s: 0.2, post_s: 0.3 },
  angry: { speed: 1.02, gain_db: 3, af: 'acompressor=threshold=-18dB:ratio=4', pre_s: 0.05, post_s: 0.1 },
  scared: { speed: 1.18, gain_db: -1, af: '', pre_s: 0.1, post_s: 0.1 },
  hushed: { speed: 0.96, gain_db: -9, af: 'highpass=f=250,lowpass=f=5000', pre_s: 0.2, post_s: 0.2 },
  calm: { speed: 0.82, gain_db: -2, af: '', pre_s: 0.2, post_s: 0.3 },
  surprised: { speed: 1.11, gain_db: 1, af: '', pre_s: 0.05, post_s: 0.1 },
  sarcastic: { speed: 0.94, gain_db: 0, af: '', pre_s: 0.1, post_s: 0.15 },
  tender: { speed: 0.90, gain_db: -3, af: 'lowpass=f=8000', pre_s: 0.2, post_s: 0.3 },
  tired: { speed: 0.76, gain_db: -3, af: '', pre_s: 0.2, post_s: 0.3 },
  authoritative: { speed: 1.01, gain_db: 1, af: '', pre_s: 0.1, post_s: 0.15 },
  nervous: { speed: 1.04, gain_db: -1, af: '', pre_s: 0.05, post_s: 0.1 },
};

export const EMOTION_NAMES = Object.keys(DELIVERY_PRESETS);

// Modifiers (spec §4): "(emotion, slow)" etc.
export const MODIFIERS = {
  slow: { speed: 0.9 },
  fast: { speed: 1.1 },
  loud: { gain_db: 3 },
  soft: { gain_db: -4 },
};

export const SPEED_MIN = 0.7;
export const SPEED_MAX = 2.0;

export function clampSpeed(speed) {
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, speed));
}
