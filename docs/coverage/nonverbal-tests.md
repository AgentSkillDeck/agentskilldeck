# Nonverbal tag tests (lab measurements)

The measurements behind `plugins/audio/library/nonverbal.md` and the shipped native-tag table (`tools/assets/native-tags.json`). The lab scripts and raw clips are not shipped; these are the summary tables.

## 1. Every tag form (spec §2.1)

Lab test (spec §2.1): every tag form in a real sentence, 12 takes (3 voices × 4 seeds), transcribed with faster-whisper.

| Input to the engine | Result |
|---|---|
| `[laugh]`, `(sigh)`, `(breath)`, `<breath/>` | **spoken as a word**, every time. The preprocessor turns `[ ] \| / # _` into spaces, so `[laugh]` becomes the word "laugh". |
| `<gasp> <sniff> <scream> <whisper> <chuckle> <giggle> <clear_throat>` | **spoken as a word** (unknown tags) |
| `<cry> <cough> <yawn> <groan> <hmm> <sob>` | not spoken, but no reliable sound either; treat as unsupported |
| `<laugh>` | never spoken (0/12 at the start, mid-line or after punctuation) |
| `<breath>` | spoken as a word in 11/12 at the start of a line, 6/12 after punctuation, 4/12 after a lead word |
| `<sigh>` | 0–2/12, but in real lines sometimes heard as "Si" or "side" |
| a tag glued to a word (`worked<breath>`) | spoken |

## 2. Inline laugh and sigh with the production QA (T10)

Second test (T10, the default `auto` mode): six real lines with `<laugh>` or `<sigh>` at the start, middle and end, on M3 and F4, four seeds each (48 takes), checked by the production QA:

| Tag | Heard as the literal word | Take failed QA | Line needed the sample fallback (4 takes) |
|---|---|---|---|
| `<laugh>` | 0/24 | 0/24 | 0/6 |
| `<sigh>` | 0/24 | 11/24: voiced as a short word ("it's a", "so", "si", "sorry") | 0/6 (2/6 failed their first take) |

## 3. Single tags and stacks (10 documented tags, 3 voices × 3 seeds)

A single tag is effectively silent (about 0.1 s of sound); three in a row add 0.3–0.75 s. Spoken at a stack of three: sigh 1/2, breath 1/2, groan 1/2; cough, yawn and hmm 0/2. clear-throat (9/9), sniff (8/9) and sneeze (5/9) are spoken, so they are never sent.

Owner listening (T10, stacks of three on M3 and F4):

| Tag | M3 | F4 |
|---|---|---|
| `<laugh>` | works | works |
| `<sigh>` | spoken | spoken |
| `<cough>` | spoken | works |
| `<breath>` | works | spoken |
| `<yawn>` | spoken | spoken |
| `<groan>` | works | spoken |

## 4. Placement

Placement test (2026-10-11, `agentskilldeck-lab/placement`): six tags × five positions (line start, after a period, after a comma, mid-line without punctuation, line end) × three spacings (spaced, joined `<laugh><laugh><laugh>`, glued to a word) on M3 and F4, scored by the QA insertion check:

| Tag | Clean takes |
|---|---|
| `<laugh>` | 28/28, every position and spacing |
| `<hmm>` | 18/28 |
| `<cough>` | 17/28 |
| `<breath>` | 16/28 |
| `<groan>` | 6/28 |
| `<yawn>` | 2/28 |

Joined stacks scored best overall (58% clean against 47% spaced). Decision: the laugh is the only native tag, sent joined, in any position; every other nonverbal is a sample.

## 5. Calibration (2026-10-11)

`calibrate.mjs`, joined laugh stack, two positions × 4 seeds: 8/8 clean on every voice, F1–F5 and M1–M5.
