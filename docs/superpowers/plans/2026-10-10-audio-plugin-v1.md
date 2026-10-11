# Audio plugin v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `audio` plugin in the agentskilldeck marketplace. One `*.audio.md` script becomes a mastered mix, stems, `timeline.json`, captions, a HyperFrames `audio_meta.json` and credits, voiced on-device by Supertonic 3 with spliced nonverbals and a transcript QA gate.

**Architecture:**
- Dependency-free Node ≥18 ESM tools do parsing, planning, sound sourcing, ffmpeg mixing, QA scoring and deliverables.
- A thin Python worker (`engine/synth.py`, run in `~/.agentskilldeck/venv`) does synthesis and transcription in one model load per batch, using JSON in and JSON out.
- Skills and guides follow the ui plugin's library → skill sync model.

**Tech Stack:**
- Node ≥18 (`node:test`, `fetch`, `child_process`)
- Python ≥3.10 with `supertonic==1.3.1` and `faster-whisper`
- ffmpeg/ffprobe
- Openverse, Wikimedia Commons and Internet Archive APIs (no key); Freesound (optional token)

**Spec:** `docs/superpowers/specs/2026-10-10-audio-plugin-design.md`. Lab evidence: `~/Project/agentskilldeck-lab/` (tagtest, emotions).

## Global Constraints

- Node ≥18, no npm dependencies. Python deps are only those in `engine/requirements.txt`: `supertonic==1.3.1`, `faster-whisper==1.2.1`, `soundfile`, `numpy`.
- Load audio with soundfile and resample with numpy, never PyAV. faster-whisper's own `decode_audio` breaks with the installed `av` (`metadata_errors` TypeError).
- The venv lives at `~/.agentskilldeck/venv`, with `AGENTSKILLDECK_VENV` as an override. Config is `~/.agentskilldeck/config.json`. The cache is `tmpdir()/agentskilldeck-cache-<uid>` (mode 0700), as in the ui plugin's `http.mjs`.
- Never pass `[ ] ( ) * / | # _`, unknown tags, `<breath>` or `<sigh>` to Supertonic. Only plain text goes in, plus `<laugh>` when `nonverbals: model`.
- Exit codes: 0 ok · 1 script/usage error · 2 setup missing or service error · 3 QA failed (outputs kept).
- Commands in SKILL.md run from the skill base directory: `node scripts/<tool>.mjs …`.
- Entry guards use `realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)` (try/catch). Every CLI gets a spawn test through a symlinked path.
- Sound assets must be CC0 or CC-BY only. Each downloaded file gets a sidecar `<file>.license.json` with `{title, creator, license, license_url, source_url, attribution}`.
- Skill lint applies: frontmatter `name` equals the folder name; `description` is one line of 20–1024 chars; SKILL.md ≤ 120 lines; no titled or angle-bracket links; no forbidden strings.
- The repo stays private. Never change its visibility.

## Review Focus

1. A script that starts a line with `<breath>`/`<sigh>`, or uses `[laugh]`/`(sighs)`, must never produce the tag as a spoken word. Tested by the normaliser and splice tests (T2), and by the live engine test (T4).
2. Openverse being rate-limited or offline must not fail a render. It falls back to the bundled pack or the generator, with a warning in `qa.json` (T6 tests).
3. A non-English or multi-language script (`lang:` per line) must pick a multilingual whisper model and skip the English-only WER rules (T5 test).
4. Very long input (an audiobook chapter, ~5k words) must stream in batches without loading every WAV into memory. The mix uses a concat-based placement, not 1,000 `adelay` inputs (T7 test with a 600-line plan).
5. Paths with spaces or a symlinked skill dir must work for every CLI (spawn tests in T1, T8).

---

### Task 1: Multi-plugin repo plumbing + audio plugin skeleton

