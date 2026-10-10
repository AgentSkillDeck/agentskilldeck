# Mastering and the QA gate

Every final render passes two gates: per-line transcript QA after synthesis, and a loudness gate after mastering. A failure exits 3 and keeps every output, so the problem can be heard and fixed.

## Line QA (after synthesis)

Each rendered line is transcribed with faster-whisper: `base.en` for English, multilingual `base` for any other language (and for `na`). The transcript is compared with the script text.

A line fails when:
- a tag word is heard that is not in the text ("laugh", "breath", "sigh", "gasp", "sob", "cough", "scream", "giggle", "chuckle", "sneeze", "groan", "yawn"), in any inflection;
- the line carries a native tag (mode `auto`) and a word is inserted where the tag sat, the script word next to it is not heard, or a word the script does not have looks like a tag ("Reth", "So", "aside");
- the word error rate is over **15 %** for English, **30 %** for other languages;
- the transcript is empty.

Before the word error rate is computed, these differences are not counted: punctuation and case; English numbers up to one hundred and four-digit years (expanded to words); "Dr.", "Mr.", "Mrs.", "Prof." against the spelled-out title; British against American spelling (favourite, realise); a compound split differently (good night, goodnight); and a near-miss spelling of a capitalised name from the script ("Stomford" for Stamford). When a non-English transcript comes back in another alphabet than the script (whisper `base` often writes Hindi in Urdu script), the word error rate is not scored and `qa.json` carries a note with what was heard; the tag checks still apply, and the line should be checked by ear.

A failed line is re-rendered with seeds 1, 2 and 3 (`--takes 4` by default: four takes in total). Each take is its own file. The best passing take is kept (lowest WER among the takes that pass); if none passes, the lowest-WER take is used, the line is flagged in `qa.json` and the run exits 3. Word timestamps for captions come from this pass.

Fixing a line that keeps failing:
- **High WER on a name or term:** rephrase, or respell for that line (see [writing-for-the-ear](writing-for-the-ear.md)).
- **Digits or symbols in the text:** write them as words.
- **Very short lines** ("No.", "Right?"): one misheard word is 100 % WER. Join it to the next sentence of the same speaker, or accept the flag after listening.
- **Speed too high:** the stacked speed over about 1.25 hurts intelligibility; drop a `fast` modifier or the cast speed.
- **Non-English line marked English:** add `lang:` to the line or cast entry.

`--no-qa` skips this pass for drafts. Finals always run it.

## Loudness (after mixing)

| Mode | Presets | Method | Gate |
|---|---|---|---|
| LUFS | all except audiobook | two-pass EBU R128 `loudnorm` (measure, then linear apply) and a true-peak limiter at target − 0.3 dB | integrated loudness within ±1 LU of target; true peak ≤ target + 0.1 dB |
| ACX | audiobook | gain to −20 dB RMS, limiter at −3.5 dBFS | RMS −23…−18 dB; sample peak ≤ −3 dBFS; noise floor ≤ −60 dB RMS |

Targets: −16 LUFS / −1 dBTP for education, drama, podcast, playbook, kids and language; −14 LUFS for ad and video; −20 LUFS for meditation.

Both modes also fail on:
- **clipping:** a sample peak at 0 dBFS;
- **dead air:** any silence (below −50 dB) longer than 4 s that a `[pause N]` did not ask for. The head and tail are exempt.

Outputs: `mix.wav` (44.1 kHz, 16-bit) and `mix.mp3` (VBR quality 2; ACX gets constant 192 kbps). The measured values (I, TP, LRA, RMS, peak, gain applied) go into `qa.json` under `mastering`.

## Reading `qa.json`

```json
{ "ok": false,
  "summary": { "total": 24, "failed": 1, "avg_wer": 0.04 },
  "lines": [ { "id": "L14-0", "ok": false, "wer": 0.33, "problems": ["wer 0.33 exceeds 0.15"] } ],
  "mastering": { "I": -16.2, "TP": -1.4, "ok": true, "problems": [] } }
```

Report the numbers to the user as they are. Never call a piece "broadcast-ready" or "ACX-compliant" when `ok` is false or the gate was skipped.

## When the loudness gate fails

| Problem | Likely cause | Fix |
|---|---|---|
| Integrated loudness outside ±1 LU | very short piece, or long silences pulling the average down | add ambience under long pauses; for pieces under 10 s, accept and report it |
| True peak over target | loud SFX hits | `\| low` on the SFX cue |
| ACX RMS too low | many long pauses | shorten pauses |
| ACX noise floor above −60 dB | a noisy local sound file, or ambience added to an audiobook | remove ambience and SFX; ACX expects voice over clean room tone only |
| Silence gap over 4 s | a gap that is not a `[pause]` (an unresolved cue, a missing sound) | write it as `[pause N]` or add ambience; check `qa.json` warnings for skipped sounds |
