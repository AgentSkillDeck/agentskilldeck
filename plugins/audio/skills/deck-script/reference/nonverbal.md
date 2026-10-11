# Nonverbals: laughs, breaths, sighs and the spoken-tag bug

A well-placed breath or laugh is what makes synthetic speech sound performed. Supertonic performs exactly one of them reliably in the speaker's own voice: a laugh, sent as a stack of joined `<laugh>` tags. Its other tags come out as words often enough that the pipeline splices a recording instead, and the obvious markup (`[laugh]`, `(sigh)`) makes it worse: it reads the tag aloud. This guide states what was measured, what the pipeline does about it, and how to write nonverbals that work.

## The bug, measured

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

Even the tags that work add only about 0–0.3 s of sound, but it is the speaker's own voice, which a spliced recording can never be.

Second test (T10, the default `auto` mode): six real lines with `<laugh>` or `<sigh>` at the start, middle and end, on M3 and F4, four seeds each (48 takes), checked by the production QA:

| Tag | Heard as the literal word | Take failed QA | Line needed the sample fallback (4 takes) |
|---|---|---|---|
| `<laugh>` | 0/24 | 0/24 | 0/6 |
| `<sigh>` | 0/24 | 11/24: voiced as a short word ("it's a", "so", "si", "sorry") | 0/6 (2/6 failed their first take) |

So `<laugh>` is safe inline. `<sigh>` looked safe with QA behind it, but the owner's listening test of the stacked form (below) heard the word, so a sigh is now always a sample.

Third test (lab measurements, `docs/coverage/nonverbal-tests.md`): the tags Supertonic documents, 3 voices × 3 seeds. **A single tag is effectively silent** (about 0.1 s of sound); three in a row add 0.3–0.75 s. So a native tag is always sent as a stack.

Owner listening (T10, stacks of three on M3 and F4):

| Tag | M3 | F4 |
|---|---|---|
| `<laugh>` | works | works |
| `<sigh>` | spoken | spoken |
| `<cough>` | spoken | works |
| `<breath>` | works | spoken |
| `<yawn>` | spoken | spoken |
| `<groan>` | works | spoken |

Placement test (2026-10-11, lab measurements in `docs/coverage/nonverbal-tests.md`): six tags × five positions (line start, after a period, after a comma, mid-line without punctuation, line end) × three spacings (spaced, joined `<laugh><laugh><laugh>`, glued to a word) on M3 and F4, scored by the QA insertion check:

| Tag | Clean takes |
|---|---|
| `<laugh>` | 28/28, every position and spacing |
| `<hmm>` | 18/28 |
| `<cough>` | 17/28 |
| `<breath>` | 16/28 |
| `<groan>` | 6/28 |
| `<yawn>` | 2/28 |

Joined stacks scored best overall (58% clean against 47% spaced). The decision: **the laugh is the only native tag**, sent joined, in any position; every other nonverbal is a sample for every voice, in every mode.

| You write | Engine gets / mix gets |
|---|---|
| `<laugh>` (any size) | 2, 3 or 4 joined `<laugh>` tags (below) |
| `<sigh>`, `<breath>`, `<gasp>`, `<sob>`, `<cough>`, `<scream>` | the bundled clip for the voice's gender |
| `<yawn>`, `<groan>` | the sigh clip |
| `<hmm>` | a 0.4 s pause |
| `<clear-throat>` (also `<clear_throat>`, `(clears throat)`), `<sneeze>` | the cough clip (sneeze with a warning) |
| `<sniff>` | the sob clip |

## The native-tag table

The decision lives in `tools/assets/native-tags.json`, not in code: one row per voice and tag, plus `owner_overrides` that always win (first for the voice, then for every voice, `"*"`). The shipped table allows the laugh (calibrated 2026-10-11: 8/8 clean takes on each of F1–F5 and M1–M5; confirmed by ear on M3 and F4) and marks every other tag `ok: false` ("placement test 2026-10-11"). A clone voice (`clone:<name>`) uses its base voice's row: the `base` in `~/.agentskilldeck/voices/<name>/voice.json`, or the voice after `@` in `clone:<name>@F2`. A recorded line (`voice: record`) never sends tags: the speaker performs them.