**Files:**
- Modify: `package.json` (scripts), `scripts/sync-library.mjs`, `scripts/lint-skills.mjs` (default = every `plugins/*` with a `sync.json`), `.gitignore` (`__pycache__/`, `*.pyc`), `.claude-plugin/marketplace.json` (add `audio`), `CONTRIBUTING.md` (multi-plugin note)
- Create: `plugins/audio/.claude-plugin/plugin.json`, `plugins/audio/sync.json`, `plugins/audio/library/.gitkeep`, `plugins/audio/tools/test/spawn.test.mjs` (placeholder CLI test arrives in T8)
- Test: `scripts/test/*.test.mjs` (extend)

**Interfaces:**
- `npm test` runs `node --test plugins/*/tools/test/*.test.mjs scripts/test/*.test.mjs`.
- `npm run sync` / `npm run check` / `npm run lint` iterate over every `plugins/<name>/sync.json`. A path argument still restricts the run to one plugin.
- `sync-library` excludes `test/`, `__pycache__/`, `*.pyc` and `.DS_Store` from the tool copies.
- `plugins/audio/sync.json` starts as `{ "skills": {} }`. T9 fills it in.

- [ ] Write failing tests: sync over a temp repo with two plugins syncs both, `--check` reports drift in either, and `__pycache__/x.pyc` is never copied.
- [ ] Implement, then run `npm test && npm run check`, which must be green with ui unchanged (zero diff under `plugins/ui/skills`).
- [ ] `claude plugin validate .` passes.
- [ ] Commit `chore: multi-plugin sync/lint/test and audio plugin skeleton`.

### Task 2: Script parser + nonverbal normaliser

**Files:** Create `plugins/audio/tools/lib/script.mjs`, `lib/nonverbal.mjs`, `tools/test/script.test.mjs`, `tools/test/nonverbal.test.mjs`

**Interfaces:**
- `parseScript(text, {file}) → { meta, lines: Line[], errors: ScriptError[] }`
  - `meta = {title, lang, preset, cast: {NAME: {voice, speed?, lang?}}, music?, nonverbals?: 'sample'|'model'|'pause'}`. Front matter is the YAML subset: scalars, inline `{k: v}` maps and one-level nested maps. Write a tiny parser; no deps.
  - `Line = {n, kind: 'speech'|'cue', speaker?, emotion?, modifiers: string[], text?, lang?, cue?: {type: 'scene'|'ambience'|'sfx'|'music'|'pause', value, args}}`
  - `ScriptError = {n, message}`
  - Narration mode: when there are no `NAME:` prefixes, paragraphs separated by blank lines become `NARRATOR` lines. The default NARRATOR voice is F4.
  - Unknown speakers become errors that suggest adding the speaker to `cast`.
  - Cue syntax: `[scene: X]`, `[ambience: q | low]`, `[sfx: q]`, `[music: start|stop|swell|duck|out|<query>]`, `[pause 1.5]`. Several cues may share one line.
- `normaliseNonverbals(text) → { segments: Array<{type: 'text', text} | {type: 'nv', tag}>, warnings }`
  - `[laugh]`, `(laughs)`, `*laughs*`, `<laugh/>`, `<Laugh>` and `(sighs)` all become tags.
  - Supported tags: `laugh, breath, sigh, gasp, sob, cough, scream`.
  - Aliases: `chuckle|giggle→laugh`; `sniff|cry→sob`; `inhale→breath`.
  - Unknown tags produce a warning and are removed.
  - Text segments are cleaned of the characters `[ ] ( ) * / | # _` (replaced by spaces, then whitespace collapsed). Empty text segments are dropped.

- [ ] Tests (minimum):
  - every row of the spec §2.1 table;
  - `"<breath> Did you hear that?"` → `[nv breath, text "Did you hear that?"]`;
  - `"worked<breath>really"` → text `worked`, nv, text `really`;
  - `"(laughs) fine"`;
  - an unknown `<whisper>` gives a warning;
  - narration mode;
  - a multi-cue line;
  - a line-numbered error on a bad cue;
  - per-line `lang`;
  - `(scared, slow)` → emotion `scared`, modifiers `['slow']`.
- [ ] RED → implement → GREEN; `npm test`.
- [ ] Commit `feat(audio): script parser and nonverbal normaliser`.

### Task 3: Presets + render planner

**Files:** Create `tools/lib/presets.mjs`, `tools/lib/plan.mjs`, `tools/test/presets.test.mjs`, `tools/test/plan.test.mjs`

