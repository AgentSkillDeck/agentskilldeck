# Delivery preset tuning (T10)

Date: 2026-10-10. Script: `agentskilldeck-lab/tuning/tune.mjs` (not shipped); raw results in `agentskilldeck-lab/tuning/results.json`.

## Method

- Each preset's lab line (the example line in `library/delivery.md`, tags removed, since nonverbals are spliced and never reach the engine) was rendered on **M3** and **F4** at three speeds: the lab speed from `presets.py`, and ±0.06. Seed 0, `total_steps` 10, Supertonic 3 (supertonic 1.3.1). 84 clips.
- Every clip was transcribed with faster-whisper `base.en` and scored with the production `checkLine` (QA normaliser, tag-word check). A variant was **rejected** if WER > 0.1 or a tag word was heard.
- Measured per clip: words/s over the whole clip (words ÷ clip seconds, the definition the guide's target column uses), words/s over the active span (first to last ASR word), overall RMS and active RMS (silence removed below −45 dB).
- **Rule:** if the lab speed's mean words/s (M3 and F4) was inside the target band, or within 0.05 of it, the lab speed stays. Otherwise the passing variant whose mean words/s was closest to the band was chosen. Only one step (±0.06) was allowed, so no preset moved more than 0.06.
- Phrasing was held at the lab line. Gain and filters were not changed: every clip measured between −27.8 and −23.9 dB RMS before the preset gain, a spread too small to justify re-levelling, and the preset gains are deliberate (hushed −9 dB, angry +3 dB).

## Results

| Preset | Target words/s | Lab speed | Variant | M3 words/s | F4 words/s | Mean | WER M3 / F4 | M3 / F4 RMS dB | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| neutral | 2.6–3.0 | 1.00 | 0.94 | 2.44 | 2.44 | 2.44 | 0.00 / 0.00 | -26.6 / -27.3 |  |
| neutral | 2.6–3.0 | 1.00 | 1.00 (lab) | 2.61 | 2.55 | 2.58 | 0.00 / 0.00 | -26.5 / -26.9 | **chosen** |
| neutral | 2.6–3.0 | 1.00 | 1.06 | 2.80 | 2.73 | 2.77 | 0.00 / 0.00 | -27.1 / -27.5 |  |
| happy | 2.9–3.3 | 1.08 | 1.02 | 2.83 | 2.74 | 2.79 | 0.00 / 0.00 | -24.8 / -26.2 |  |
| happy | 2.9–3.3 | 1.08 | 1.08 (lab) | 3.01 | 2.92 | 2.96 | 0.08 / 0.00 | -24.9 / -25.7 | **chosen** |
| happy | 2.9–3.3 | 1.08 | 1.14 | 3.16 | 3.06 | 3.11 | 0.00 / 0.00 | -25.2 / -26.1 |  |
| excited | 3.2–3.7 | 1.18 | 1.12 | 2.92 | 2.82 | 2.87 | 0.00 / 0.00 | -24.3 / -26.5 |  |
| excited | 3.2–3.7 | 1.18 | 1.18 (lab) | 3.04 | 2.98 | 3.01 | 0.00 / 0.00 | -25.4 / -26.2 |  |
| excited | 3.2–3.7 | 1.18 | 1.24 | 3.22 | 3.10 | 3.16 | 0.00 / 0.00 | -23.9 / -26.7 | **chosen** |
| sad | 2.0–2.5 | 0.85 | 0.79 | 2.59 | 2.52 | 2.56 | 0.00 / 0.00 | -26.2 / -27.4 | **chosen** |
| sad | 2.0–2.5 | 0.85 | 0.85 (lab) | 2.79 | 2.70 | 2.75 | 0.00 / 0.00 | -25.6 / -27.2 |  |
| sad | 2.0–2.5 | 0.85 | 0.91 | 2.96 | 2.92 | 2.94 | 0.00 / 0.00 | -24.9 / -27.1 |  |
| angry | 2.8–3.3 | 1.08 | 1.02 | 3.80 | 3.64 | 3.72 | 0.00 / 0.00 | -26.1 / -25.0 | **chosen** |
| angry | 2.8–3.3 | 1.08 | 1.08 (lab) | 3.98 | 3.86 | 3.92 | 0.00 / 0.00 | -26.6 / -25.0 |  |
| angry | 2.8–3.3 | 1.08 | 1.14 | 4.24 | 4.10 | 4.17 | 0.00 / 0.00 | -26.1 / -24.8 |  |
| scared | 2.9–3.5 | 1.12 | 1.06 | 2.50 | 2.44 | 2.47 | 0.10 / 0.00 | -25.4 / -26.3 |  |
| scared | 2.9–3.5 | 1.12 | 1.12 (lab) | 2.67 | 2.61 | 2.64 | 0.30 / 0.00 | -25.9 / -26.3 | rejected (WER) |
| scared | 2.9–3.5 | 1.12 | 1.18 | 2.80 | 2.73 | 2.77 | 0.10 / 0.00 | -27.8 / -26.4 | **chosen** |
| hushed | 2.3–2.7 | 0.90 | 0.84 | 2.02 | 1.94 | 1.98 | 0.00 / 0.00 | -25.5 / -26.9 |  |
| hushed | 2.3–2.7 | 0.90 | 0.90 (lab) | 2.14 | 2.08 | 2.11 | 0.00 / 0.00 | -25.9 / -26.2 |  |
| hushed | 2.3–2.7 | 0.90 | 0.96 | 2.32 | 2.21 | 2.26 | 0.00 / 0.00 | -26.8 / -25.6 | **chosen** |
| calm | 2.0–2.4 | 0.88 | 0.82 | 2.56 | 2.49 | 2.52 | 0.00 / 0.00 | -26.5 / -26.9 | **chosen** |
| calm | 2.0–2.4 | 0.88 | 0.88 (lab) | 2.74 | 2.67 | 2.71 | 0.00 / 0.00 | -25.8 / -25.4 |  |
| calm | 2.0–2.4 | 0.88 | 0.94 | 2.92 | 2.83 | 2.87 | 0.00 / 0.00 | -26.4 / -25.6 |  |
| surprised | 2.8–3.2 | 1.05 | 0.99 | 2.35 | 2.28 | 2.32 | 0.00 / 0.00 | -25.0 / -26.9 |  |
| surprised | 2.8–3.2 | 1.05 | 1.05 (lab) | 2.52 | 2.43 | 2.48 | 0.00 / 0.00 | -25.9 / -25.8 |  |
| surprised | 2.8–3.2 | 1.05 | 1.11 | 2.66 | 2.56 | 2.61 | 0.00 / 0.00 | -25.6 / -25.0 | **chosen** |
| sarcastic | 2.4–2.8 | 0.94 | 0.88 | 2.61 | 2.51 | 2.56 | 0.00 / 0.00 | -25.4 / -26.2 |  |
| sarcastic | 2.4–2.8 | 0.94 | 0.94 (lab) | 2.79 | 2.68 | 2.74 | 0.00 / 0.00 | -25.7 / -26.6 | **chosen** |
| sarcastic | 2.4–2.8 | 0.94 | 1.00 | 2.96 | 2.87 | 2.91 | 0.00 / 0.00 | -25.4 / -25.7 |  |
| tender | 2.2–2.6 | 0.90 | 0.84 | 2.43 | 2.36 | 2.39 | 0.00 / 0.00 | -26.1 / -26.8 |  |
| tender | 2.2–2.6 | 0.90 | 0.90 (lab) | 2.59 | 2.55 | 2.57 | 0.00 / 0.00 | -27.2 / -26.0 | **chosen** |
| tender | 2.2–2.6 | 0.90 | 0.96 | 2.77 | 2.68 | 2.72 | 0.00 / 0.00 | -27.5 / -25.5 |  |
| tired | 1.9–2.3 | 0.82 | 0.76 | 2.42 | 2.36 | 2.39 | 0.00 / 0.00 | -25.7 / -27.1 | **chosen** |
| tired | 1.9–2.3 | 0.82 | 0.82 (lab) | 2.61 | 2.54 | 2.58 | 0.00 / 0.00 | -27.0 / -27.6 |  |
| tired | 1.9–2.3 | 0.82 | 0.88 | 2.79 | 2.72 | 2.75 | 0.00 / 0.00 | -26.3 / -27.3 |  |
| authoritative | 2.4–2.8 | 0.95 | 0.89 | 2.22 | 2.12 | 2.17 | 0.00 / 0.00 | -26.3 / -27.4 |  |
| authoritative | 2.4–2.8 | 0.95 | 0.95 (lab) | 2.37 | 2.26 | 2.31 | 0.00 / 0.00 | -26.5 / -26.6 |  |
| authoritative | 2.4–2.8 | 0.95 | 1.01 | 2.52 | 2.42 | 2.47 | 0.00 / 0.00 | -26.0 / -26.2 | **chosen** |
| nervous | 2.9–3.4 | 1.10 | 1.04 | 3.64 | 3.49 | 3.56 | 0.05 / 0.05 | -26.3 / -24.7 | **chosen** |
| nervous | 2.9–3.4 | 1.10 | 1.10 (lab) | 3.81 | 3.70 | 3.76 | 0.05 / 0.05 | -25.0 / -24.3 |  |
| nervous | 2.9–3.4 | 1.10 | 1.16 | 4.07 | 3.87 | 3.97 | 0.05 / 0.05 | -25.9 / -25.1 |  |

## Decisions

| Preset | Lab speed | Tuned speed | Why |
|---|---|---|---|
| neutral | 1.00 | 1.00 | lab speed 0.02 under the band; kept (tolerance), it is the reference pace |
| happy | 1.08 | 1.08 | inside the band at the lab speed |
| excited | 1.18 | 1.24 | lab speed under the band; +0.06 brings it to 0.04 under, and WER stayed 0 |
| sad | 0.85 | 0.79 | lab speed well over the band; −0.06 is closer (still 0.06 over) |
| angry | 1.08 | 1.02 | lab speed well over the band; −0.06 is closer. The compressor carries the intensity, not the pace |
| scared | 1.12 | 1.18 | M3 at the lab speed failed QA ("Don't. Move." heard as "Dove"); +0.06 passed on both voices and is closer to the band |
| hushed | 0.90 | 0.96 | lab speed under the band; +0.06 is closer |
| calm | 0.88 | 0.82 | lab speed over the band; −0.06 is closer |
| surprised | 1.05 | 1.11 | lab speed under the band; +0.06 is closer |
| sarcastic | 0.94 | 0.94 | inside the band at the lab speed |
| tender | 0.90 | 0.90 | inside the band at the lab speed |
| tired | 0.82 | 0.76 | lab speed over the band; −0.06 is closer |
| authoritative | 0.95 | 1.01 | lab speed under the band; +0.06 lands in it |
| nervous | 1.10 | 1.04 | lab speed over the band; −0.06 is closer, fillers stay intelligible |

## Findings worth keeping

- Clip words/s depends on the line as much as on the speed: a seven-word line carries the engine's lead-in and tail silence, and every full stop adds a pause. Speeds alone cannot pull angry or nervous into their bands; their lab lines are long and dense. The guide's target column is a writing target, and the measured value per preset is now listed next to it.
- Whisper never transcribed "um" (nervous scored WER 0.053 on every take for exactly that reason). The nervous recipe's "one or two fillers" rule stands.
- `Don't. Move.` on M3 is fragile at 1.12 (heard "Dove" and "Don't..."). Two one-word sentences in a row can be swallowed by the steady voices; the guide now says to prefer `Don't move.` or `Don't... move.` for M3/M5.
- Mean loudness across presets varied by under 4 dB before gain; no gain change was needed.
- Not tested: owner listening ratings. These are measured rates, not taste; the owner's listening pass can still move any preset.

