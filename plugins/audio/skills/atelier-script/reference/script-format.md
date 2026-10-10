# Script format (`*.audio.md`)

One file describes a whole piece: who speaks, how they say it, and what the listener hears around them. The parser (`tools/lib/script.mjs`) is strict on purpose. A bad line fails the render with its line number (exit 1) instead of becoming a strange sound.

## Anatomy

```markdown
---
title: The Lighthouse
lang: en
preset: drama            # domain preset, see domains.md
nonverbals: auto         # auto (default) | sample | model | pause, see nonverbal.md
cast:
  NARRATOR: { voice: F4 }
  ELI:      { voice: M3, speed: 1.05 }
  MAYA:     { voice: F2 }
  ROSA:     { voice: F1, lang: es }
music: { search: "slow cinematic piano", level: low }
---
[scene: Lighthouse, night]  [ambience: sea waves, wind | low]
NARRATOR: The lamp had burned for forty years.
ELI (scared): <breath> Did you hear that?
[sfx: wooden door creak]
MAYA (hushed): Don't. Move.
[pause 1.5]
MAYA (happy, slow): <laugh> It's only the wind.
ROSA (tender, lang: es): Tranquila. Ya pasó.
[music: swell]
```

## Front matter

A small YAML subset: scalars, inline `{ k: v }` maps and one level of nesting. `#` starts a comment here (and only here).

| Key | Values | Default |
|---|---|---|
| `title` | free text | none |
| `lang` | a Supertonic language code (below) | `en` |
| `preset` | `education`, `audiobook`, `drama`, `podcast`, `playbook`, `ad`, `meditation`, `kids`, `language`, `video` | `education` |
| `nonverbals` | `auto`, `sample`, `model`, `pause` (`auto`: the engine's own laugh, as a joined stack; samples for the rest) | `auto` |
| `cast` | `NAME: { voice: F1–F5 or M1–M5, speed: 0.8–1.2, lang: xx }`; `voice: record` (the user reads this character's lines) or `voice: clone:<name>` (a clone of the user's voice), see [your-voice](your-voice.md) | `NARRATOR` gets `F4` |
| `music` | `{ search: "query", level: low or high or -18dB }` or `{ path: ./bed.mp3 }` | no bed |

`--preset` on the command line overrides `preset:`. A cast `speed` multiplies everything else (see [delivery](delivery.md) for the speed stack).

Language codes: en, ko, ja, ar, bg, cs, da, de, el, es, et, fi, fr, hi, hr, hu, id, it, lt, lv, nl, pl, pt, ro, ru, sk, sl, sv, tr, uk, vi, and `na` for unknown.

## Speaker lines

```
NAME (emotion, modifier, lang: xx): spoken text
```

- One speaker turn per line. A turn can hold several sentences.
- `NAME` starts with a letter and uses only letters, digits and underscores: `MRS_HUDSON`, not `Mrs Hudson`. Every name except `NARRATOR` must be in `cast` (otherwise: "Unknown speaker … Add it to cast.").
- The annotation is optional. Its first word is the emotion, one of the 14 [delivery](delivery.md) presets. An unknown emotion stops the render and lists the valid ones. A nonverbal there instead (`ELI (laughs): Sure.`) puts that nonverbal at the start of the line.
- Modifiers come after the emotion: `slow` (×0.9 speed), `fast` (×1.1), `loud` (+3 dB), `soft` (−4 dB). Unknown modifiers are ignored, so check spelling.
- `lang: xx` switches one line's language. The order of precedence is line, then cast entry, then front matter. A script with any non-English line gets the multilingual QA model and a looser WER threshold (see [captions](captions.md) and the QA notes in [mastering](mastering.md)).
- Nonverbal tags (`<laugh> <breath> <sigh> <gasp> <sob> <cough> <scream> <yawn> <hmm> <groan>`) can sit anywhere in the text, separated by spaces. In the default `auto` mode `<laugh>` goes to the engine as its own (performed in the speaker's voice, checked by QA); every other tag is cut out and spliced from samples. Nothing else in angle brackets ever reaches the engine. One engine tag is inaudible, so the pipeline always sends a joined stack (a laugh has a size: `<laugh:1>` small, `<laugh>` normal, `<laugh:3>` big). Read [nonverbal](nonverbal.md) before using them.

## Cues

A cue line contains only bracketed cues. Several cues may share a line; they run in order.

| Cue | Effect |
|---|---|
| `[scene: Name]` | Starts a scene or chapter in `timeline.json`. **Ends the current ambience**, so put the new ambience after it. |
| `[ambience: sea waves, wind \| low]` | Starts a looping bed with a 1 s fade in. `[ambience: stop]` ends it. |
| `[sfx: wooden door creak]` | One-shot effect at this point. Add `\| wait` to hold the next line until the effect ends. |
| `[music: start]` | Starts the front-matter bed. `[music: soft piano]` starts a new searched track. |
| `[music: swell]` / `[music: duck]` | +6 dB for 4 s / the preset's duck level for 4 s on the playing track. |
| `[music: stop]` / `[music: out]` | 0.5 s fade / 3 s fade-out. |
| `[pause 1.5]` | 1.5 s of silence instead of the normal gap. Allowed past the 4 s silence gate. |

Arguments after `|`: a level (`low` = −6 dB, `high` = +6 dB, or an absolute `-12dB`) and, for sfx, `wait`. A cue value that looks like a path (`./sounds/door.wav`, `~/sfx/bell.mp3`) uses that file instead of a search. Details in [sound-sourcing](sound-sourcing.md) and [mixing](mixing.md).

Cues never go inside a speaker line. In `ELI: Wait [sfx: knock] who's there?` the bracket is treated as a stage direction: it is removed with a warning, and no knock is played. Split it:

```
ELI: Wait.
[sfx: three knocks on a wooden door]
ELI (scared): Who's there?
```

## Narration-only scripts

If no body line looks like `NAME: text`, every paragraph (blank-line separated) becomes one `NARRATOR` line, and cue lines still work between paragraphs. One paragraph is one scene of breath and thought, the same as the careeros narration format.

Trap: a single line such as `Note: wear gloves.` matches the speaker pattern and switches the whole file to dialogue mode, which then fails with "Unknown speaker Note". In narration scripts, never start a line with `Word:`.

## Characters that never reach the engine

Supertonic rewrites `[ ] | / # _` as spaces and reads unknown tags aloud (spec §2.1). The normaliser strips `[ ] ( ) * / | # _` from spoken text before synthesis. That means:

- `24/7` is heard as "24 7" and `and/or` as "and or". Write "twenty-four seven" and "and or".
- Anything in brackets, parentheses or asterisks inside a speaker line is a stage direction. Ones that mean a nonverbal (`(sighs)`, `[laughs softly]`, `*laughing*`) become the nearest tag (and are handled like that tag); all others are **removed** with a warning and never spoken, so `*really*` and `(see page four)` vanish from the line. Never put spoken words in brackets. Emphasis comes from word order and punctuation (see [writing-for-the-ear](writing-for-the-ear.md)).
- Emotion names outside the 14 presets fail the plan. The spec's early drafts used `(relieved)`: write `(happy, slow)` or `(calm)` instead.
- There is no comment syntax in the body. A `# heading` is either read aloud (narration) or a parse error (dialogue). Use `[scene: …]` for structure.

## Validate before rendering

`node scripts/produce.mjs script.audio.md --out out/draft --draft --no-qa` parses, plans and renders a fast draft. Parse errors are reported with their line numbers and exit 1. Fix every error in one pass, then re-run.