**Interfaces:**
- `DOMAIN_PRESETS` keys: `education, audiobook, drama, podcast, playbook, ad, meditation, kids, language, video`. Each is `{speed, gap_s, lead_s, tail_s, music: 'none'|'bed'|'scored'|'stinger', duck_db, loudness: {mode: 'lufs'|'acx', I?, TP, rms_min?, rms_max?, peak_max?}, captions: bool, room_tone?: {head_s, tail_s}}`, using the values in spec §5. `drama.gap_s` = 0.25, `audiobook.loudness` = `{mode: 'acx', rms_min: -23, rms_max: -18, peak_max: -3}`, and so on.
- `DELIVERY_PRESETS` keys: the 14 from spec §6. Each is `{speed, gain_db, af: string (ffmpeg filter or ''), pre_s, post_s, nonverbal?: tag}`. Start from `~/Project/agentskilldeck-lab/emotions/presets.py` (speed, gain and fx). `hushed` uses gain -9 with `highpass=f=250,lowpass=f=5000`.
- Modifiers: `slow ×0.9`, `fast ×1.1`, `loud +3 dB`, `soft -4 dB`. Speed is clamped to 0.7–2.0.
- `planRender(parsed, {preset?, voiceOverrides?}) → Plan`:
  - `Plan = {meta, preset, items: PlanItem[]}`
  - `PlanItem = {id, n, kind: 'speech'|'nv'|'pause'|'cue', speaker?, voice?, lang, text?, tag?, speed?, gain_db?, af?, pre_s?, post_s?, cue?}`
  - `id` is stable: `L<n>-<k>`, where k is the segment index.
  - Effective speed = domain × cast × delivery × modifier.
  - Speech items carry only cleaned text.

- [ ] Tests:
  - speed multiplication and the clamp;
  - an unknown emotion gives an error naming the 14 valid emotions;
  - nv splitting yields `speech, nv, speech` items with the same speaker;
  - the `audiobook` preset adds room tone;
  - `nonverbals: 'pause'` makes nv items into 0.4 s pauses;
  - `nonverbals: 'model'` keeps `<laugh>` inline in the text but still splices breath and sigh.
- [ ] Commit `feat(audio): domain and delivery presets, render planner`.

### Task 4: Engine worker, bridge, setup

**Files:**
- Create: `tools/engine/synth.py`, `tools/engine/requirements.txt`, `tools/lib/engine.mjs`, `tools/setup.mjs`, `tools/test/engine.test.mjs` (fake worker), `tools/test/engine-live.test.mjs` (`LIVE_AUDIO=1`), `tools/test/fixtures/fake-synth.mjs`

**Interfaces:**
- `synth.py` reads one JSON job on stdin and writes JSON lines on stdout. The job is `{mode: 'synth'|'asr'|'voices', items: [...], steps: 10, out_dir}`.
  - `synth` item: `{id, text, voice, lang, speed, seed}`. Result: `{id, path, duration_s}`. Each item is a 44.1 kHz mono 16-bit WAV.
  - `asr` item: `{id, path, lang}`. Result: `{id, text, words: [{w, start, end, p}]}`. Uses `base.en` when lang is `en`, otherwise `base`. Word timestamps are on.
  - Progress goes to stderr as JSON lines `{progress: i, total}`.
  - The model loads once per process.
- `engine.mjs`:
  - `findPython() → path | null` (venv first).
  - `runWorker(job, {python, onProgress, signal}) → results[]`. A missing python throws `SetupError`, which maps to exit 2.
  - `draftSynth(item, out)` uses macOS `say -o x.aiff --data-format=LEI16@44100` then ffmpeg to WAV, or `espeak-ng -w`. It marks `draft: true`.
- `setup.mjs`:
  - `--check` prints JSON `{python, venv, supertonic, whisper, model_cached, ffmpeg, ffprobe, ok}`, exit 0 if ok, else 2.
  - `--install` creates the venv, pip-installs requirements and warms the model with a 1-word synth, printing each step.
  - The agent is told (in SKILL.md) to ask the user before `--install` the first time, and to record `{install_ok: true}` in config.

