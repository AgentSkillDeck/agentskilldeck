# agentatelier `audio` plugin — design

Date: 2026-10-10 · Status: draft for owner review · Marketplace: agentatelier (private until the owner publishes)

## 1. Goal

Let any agent produce finished, emotional, multi-voice audio for any domain — narration, dialogue,
audiobooks, lessons, podcasts, audio drama and animation voice tracks, training playbooks, ads,
meditations, kids' stories, language learning — free and on-device, with licensed sound effects,
ambience and music, mixed and mastered, plus timing data that the later video plugin (HyperFrames)
consumes directly.

Success = one script in, and out come `mix.mp3/.wav`, stems, `timeline.json`, captions and credits,
that a listener would not mistake for a robotic TTS demo.

## 2. What we learned (evidence, 2026-10-10)

### 2.1 Supertonic 3 (engine), measured in `~/Project/agentatelier-lab`

- `pip install supertonic` (v1.3.1). The model is ~400 MB in `~/.cache/supertonic3/`. Code is MIT; the weights are OpenRAIL-M (no impersonation without consent, no harmful use, attribution). The upstream repo is archived, so pin the version.
- API: `synthesize(text, voice_style, lang, speed 0.7–2.0, total_steps 5–12, max_chunk_length, silence_duration)`. Output is 44.1 kHz mono. Voices are F1–F5 and M1–M5. 31 languages plus `na`. Diffusion sampling uses numpy's random generator, so `np.random.seed(n)` gives a different take.
- **There is no emotion parameter.** Only `<laugh>`, `<breath>` and `<sigh>` are documented.
- The preprocessor maps `[`, `]`, `|`, `/`, `#` and `_` to spaces, so `[laugh]` becomes the plain word "laugh".
- Tag test (transcribed with faster-whisper; 12 takes = 3 voices × 4 seeds):

| Input | Spoken as a word |
|---|---|
| `[laugh]`, `(sigh)`, `(breath)`, `<breath/>` | yes, every time |
| `<gasp> <sniff> <scream> <whisper> <chuckle> <giggle> <clear_throat>` | yes (unknown tags) |
| `<cry> <cough> <yawn> <groan> <hmm> <sob>` | not spoken, no reliable sound (treat as unsupported) |
| `<laugh>` | 0/12 at start, mid or after punctuation |
| `<breath>` | 11/12 at start, 6/12 after punctuation, 4/12 after a lead word |
| `<sigh>` | 0–2/12, and sometimes heard as "Si" or "side" in real lines |
| tag glued to a word (`worked<breath>`) | spoken |

- Even working tags are faint (≈0–0.3 s of extra sound). Conclusion: **the engine's tags are hints, not performances.**
- Emotion test: 14 delivery presets × 2 voices × 2 lines (`agentatelier-lab/emotions/index.html`). Speed, phrasing, punctuation and gain/EQ carry emotion. Owner listening ratings decide the shipped presets.

### 2.2 Competitors

| Competitor | Weakness |
|---|---|
| ElevenLabs skills, Noiz, inference.sh | Paid cloud |
| inference.sh (Dia) | At most 2 speakers |
| mytory `supertonic-tts` | Same engine, single voice, no sound/mix/captions |
| HyperFrames `media-use` | Voice and BGM go through HeyGen or a Gemini key; 19 bundled SFX |
| HyperFrames `hyperframes-audio` | Excellent mixer, but no TTS |
| opus-sound-layer, SoundDirector | Sound only |
| podcastfy | Library, not a skill |

No one ships cast + emotion + licensed sound + mix + stems + timeline + captions, local and free.

Ideas we adopt:
- voiceover carve plus ducking (HyperFrames)
- a QA gate that fails on loudness or peaks (opus-sound-layer)
- SFX onset/peak marks (SoundDirector)
- per-line voice/speed/emotion overrides (Noiz)
- two-pass EBU R128 mastering (danielrosehill)

### 2.3 Free audio assets (tested live)

