# Mixing: placement, levels, ducking and stems

The mixer (`tools/lib/mix.mjs`) turns the render plan and the rendered clips into a timeline, four kinds of stem and one mix. It is built to scale: dialogue is laid out with ffmpeg's concat demuxer (clips plus exact silences), and cue stems are rendered in small batches and summed, so a 600-line audiobook never opens hundreds of ffmpeg inputs at once.

## How the timeline is laid out

- The piece starts after the preset's **lead** (or room-tone head, whichever is longer). Audiobook room tone itself starts at 0 s and runs under the whole piece.
- Each speaker line starts after the **gap** from the previous line, plus the line's delivery **pre-pause**; it ends with the delivery **post-pause**. Pieces of one line (text, nonverbal, text) sit back to back with no gap.
- `[pause N]` adds exactly N seconds and replaces the next gap.
- The piece ends after the preset's **tail** (or room-tone tail).
- Times are sample-accurate at 44.1 kHz; `timeline.json` matches the audio to within milliseconds.

Gap, lead and tail values per preset are in [domains](domains.md); pre/post pauses per emotion in [delivery](delivery.md).

## Cue behaviour

| Cue | Base level | Fades | Notes |
|---|---|---|---|
| `sfx` | −6 dB | none | One-shot at the cue's position. Aligned on the sound's peak mark when one is known, so the hit lands on the beat. `\| wait` holds the next line until it ends. |
| `ambience` | −20 dB | 1 s in, 1 s out | Loops until `[ambience: stop]`, the next ambience, the next `[scene:]`, or the end. |
| `music` | −16 dB | 1 s in; `stop` 0.5 s; `out` 3 s | Loops until stopped. `swell` = +6 dB for 4 s; `duck` = the preset's duck level for 4 s. |
| front-matter `music:` bed | −16 dB | 1 s in, 3 s out | Plays under the whole piece if the script has no music cues. |

Level arguments: `low` (also `soft`, `quiet`) −6 dB, `high` (also `loud`) +6 dB, `medium` 0, or an absolute value such as `-24dB` that replaces the base. Front matter `music: { level: low }` applies to the bed.

Practical levels:
- Ambience you notice only when it stops: the default, or `| low` under dense dialogue.
- SFX that punctuate without startling: the default. Footsteps and small foley: `| low`.
- Music under speech: the default; ducking takes care of the rest. Music alone (intros, transitions): `[music: swell]`.

## Ducking and carve

Music is the only stem that is ducked. A sidechain compressor keyed from the dialogue stem pulls the music down whenever someone speaks: threshold −30 dB, ratio 8:1, attack 20 ms, release 400 ms. When the preset has music, a carve also dips the music by 4 dB around 2.5 kHz (Q 1), where speech intelligibility lives, so words stay clear without the bed vanishing. Ambience and SFX are not ducked; keep them under the voice by level.

## Stems

| File | Contents |
|---|---|
| `stems/dialogue.wav` | every line and nonverbal, mono 16-bit |
| `stems/dialogue-<speaker>.wav` | one per speaker, same length as the piece, silence elsewhere |
| `stems/sfx.wav`, `stems/ambience.wav`, `stems/music.wav` | stereo 32-bit float, present only when used |

All stems share the same length and zero point, so they line up in any editor or video tool.

## Remixing without re-voicing

Voice renders are cached by content hash in `<out>/.cache/`. To change a level, swap a sound, move a cue or add ambience, edit the cue lines (or the front matter `music:`) and run `produce.mjs` again with the same `--out`. Unchanged lines come from the cache; only sounds, mix, master and deliverables are rebuilt. Changing a line's text, voice, emotion or speed re-renders only that line.

Read `timeline.json` to diagnose: `cues[]` lists each cue's type, label, start, end, path and gain; `lines[]` gives every line's start and end. A sound that started in the wrong place is almost always a cue on the wrong line, or a `[scene:]` that ended an ambience early.

## Common fixes

| Problem | Fix |
|---|---|
| Music fights the voice | `music: { level: low }` or `\| low` on the music cue |
| Ambience disappears after a scene change | add a new `[ambience: …]` after the `[scene: …]` |
| An effect lands too early or late | move the cue line; use `\| wait` when the next line should react to it |
| Long silence fails the gate | write the silence as `[pause N]`, or add ambience under it |
| Two scene partners blur together | recast with more pitch contrast (see [casting](casting.md)) |
| Mix sounds crowded | fewer SFX; one per action, not one per noun |