- [ ] Fake-worker tests: JSON framing, progress, worker crash → error with stderr tail, abort signal kills the process tree.
- [ ] Live test (`LIVE_AUDIO=1`):
  - synth 3 items incl. a `<laugh>` model case;
  - ASR returns words;
  - duration within 50 ms of ffprobe;
  - `"<breath> Did you hear that?"` taken through T2 and T3 into the engine → the transcript has no `breath|rest` match.
- [ ] Commit `feat(audio): Supertonic/whisper worker, Node bridge, setup check`.

### Task 5: QA scoring + retake policy

**Files:** Create `tools/lib/qa.mjs`, `tools/test/qa.test.mjs`

**Interfaces:**
- `normaliseForWer(s, lang)`: lowercase, strip punctuation, map digits ↔ number words for `en` (0–100 plus years), collapse whitespace.
- `wer(ref, hyp) → number` (Levenshtein over words).
- `checkLine({text, tagWords, lang}, asr) → {ok, wer, problems: string[]}`. Fails when:
  - any tag word or alias (`laugh|breath|breathe?|sigh|gasp|sob|cough|scream|giggle|chuckle`) appears in hyp but not in ref;
  - `wer > 0.15` (en) or `> 0.30` (other languages);
  - hyp is empty while ref is non-empty.
- `retakePlan(results, maxTakes = 4) → items to re-synthesise with seed+1`. The best take is the one with the lowest WER.
- `qaReport(lines, mastering) → qa.json object`.

- [ ] Tests:
  - "Breath, did you hear that?" vs ref "Did you hear that?" → fails with problem `spoken tag "breath"`;
  - "Breathe in slowly" in both ref and hyp → passes;
  - "The meeting starts at 9" vs "nine" → passes;
  - a Spanish line uses the 0.30 threshold;
  - the retake ceiling is respected.
- [ ] Commit `feat(audio): transcript QA and retakes`.

### Task 6: Sound sourcing (+ bundled nonverbal pack)

**Files:**
- Create:
  - `tools/lib/sounds/openverse.mjs`, `commons.mjs`, `archive.mjs`, `freesound.mjs`, `generate.mjs`, `index.mjs`, `license.mjs`
  - `tools/sounds.mjs` (CLI)
  - `tools/assets/nonverbal/{female,male}/{laugh,breath,sigh,gasp,sob,cough,scream}-{1,2}.mp3` plus `tools/assets/nonverbal/CREDITS.json`
  - tests and fixtures (`tools/test/fixtures/openverse-rain.json` etc., captured live)
- Reuse: copy the ui plugin's `lib/http.mjs` (fetchJson/fetchText, cache, ServiceError) into `plugins/audio/tools/lib/http.mjs`. Plugins ship standalone.

**Interfaces:**
- `searchSounds(query, {kind: 'sfx'|'music'|'ambience', limit = 5, minDuration?, maxDuration?, fetchImpl, cacheDir, freesoundToken?}) → {results: Sound[], warnings}`.
  - `Sound = {source, id, title, creator, license, license_url, source_url, download_url, duration_s, attribution}`.
  - Order: Openverse (`license=cc0,by`, `category` matched to the kind where the API supports it), then Commons, Archive (explicit CC0/PD/BY only), and Freesound if a token is set (`license:"Creative Commons 0" OR "Attribution"`).
  - Results are de-duplicated by title and creator.