- **Primary:** Openverse audio API. No key. Returns a direct URL, duration, license and a ready `attribution` string. Filter to `license=cc0,by`.
- **Secondary (no key):** Wikimedia Commons, and Internet Archive (only items with an explicit CC0/PD/CC-BY `licenseurl`).
- **Optional:** Freesound API v2 with the user's free token, cc0/by only.
- **Offline:** a small bundled CC0 pack plus ffmpeg-generated beds (noise, room tone, tones, silence).
- **Excluded:**
  - Pixabay: no audio API, and its terms bar scraping
  - BBC RemArc: non-commercial only
  - Free Music Archive: no API
  - Any NC/ND license
  - MusicGen and AudioLDM: non-commercial weights

## 3. Plugin layout

```
plugins/audio/
  .claude-plugin/plugin.json
  skills/
    atelier-script/   SKILL.md + reference/   write for the ear, per domain; emotion direction; script format
    atelier-voice/    SKILL.md + reference/ + scripts/   cast, audition, render, QA
    atelier-mix/      SKILL.md + reference/ + scripts/   find sounds, mix, master, deliver
  library/            guides (synced into skills like the ui plugin): script-format, domains, delivery,
                      casting, nonverbal, sound-sourcing, mixing, mastering, captions, ethics-licensing
  tools/              Node ≥18 ESM, no deps: parse, plan, sounds, mix, qa, deliver, setup
    engine/synth.py   thin Python worker (Supertonic + faster-whisper); JSON batch in, WAVs and JSON out
    assets/nonverbal/ bundled CC0 breaths, sighs, laughs, gasps, sobs (male and female), with credits
  examples/           README showcase projects (script + outputs), see §9
```

The sync/lint/check scripts generalise to more than one plugin, so `package.json` scripts loop over `plugins/*`.

## 4. Script format (`*.audio.md`)

```markdown
---
title: The Lighthouse
lang: en
preset: drama            # domain preset (§5)
cast:
  NARRATOR: { voice: F4 }
  ELI:      { voice: M3, speed: 1.05 }
  MAYA:     { voice: F2 }
music: { search: "slow cinematic piano", level: bed }
---
[scene: Lighthouse, night]  [ambience: sea waves, wind | low]
NARRATOR: The lamp had burned for forty years.
ELI (scared): <breath> Did you hear that?
[sfx: wooden door creak]
MAYA (hushed): Don't. Move.
[pause 1.5]
MAYA (relieved): <laugh> It's only the wind.
[music: swell]
```

Rules:
- One speaker line per line.
- `(emotion)` names a delivery preset (§6). `(emotion, slow)` adds a modifier: `slow`, `fast`, `loud`, `soft`.
- Cues in `[…]`: `scene` (marks a chapter or scene for the timeline), `ambience`, `sfx`, `music` (start/stop/swell/duck/out), `pause N`.
- Nonverbal tags `<laugh> <breath> <sigh> <gasp> <sob> <cough> <scream>` may appear anywhere. The engine never sees them raw (§7).
- Narration-only scripts can drop speaker names. Paragraphs become lines under `NARRATOR`, which keeps the careeros paragraph = scene behaviour.

## 5. Domain presets

| Preset | Pace | Gaps | Music bed | Loudness target | Notes |
|---|---|---|---|---|---|
| education | 1.0 | 0.5 s | low, ducked | -16 LUFS / -1 dBTP | chapter markers, captions on |
| audiobook | 0.95 | 0.6 s | none | ACX: -23…-18 dB RMS, peak ≤ -3 dBFS, 0.5–1 s room tone head and 1–5 s tail | one narrator, character voices allowed |
| drama (animation, audio drama) | 1.0 | 0.25 s | scored | -16 LUFS | full SFX/ambience, per-character stems |
| podcast | 1.03 | 0.3 s | intro/outro stinger | -16 LUFS / -1 dBTP | 2–4 hosts |
| playbook (training, procedures) | 0.95 | 0.7 s | none | -16 LUFS | step numbers spoken, steps in the timeline |
| ad (promo) | 1.1 | 0.2 s | upbeat | -14 LUFS | 15/30/60 s fit to length |
| meditation | 0.82 | 1.2 s | ambience | -20 LUFS | long pauses, breath cues |
| kids | 0.92 | 0.5 s | light | -16 LUFS | brighter voices, playful SFX |
| language | 0.8 | 1.0 s | none | -16 LUFS | phrase, pause, repeat; multilingual lines (`lang:` per line) |
| video (HyperFrames voiceover) | 1.0 | 0.45 s | separate stem | -14 LUFS | `audio_meta.json` export |

