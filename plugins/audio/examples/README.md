# Audio examples

Eight pieces rendered by `produce.mjs` from the scripts in these folders, unedited: no hand mixing, no retouching, no cherry-picked takes beyond what the pipeline's own QA chose. Each folder has:

| File | What it is |
|---|---|
| `script.audio.md` | the script, exactly as rendered |
| `mix.mp3` | the finished mix |
| `captions.vtt` | speaker-labelled captions from the word timings |
| `timeline.json` | every line, word, cue and scene with its time |
| `CREDITS.md` | the voice credit, every sound with its license, and notes on this example |
| `preview.mp4` | 1280×720 waveform video with burned-in speaker captions (made by `scripts/render-preview.mjs`) |

<!-- examples-table -->

| Piece | Domain | Voices | Length | Listen |
|---|---|---|---|---|
| [The Lighthouse](./lighthouse/) | Audio drama with storm and sea | Narrator M5, Maya F2, Eli M1 | 1:09 | [mp3](./lighthouse/mix.mp3) · [preview](./lighthouse/preview.mp4) |
| [Pip and the Lantern Bug](./bedtime/) | Bedtime story for kids | Narrator F3, Pip F2, Glow M1 | 1:10 | [mp3](./bedtime/mix.mp3) · [preview](./bedtime/preview.mp4) |
| [How vaccines train your immune system](./lesson/) | Health lesson in five chapters | Narrator F4, Student M4 | 0:55 | [mp3](./lesson/mix.mp3) · [preview](./lesson/preview.mp4) |
| [Small Wonders, cold open](./podcast/) | Podcast cold open into the theme | Nova F2, Rex M3 | 0:43 | [mp3](./podcast/mix.mp3) · [preview](./podcast/preview.mp4) |
| [A Study in Scarlet, chapter one (excerpt)](./audiobook/) | Audiobook, ACX-mastered | Narrator M5, Holmes M1, Stamford M4 | 1:29 | [mp3](./audiobook/mix.mp3) · [preview](./audiobook/preview.mp4) |
| [One voice, six languages](./languages/) | Languages: en, es, fr, hi, ja, ko | Voice F4 | 0:50 | [mp3](./languages/mix.mp3) · [preview](./languages/preview.mp4) |
| [Two-minute breathing break](./meditation/) | Meditation, −20 LUFS | Guide F3 | 2:00 | [mp3](./meditation/mix.mp3) · [preview](./meditation/preview.mp4) |
| [Lockout, tagout in six steps](./playbook/) | Safety playbook | Trainer F5 | 1:08 | [mp3](./playbook/mix.mp3) · [preview](./playbook/preview.mp4) |

## How they were made and checked

- Every line was transcribed by faster-whisper and scored against the script before mixing; failed takes were re-rendered with new seeds. After mastering, each mix was transcribed again end to end and checked for spoken tags, timing and level. Whisper hears less than a listener, so which native tags each voice may use also rests on the owner's listening tests (recorded in the per-voice table).
- Loudness: −16 LUFS integrated (true peak ≤ −1 dBTP) for drama, podcast, lesson, kids, languages and playbook; −20 LUFS for the meditation; the audiobook is mastered to ACX (RMS −23 to −18 dB, peak ≤ −3 dBFS, noise floor ≤ −60 dB, with room tone at head and tail).
- Nonverbals use the default `auto` mode: a laugh is the voice's own where the per-voice table allows it ([nonverbal](../library/nonverbal.md)); breaths, sighs and yawns that a voice would speak as words are spliced from the bundled CC0 pack.
- Sounds come from Freesound and Wikimedia Commons, CC0 or CC BY only, each fetched with a license sidecar; CC BY sounds are attributed in `CREDITS.md`. The sound files themselves are not committed (only what is listed above), so the `./sounds/` paths in the scripts point to files on the machine that rendered them.
- `mix.mp3` is `produce.mjs`'s own file when it fits in 1 MB; longer pieces were re-encoded from `mix.wav` at the highest constant bit rate that fits (noted in each `CREDITS.md`). The audiobook's ACX master is 192 kbps CBR before that re-encode.

## Reproduce one

```sh
node plugins/audio/tools/produce.mjs plugins/audio/examples/podcast/script.audio.md --out /tmp/podcast
node scripts/render-preview.mjs /tmp/podcast        # optional: preview.mp4 next to the mix
```

What reproduces and what does not:

- **Voices reproduce exactly.** Same script, same engine version, same seeds: the same takes, the same QA verdicts.
- **The local sound files are not committed.** The scripts' `./sounds/…` paths point at files on the machine that rendered them; the source URL, creator and license of every one are in each folder's `CREDITS.md`, so you can fetch them yourself.
- **Without them,** an `--offline` render uses a generated bed (rain, wind, room tone and so on, guessed from the file name) for each missing ambience file and drops the missing sfx and music, with a warning per cue in `qa.json`. Without `--offline`, give the script your own files (`./sounds/…`), or remove the path and keep a description (for example `[sfx: wooden door creak]`) to let `produce.mjs` search the licensed sources; results will differ from the showcase.

Voices and QA need the one-time setup (`node plugins/audio/tools/setup.mjs --check`).