- `license.mjs`: `isAllowed(licenseString)` (CC0, PDM and BY 3.0/4.0 allowed; NC/ND/SA rejected) and `attribution(sound)` in the spec's formats.
- `fetchSound(sound, destDir) → {path, sidecar}` downloads and writes `<file>.license.json`.
- `generate.mjs`: `generateBed(kind: 'room-tone'|'rain'|'wind'|'brown'|'pink'|'tone', seconds, out)` via ffmpeg `anoisesrc`/`sine` plus filters. License is "generated", with no attribution needed.
- `resolveCue(cue, {projectDir, offline, ...}) → {path, sidecar, source}` resolves in this order: local file path, bundled nonverbal (for nv), search, then generator for ambience. If nothing is found it returns `{warning}`; it never throws for a missing sound.
- CLI: `node scripts/sounds.mjs search "<q>" --kind sfx [--limit 3]` prints markdown in the ui plugin's format (title, duration, license, attribution, preview URL). Exit 0/1/2.
- Nonverbal pack: the implementer sources 2 CC0 clips per tag per gender from Openverse/Freesound-CC0 via Openverse. Each is trimmed to ≤1.5 s, loudness-normalised and kept under 40 KB as mono 64 kbps mp3, with every credit in `CREDITS.json`. A tag with no CC0 clip in the catalogue falls back to a generated breath (filtered noise) for `breath` and `sigh` only. The gap is recorded in `CREDITS.json`.

- [ ] Fixture tests:
  - NC and SA items are filtered out;
  - attribution strings;
  - a 429 response → fallback with a warning;
  - offline → generator;
  - the de-duplication rule.
- [ ] Live test (`LIVE=1`): "rain" returns ≥1 allowed result with a download URL that resolves.
- [ ] Spawn test for `sounds.mjs` through a symlink.
- [ ] Commit `feat(audio): licensed sound search, fetch, generator and nonverbal pack`.

### Task 7: Mixer + mastering + loudness gate

**Files:** Create `tools/lib/mix.mjs`, `tools/lib/master.mjs`, `tools/lib/ffmpeg.mjs`, `tools/test/mix.test.mjs`, `tools/test/master.test.mjs`

**Interfaces:**
- `ffmpeg.mjs`: `run(args, {signal}) → {stdout, stderr}`; `probeDuration(path)`; `hasFfmpeg()`.
- `layoutTimeline(plan, rendered: {id → {path, duration_s}}, preset) → Timeline`.
  - `Timeline = {duration_s, scenes: [{name, start}], lines: [{id, n, speaker, emotion, text, start, end, path}], cues: [{type, start, end?, path, gain_db, loop?}]}`.
  - Placement:
    - starts after `lead_s`;
    - each speech/nv item is placed at the current time, which then advances by its duration plus `post_s`;
    - `gap_s` comes between speakers' lines, with no gap inside a split line;
    - `pause` advances time.
  - Cues:
    - `sfx` sits at the current time without advancing it, unless `[sfx: x | wait]`;
    - `ambience` runs until the next `ambience` or `scene`;
    - `music` follows start/stop/swell/out.
- `buildDialogueStem(timeline, out)`: concatenates per-speaker segments with silence padding generated by the concat demuxer (`anullsrc` files), so the input count stays O(1), not O(lines). Delivery `af` and gain are applied per clip beforehand.
- `buildMix(timeline, stems, preset, out)`:
  - one `filter_complex`: ambience loops (`aloop` + `afade`), sfx via `adelay` in batches of ≤64 (pre-mixed into an sfx stem), music bed with `sidechaincompress` keyed from dialogue (threshold -30 dB, ratio 8, release 400 ms) plus an optional carve `equalizer=f=2500:t=q:w=1:g=-4`, then `amix=normalize=0`;
  - the per-stem WAVs are written as well.
- `master(in, out, loudness)`:
  - LUFS mode: a two-pass `loudnorm` (measure JSON, then apply linear) and `alimiter`. Writes WAV and mp3 (`libmp3lame -q:a 2`).
  - ACX mode: RMS/peak via the `astats` measure, gain to target RMS -20 dB, limiter at -3.5 dBFS, then re-measure.
  - Returns `{I, TP, LRA, rms, peak, ok, problems}`. The tolerance is ±1 LU.

- [ ] Tests (ffmpeg available in CI via `apt-get install ffmpeg`; add the step to `ci.yml`):
  - a layout unit test from a hand-built plan (exact starts);
  - a 600-item plan produces ≤ 10 ffmpeg inputs per invocation;
  - a real 3-clip mix from generated sines → duration matches ±50 ms;
  - mastering a sine to -16 LUFS measures within ±1;
  - ACX on a quiet tone passes after gain.