## 6. Delivery (emotion) presets

There are 14 to start: neutral, happy, excited, sad, angry, scared, hushed, calm, surprised, sarcastic, tender, tired, authoritative, nervous.

Each is a recipe:
- speed
- phrasing rules the agent applies when writing the line (fragments, ellipses, repetition, "um")
- an optional nonverbal (§7)
- gain and EQ/compression applied to that line's clip
- pre/post pause

The tuned values come from the owner's ratings of the lab clips. `atelier-script` teaches the phrasing half, because the words carry most of the emotion. Honest labelling: "delivery presets", not "emotional TTS".

## 7. Nonverbals (fix for the spoken-tag bug)

1. **Normalise:** `[laugh]`, `(laughs)`, `*laughs*`, `<laugh/>` and case variants become `<laugh>`. Unknown tags give a warning plus the nearest supported one (`chuckle`/`giggle` become `laugh`; `sniff`/`cry`/`sob` become `sob`).
2. **Split and splice:** the line is cut at each tag. Each text segment is synthesised on its own. A recorded CC0 nonverbal matching the voice's gender (bundled pack, else Openverse) goes in the gap, with short crossfades and gain matched to the speech.
   - `<laugh>` may use the engine's own tag when the user selects `nonverbals: model`.
   - The default is `sample`; the other option is `pause`.
3. **Never** pass `[ ] ( ) * /` or unknown tags to Supertonic. Strip characters the engine would rewrite.

## 8. Pipeline and QA

`node scripts/produce.mjs <script.audio.md> --out <dir>` runs these stages, all cached by content hash:

1. **parse:** validate the script, return line-numbered errors (exit 1).
2. **plan:** expand presets, cast and cues into a render plan.
3. **synth:** batch the segments to `synth.py` (one model load) with `total_steps` 10.
4. **QA per line:** transcribe with faster-whisper (`base.en` or multilingual `base`).
   - Fail if any tag word is heard, the word error rate against the text is above 15%, or a word is missing or added.
   - On failure, re-render with seeds 1–3, then keep the best and flag it in `qa.json`.
   - Word timestamps come from this pass.
5. **sounds:** resolve each `sfx`/`ambience`/`music` cue in this order: local file, bundled pack, Openverse, then Freesound (if a token is set), then the ffmpeg generator. Downloads go to `<out>/assets/` with a sidecar license JSON.
6. **mix:** ffmpeg filter graph.
   - Lines are placed by `adelay`; ambience loops with fades.
   - SFX are aligned on their peak mark.
   - The music bed gets sidechain ducking under dialogue plus an optional carve (EQ dip 1–4 kHz).
   - Stems: dialogue (per speaker), sfx, ambience, music.
7. **master:** two-pass `loudnorm` to the preset target and a true-peak limiter.
   - QA gate: measured LUFS within ±1, true peak within limits, no clipping, no silence gap over 4 s unless a pause asked for it. Exit 3 on failure, with the numbers.
8. **deliver:**

| File | Contents |
|---|---|
| `mix.wav` / `mix.mp3` | Final mix |
| `stems/*.wav` | Per-speaker dialogue, SFX, ambience, music |
| `timeline.json` | Scenes; lines with speaker, emotion, start, end and words[]; cues; assets |
| `captions.srt` / `.vtt` | Speaker-labelled captions |
| `audio_meta.json` | HyperFrames-compatible: `voices[].{path, duration_s, words[]}`, `sfx[]`, `bgm`, `total_duration_s` |
| `CREDITS.md` | Every asset's attribution, plus Supertonic attribution |
| `qa.json` | QA results |