`calibrate.mjs` writes the rows: each tag as a joined stack in two positions × 4 seeds per voice, checked by the production QA; `ok` only if every take passes. By default it measures the laugh only:

```sh
node scripts/calibrate.mjs                                  # laugh, all voices, 4 seeds
node scripts/calibrate.mjs --voices M3,F4 --tags cough --seeds 6   # re-measure another tag after an engine upgrade
```

It rewrites the rows it measured and keeps everything else, including the overrides; to let a re-measured tag through, remove its `"*"` override after listening. `AGENTSKILLDECK_NATIVE_TAGS=<file>` points the tools at another table. QA hears less than a listener (a stacked sigh passed the transcript check on M3 while the owner heard the word), so a new `ok` from calibration alone deserves a listen.

## Laugh size

Owner listening (T10): one native `<laugh>` produces no audible laugh; three in a row do (about 0.55 s more laughter on M3 and F4; spaced and joined tags sound the same). A written laugh is sent as a joined stack, and you choose its size:

| You write | Size | Engine gets |
|---|---|---|
| `<laugh:1>`, `(chuckles)`, `(giggles)`, `(laughs softly)` | small | 2 × `<laugh>` |
| `<laugh>`, `<laugh:2>`, `(laughs)` | normal | 3 × `<laugh>` |
| `<laugh:3>`, `(laughs hard)`, `(bursts out laughing)`, `[laughter]` | big | 4 × `<laugh>` |

Numbers outside 1–3 are clamped. `model` mode stacks laughs the same way. In `sample` mode the size is ignored: one recorded clip plays.

## What the pipeline does

1. **Normalise.** `[laugh]`, `(laughs)`, `*laughs*`, `<laugh/>`, `<LAUGH>` all become `<laugh>`. Stage directions written the way screenwriters write them map to the nearest supported tag too: `(sighs heavily)` becomes `<sigh>`, `[laughs softly]`, `*laughing*` and `[laughter]` become `<laugh>`, `(breathing)` becomes `<breath>`. Aliases: `chuckle` and `giggle` become `laugh`; `sniff` and `cry` become `sob`; `inhale` becomes `breath`; `clear-throat` and `sneeze` become a cough sample. Any other bracketed stage direction (`<whisper>`, `(pause)`, `[looks away]`, `*really*`) is **removed** with a warning in the plan. It is never spoken.
2. **Native laugh (mode `auto`, the default).** A laugh stays in the text as a joined stack and the engine performs it in the speaker's own voice (any tag the native-tag table allows for that voice is treated the same way). QA fails a take if the transcript has the tag word in any form, if any word is inserted where the tag sat (between the script words either side of it: "Reth" for a breath, "So", "S.I." or "aside" for a sigh), if the script word right before or after the tag is not heard (the laugh swallowed it), or if a word the script does not have looks like a tag (`reth`, `bref`, `sai`, `laf`, `cof`, `yon`...). A laugh heard as "ha ha" and a hmm heard as "hmm" are allowed at their tag. A failed take is re-rendered with the next seed. If every take of the line still fails, that line alone is re-planned with the tag spliced from the sample pack, re-rendered, and marked `nv_fallback: true` in `qa.json`.
3. **Split and splice** (every other tag, and every tag in mode `sample`). The line is cut at every tag. Each text piece is synthesised on its own, so the engine only ever sees plain words. A recorded clip goes in the gap, chosen by the speaker's voice: M voices get the male clip, F voices the female clip. Its level is matched to the speech of the same line: both are measured with silence removed, and the clip is set 4.5 dB under the words (at most ±12 dB of correction), then takes the line's delivery gain and filter. Nonverbals only appear where you write them; no delivery preset adds one.
4. **Last gate.** Before the worker runs, the engine bridge rejects any text containing `[ ] ( ) * / | # _`, any tag that is not free-standing and allowed for that voice by the table (in stacks no longer than `NATIVE_STACK` allows), or a stray `>`. A leak is a bug and fails loudly; it never becomes audio.
5. **Listen for leaks.** QA transcribes every line. If "laugh", "breath", "sigh", "gasp", "sob", "cough", "scream", "giggle" or "chuckle" is heard and is not in the script text, the line fails and is re-rendered with a new seed.