- [ ] Commit `feat(audio): timeline layout, stem mixing, ducking and mastering gate`.

### Task 8: Deliverables + `produce.mjs` / `audition.mjs` CLIs

**Files:**
- Create: `tools/lib/deliver.mjs`, `tools/produce.mjs`, `tools/audition.mjs`, `tools/test/deliver.test.mjs`, `tools/test/produce-cli.test.mjs`
- Modify: `tools/test/spawn.test.mjs`

**Interfaces:**
- `writeTimeline(timeline, words, out)`: `timeline.json` = `{version: 1, title, duration_s, scenes, lines: [{id, speaker, voice, emotion, text, start, end, words: [{w, start, end}]}], cues, assets}`.
- `writeCaptions(timeline, {format: 'srt'|'vtt', maxChars: 42, maxLines: 2, speakerLabels: true})`. Captions are split at word boundaries using word timestamps.
- `writeAudioMeta(timeline, stems, out)` uses the HyperFrames shape: `{voices: [{id, path, duration_s, words: [{text, start, end}]}], sfx: [{id, path, start}], bgm: {path} | null, total_duration_s}`.
- `writeCredits(assets, out)`: the Supertonic line, then one line per asset in attribution format, then "Generated sounds: no attribution required".
- `produce.mjs <script> --out <dir> [--preset x] [--draft] [--no-qa] [--offline] [--takes 4] [--json]`:
  - runs parse → plan → synth (batched) → QA/retakes → sounds → layout → stems → mix → master → deliver;
  - prints stage progress lines and a final summary (duration, LUFS, QA problems, outputs);
  - is cached by sha256 of the item JSON in `<out>/.cache/`;
  - exit codes as in the global constraints.
- `audition.mjs "<line>" [--voices all|F1,M3] [--emotion x] [--lang en] --out <dir>` writes one mp3 per voice plus `audition.md` listing them.
- With `--draft` or no venv: draft synthesis, `draft: true` in qa.json and a warning line. A final render (without `--draft`) when setup is missing → exit 2 with the `setup.mjs --install` hint.

- [ ] Tests:
  - captions line-breaking;
  - SRT/VTT format;
  - the audio_meta shape;
  - credits;
  - a produce CLI end-to-end with the fake worker and generated audio (no network: `--offline`) → every output file exists and the timeline durations are consistent;
  - spawn tests through a symlink for `produce`, `audition` and `sounds`.
- [ ] Live (`LIVE_AUDIO=1`): a 6-line drama script → exit 0, QA clean, LUFS ±1.
- [ ] Commit `feat(audio): produce and audition CLIs with timeline, captions, audio_meta and credits`.

### Task 9: Library guides + three skills

**Files:**
- Create: `plugins/audio/library/{script-format,domains,delivery,casting,nonverbal,sound-sourcing,mixing,mastering,captions,ethics-licensing,writing-for-the-ear,setup}.md`, `plugins/audio/skills/{deck-script,deck-voice,deck-mix}/SKILL.md`, `docs/coverage/audio-sources.md`
- Modify: `plugins/audio/sync.json`
  - `deck-script`: all guides, tools: true
  - `deck-voice`: all guides, tools: true
  - `deck-mix`: all guides, tools: true

**Content requirements:**
- `writing-for-the-ear` carries over careeros `plugin/skills/voice/SKILL.md` "Writing for the ear" and the script-format rules, adapted and credited:
  - about 2.5 words/s;
  - numbers as spoken words;
  - spelled acronyms;
  - one breath per sentence;
  - nonverbals at most one per 30 s, never two in a row.