Exit codes: 0 ok · 1 script/usage error · 2 setup missing (engine/ffmpeg) · 3 QA failed (output kept, problems listed).

Other commands:
- `audition.mjs` writes previews of all 10 voices for a line.
- `sounds.mjs search "<query>" --kind sfx|music|ambience` returns license-filtered results like the ui plugin's search tools.
- `setup.mjs --check | --install`.

## 9. README showcase ("outstanding examples")

Ship `plugins/audio/examples/` with these finished pieces (script plus outputs):

1. **The Lighthouse:** a 45–60 s three-voice audio drama with ambience, SFX, a score and emotions.
2. **Bedtime story** (kids): narrator plus two character voices, soft music.
3. **Lesson:** "How vaccines train your immune system", 60 s, chaptered captions.
4. **Podcast cold open:** two hosts plus a stinger.
5. **Audiobook excerpt:** a public-domain text (Sherlock Holmes), ACX-mastered.
6. **One voice, six languages:** en, es, fr, hi, ja, ko.
7. **Two-minute breathing meditation** with ambience.
8. **Safety playbook:** lockout/tagout steps.

How they appear:
- Each piece is also rendered as a short MP4 (waveform plus burned-in speaker captions), so GitHub can show a player.
- The MP4s are uploaded as README attachments when the owner publishes. Until then the README links to the files in the repo.
- Every example passes the QA gate.
- The owner approves them by listening before they ship. "Outstanding" is the owner's call, not the agent's.

## 10. Setup and install policy

- On first use the agent runs `setup.mjs --check`. If anything is missing, it asks the user once and then installs:
  - the venv at `~/.agentatelier/venv` (supertonic==1.3.1, faster-whisper);
  - the model download (~400 MB plus ~150 MB for whisper base);
  - ffmpeg via the package manager.
- The answer is remembered in `~/.agentatelier/config.json`.
- **Draft fallback:** macOS `say` (or `espeak-ng` on Linux) for timing drafts, labelled "draft voice" in output and `qa.json`. It is never used for a final render unless the user says so.

## 11. Ethics and licensing

- No voice cloning of real people. Do not present a preset voice as a real named person.
- Disclose AI narration where the domain requires it (audiobook stores, ads).
- OpenRAIL-M use restrictions are summarised in the ethics guide, with a link to the license.
- Only CC0/CC-BY assets are used; every CC-BY asset is credited in `CREDITS.md`.
- NOTICE credits Supertonic (MIT code, OpenRAIL-M model). Ideas borrowed from careeros' voice skill and HyperFrames are credited where their text is adapted.

## 12. Testing

- **Node tests with fixtures:**
  - parser, normaliser and splicer
  - planner
  - ffmpeg graph builder (snapshot of the argument list)
  - sounds clients (fixtures from live responses)
  - license filter
  - QA scoring
  - timeline, captions and `audio_meta` writers
  - spawn tests through symlinked paths
- **Engine tests behind `LIVE_AUDIO=1`:** render a 3-line script; assert no tag word is heard, LUFS is in range and the timeline matches the audio duration within 50 ms.
- **CI:** the Node tests run on 18 and 22. Engine tests stay local.

## 13. Out of scope (v1)

- Voice cloning and Voice Builder styles.
- Music generation models.
- Real-time streaming.
- Optional engines, as later add-ons:
  - Dia (Apache-2.0; true dialogue and nonverbals)
  - Kokoro (Apache-2.0; fast)
  - ElevenLabs (paid, with the user's own key)
- The video plugin itself (next project; it consumes `timeline.json` / `audio_meta.json`).

## 14. Risks

- Supertonic is archived. Pin it; the engine adapter keeps the door open for Dia/Kokoro.
- Delivery presets are only as good as phrasing. The owner's ratings tune them, and the guides teach writing for emotion.
- Whisper QA adds time (~0.3× real time on CPU). It can be turned off with `--no-qa` for drafts; it is always on for finals.
- The Openverse anonymous rate limit is low. Cache results, fall back to the bundled pack, and make the optional token clear.