Supported tags: `<laugh> <breath> <sigh> <gasp> <sob> <cough> <scream> <yawn> <hmm> <groan>`.

## Modes (front matter `nonverbals:`)

| Mode | What fills the gap | Use when |
|---|---|---|
| `auto` (default) | `<laugh>`: the engine's own, a joined stack in the speaker's voice, with the sample fallback above. Every other tag: a bundled sample | almost always: the laugh matches the voice |
| `sample` | every tag is a bundled CC0 recording, up to 1.5 s, normalised to about −20 dBFS RMS | you want a bigger, clearly audible laugh or sigh than the engine's |
| `model` | only `<laugh>` may stay inline; every other tag is spliced (the same as `auto` with the shipped table) | you have allowed other tags in the native-tag table and want the laugh only |
| `pause` | 0.4 s of silence | formal narration, playbooks, or when a sample sounds wrong for the character |

## Sound sources for nonverbals

The bundled pack (`tools/assets/nonverbal/`) has two clips per tag per gender: 28 files, all CC0 or Public Domain Mark, each re-checked at the source, trimmed to ≤ 1.5 s, mono 64 kbps, credited in `CREDITS.json`. If a clip is missing and the render is online, the pipeline searches the licensed sources, Openverse first, for "`<gender> <tag>`" (CC0/CC BY, at most 4 s) and downloads it with a license sidecar. Offline with no clip, the nonverbal becomes a pause and `qa.json` says so.

## Writing nonverbals that work

- **At most one per 30 seconds per voice. Never two in a row.** Real people breathe constantly, but audible breaths are punctuation; too many sound like a stock library.
- **Put them where a person would.** A breath before a frightened question or a turn in an argument. A laugh after a light line, not before the joke. A sigh at the start of a sad or tired line. A gasp before a surprise lands.
- **Always separate tags with spaces.** `did it. <laugh> I can't` is right; `did it<laugh>` is wrong.
- **Start-of-line placement is safest.** `ELI (scared): <breath> Did you hear that?` splices the breath, then the line's pre-pause, then speech.
- **Match the emotion.** happy and `<laugh>`, sad or tired and `<sigh>`, scared or surprised and `<breath>` or `<gasp>`, sad and `<sob>` only at a real peak. `<scream>` and `<cough>` are effects for drama and kids' pieces; use them once per piece at most.
- **Do not write the tag as a word.** "She laughed" in narration is fine (it is in the script text, so QA expects it). "Ha ha" is words too, and Supertonic reads it as words.
- **No nonverbals in playbooks, quiz questions, language drills or ads under 15 s.** They cost clarity and time.

## Examples

```
HOST (happy): That's the best email I've had all week. <laugh> Okay, next one.
MAYA (sad): <sigh> I waited. I really did.
ELI (scared): <breath> Did you hear that? Something's outside.
DETECTIVE (surprised): <gasp> The window. It was open the whole time.
GRANDPA (tired): <sigh> Long day. Long, long day.
```

Wrong, and what happens:

| Script | Result |
|---|---|
| `ELI: (laughs) Sure.` | fine: normalised to `<laugh>` (the engine's own laugh in `auto`, a sample in `sample`) |
| `ELI (laughs): Sure.` | fine: a nonverbal in the annotation is placed at the start of the line, same as `ELI: <laugh> Sure.` |
| `ELI: (looks at the door) Who's there?` | the stage direction is removed with a warning; it is not spoken, and nothing is heard in its place |
| `ELI: I did it<laugh>!` | the tag is cut out, but the lone `!` becomes its own tiny clip; write `I did it! <laugh>` |
| `ELI: <whisper> Over here.` | `<whisper>` is removed with a warning; use `(hushed)` |
| `ELI: <laugh> <laugh> Stop it!` | two in a row: sounds like a loop; keep one |