- `delivery` documents the 14 presets. For each: when to use it, a phrasing recipe (e.g. scared = fragments, repeated starts, a breath before), and an example line taken from the lab presets.
- `nonverbal` states the measured bug table and the splice rule.
- `domains` gives one section per preset, with structure templates (lesson: hook → 3 points → recap; audiobook: chapter heads, room tone; podcast: cold open → intro stinger → segments; playbook: numbered steps with confirm pauses; ad: 15/30/60 s beat sheets; meditation: breath-count pacing; kids: call-and-response; language: phrase → pause → repeat).
- `casting` covers the voice map. F1–F5 and M1–M5 are described by measured traits: run `audition.mjs` on one sentence, measure median pitch (Hz) and words/s per voice, and record them. Plus casting rules: contrast pitch between scene partners; one narrator per piece.
- `sound-sourcing`, `mixing`, `mastering` and `captions` document the T6–T8 behaviour and the targets.
- `ethics-licensing` summarises OpenRAIL-M, the CC rules and disclosure.
- `setup` covers the ask-once install flow.
- Each SKILL.md has: when to use (trigger phrases across domains), a routing table to the guides, the exact commands, exit-code handling, the untrusted-data rule for fetched metadata, and a hand-off between the three skills (script → voice → mix).
  - `deck-voice` owns `produce.mjs` for whole renders.
  - `deck-mix` owns sound search and re-mixing an existing `timeline.json`.

- [ ] `npm run sync && npm run check` clean.
- [ ] Commit `feat(audio): library guides and deck-script/voice/mix skills`.

### Task 10: Preset tuning + showcase examples + README

**Files:**
- Create: `plugins/audio/examples/<slug>/{script.audio.md, mix.mp3, captions.vtt, timeline.json, CREDITS.md, preview.mp4}` for the 8 pieces in spec §9, plus `plugins/audio/examples/README.md` and `scripts/render-preview.mjs` (ffmpeg `showwaves` + burned-in subtitles → 1280×720 mp4)
- Modify: `README.md` (an Audio section with a sample table), `NOTICE` (Supertonic MIT + OpenRAIL-M notice; credit careeros voice-skill guidance, owned by the same author, and HyperFrames ideas where text is adapted), `docs/ATTRIBUTION.md`

**Requirements:**
- Before writing scripts, tune the delivery presets.
  - Render each emotion's lab line with 3 variants (±speed, phrasing) for M3 and F4.
  - Transcribe the variants. Reject any with WER > 0.1 or a spoken tag.
  - Measure words/s and loudness, then pick the variant whose rate matches the target pacing in `delivery.md`.
  - Update `presets.mjs` and record the decisions in `docs/coverage/delivery-tuning.md`.
- Examples must pass the QA gate (exit 0) and stay ≤ 1 MB mp3 each. They must be original writing, or public-domain text (Sherlock Holmes excerpt), with credits.
- `preview.mp4` ≤ 3 MB each.
- README table: piece, domain, voices, length, link to the mp3 and preview. Add a note that inline players appear once the owner uploads the MP4s as attachments when publishing.

- [ ] `produce.mjs` renders all 8 examples and every one exits 0.
- [ ] `npm test && npm run check` pass.
- [ ] Commit `feat(audio): tuned presets, showcase examples and README`.

### Task 11: Final whole-branch review fixes, version and push

- The controller dispatches the final review, then one fix wave.
- `claude plugin validate .` passes.
- Bump the marketplace `metadata.version` to 0.2.0.
- Push `feat/audio-plugin` and fast-forward `main`. The repo stays PRIVATE.
- Run `claude plugin marketplace update agentskilldeck && claude plugin install audio@agentskilldeck`.
- Smoke test: from the installed skill dir, `node scripts/produce.mjs examples/...` and `node scripts/setup.mjs --check`.

### Task 12: Your own voice — recorded lines + free local cloning (owner request, controller-added; NO Voice Builder)

**Files:** Create `tools/record.mjs`, `tools/lib/recorder.mjs`, `tools/lib/voices.mjs`, tests; modify `tools/engine/synth.py`, `lib/plan.mjs`, `lib/render.mjs`/`produce.mjs`, `library/casting.md`, `library/ethics-licensing.md`, new `library/your-voice.md`, SKILL.md of deck-voice.

**Interfaces:**
- Cast voice forms: preset `F1..M5`; custom style `voice: ./path/style.json` (Supertonic Voice Builder export; `synth.py` uses `get_voice_style_from_path`; validate JSON shape, clear error otherwise); recorded `voice: record` (the user speaks this character's lines).
- `record.mjs <script> --speaker NAME --out <dir> [--device <id>] [--list-devices]`: shows each line, records via ffmpeg (`-f avfoundation -i :<idx>` macOS, `-f pulse -i default` Linux, `-f dshow` Windows), push-to-stop by Enter or auto-stop on 1.2 s silence after speech (`silencedetect`), then trims silence, `afftdn` light denoise, `highpass=f=80`, loudness to -20 LUFS; transcribes and compares with the line (QA `checkLine`); offers re-record on failure. Writes `<out>/recordings/<line-id>.wav` + `recordings.json` {line id → path, duration, wer, consent}.
- `record.mjs --reference --out <dir>`: guided 30–60 s reference recording (phonetically varied paragraph) for Voice Builder upload; prints next steps (Voice Builder is a paid Supertone service; user uploads; drop the JSON into the project and cast it).
- Consent gate: first record in a project asks for a typed consent statement ("This is my own voice" or "I have the speaker's consent: <name>"), stored in `<out>/recordings/consent.json`; produce refuses `record` voices without it (exit 1).
- produce: `record` speakers use recordings in place of synth (missing recording → exit 1 listing line ids and the record command); everything else (timeline, captions from ASR words, mix, master, QA) unchanged.
- Agent flow (SKILL.md): tell the user the mic will be used and ask before recording; macOS may prompt for microphone permission for the terminal app.
- Tests: device-arg builder per OS, consent gate, missing-recording error, a fake "recording" (generated speech wav) through trim/denoise/QA/produce; custom style JSON path through synth (live, using a copy of a bundled preset JSON as a "custom" style).
- Commit `feat(audio): record your own voice and cast custom voice styles`.

**Task 12 amendments (owner, binding; supersede the Voice Builder parts above):**
- No Voice Builder anywhere. Remove `voice: ./style.json` from scope.
- Two input paths, agent asks the user which: (a) live mic via `record.mjs`; (b) existing file via `record.mjs --from <file>` (wav/mp3/m4a/aac/flac/ogg; ffmpeg converts).
- One-take mode: `record.mjs <script> --speaker NAME --one-take [--from file]` — user reads all of that speaker's lines in one go; split by ASR word timestamps aligned to the script lines (word-level alignment, tolerate small misreads; report lines with WER > 0.15 and offer per-line re-record).
- Cloning: `record.mjs --reference --name me [--from file]` stores a 10–60 s cleaned reference in `~/.agentskilldeck/voices/me/` (+ consent.json); cast `voice: clone:me`. Engine `clone` = Chatterbox (MIT) in `~/.agentskilldeck/venv-clone` (installed only on first clone use, ask once; setup.mjs --check reports it). Worker `engine/clone.py` with the same JSON job protocol as synth.py (mode synth; item gains `ref_path`, `exaggeration`). Map our delivery presets to Chatterbox `exaggeration`/`cfg_weight`; QA/retakes/timeline unchanged. Keep the PerTh watermark on. If Chatterbox cannot install, implement the OpenVoice V2 converter path instead and report.

**Task 12 amendment 2 (controller, from lab spike ~/Project/agentskilldeck-lab/clone, binding):**
- `clone:<name>` voices = Supertonic synth (base voice chosen by reference gender/pitch: measure the reference's median f0 and pick the nearest preset from the voice table) → Chatterbox **VC** (`chatterbox.vc.ChatterboxVC.generate(src_wav, target_voice_path=ref)`) → QA on the converted audio. Measured on M-series MPS: VC load 28 s, ~2 s compute per 1 s audio; transcripts exact. Full Chatterbox TTS rejected as default (hallucinated words at exaggeration 0.9, 7–12× slower); Turbo fails on MPS (float64).
- Clone venv setup: `pip install chatterbox-tts==0.1.7 "setuptools<81"` (perth watermarker needs pkg_resources); save with soundfile (torchaudio.save needs torchcodec). Device mps → cpu fallback. Keep the PerTh watermark (ChatterboxVC applies it).
- Worker `engine/clone.py`: mode `convert`, items `{id, src_path, ref_path, out}` → `{id, path, duration_s}`; same JSON-lines protocol and progress as synth.py. Batch one process per produce run.
