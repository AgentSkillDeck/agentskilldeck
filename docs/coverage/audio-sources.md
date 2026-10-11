# Audio plugin: sources and coverage

Where the `plugins/audio` guides and skills got their material, and where each borrowed instruction now lives. Update this file whenever a guide adopts or drops a source.

## Sources

| Source | What was used | License | Lives in |
|---|---|---|---|
| careeros `plugin/skills/voice/SKILL.md` (same author; read-only, not modified; it credits its own timing and pacing guidance to HyperFrames, Apache-2.0) | "Writing for the ear" rules and the narration script format (paragraph = scene, `[pause N]`, sparing expression tags, respell-then-fix-captions redo flow, default voice F4 and recommended male M3) | same author as agentskilldeck | `library/writing-for-the-ear.md`, `library/script-format.md`, `library/nonverbal.md`, `library/casting.md`, `library/captions.md` |
| `agentskilldeck-lab/tagtest` (results.json, spec §2.1) | the measured spoken-tag table | lab evidence | `library/nonverbal.md` |
| `agentskilldeck-lab/emotions/presets.py` | the 14 delivery presets: speed, gain, filters and every example line | lab evidence | `library/delivery.md` (values mirrored in `tools/lib/presets.mjs`) |
| `agentskilldeck-lab/voices/voices.json` | measured median pitch, pitch range and words/s per voice (same sentence, seed 0, 10 steps) | lab evidence | `library/casting.md` |
| Supertonic 3 model license (OpenRAIL-M, Attachment A) and package metadata | use restrictions, disclosure rule, language list | OpenRAIL-M (model), MIT (code) | `library/ethics-licensing.md`, `library/script-format.md` |
| HyperFrames `hyperframes-audio` / `media-use` | ideas only: voiceover carve and sidechain ducking, separate music stem, `audio_meta.json` shape | Apache-2.0 (ideas, no text copied) | `library/mixing.md`, `library/captions.md` |
| opus-sound-layer | idea: a QA gate that fails on loudness or peaks | ideas only | `library/mastering.md` |
| SoundDirector | idea: SFX aligned on onset/peak marks | ideas only | `library/mixing.md` |
| Noiz skills | idea: per-line voice, speed and emotion overrides | ideas only | `library/script-format.md` |
| danielrosehill loudness notes | idea: two-pass EBU R128 mastering | ideas only | `library/mastering.md` |
| ACX audio submission requirements | RMS −23…−18 dB, peak ≤ −3 dBFS, noise floor ≤ −60 dB, room tone, 192 kbps CBR | public specification | `library/domains.md`, `library/mastering.md` |
| Creative Commons license deeds and TASL attribution practice | CC0 / BY rules, why NC, ND and SA are refused | CC BY 4.0 (deeds) | `library/ethics-licensing.md`, `library/sound-sourcing.md` |

## careeros voice skill: instruction map

| careeros instruction | Where it lives now | Change |
|---|---|---|
| About 2.5 words per second. Short sentences. Contractions. | writing-for-the-ear, rules 1, 2 and 5; length budget table | added per-domain budgets and measured voice rates |
| Say numbers as words a person would say | writing-for-the-ear, rule 3 | added what QA normalises and examples for money, time, decimals |
| Spell out acronyms people mishear ("J W T"); keep code identifiers on screen | writing-for-the-ear, rule 4 | added URL and file-name handling |
| Read the paragraph in your head; if you run out of breath, split it | writing-for-the-ear, rule 2 ("one breath per sentence") | applied per sentence rather than per paragraph |
| Expression tags `<laugh> <breath> <sigh>` sparingly, where a person would; at most one per 30 s, never inside a drill question, never two in a row | writing-for-the-ear, rule 7; nonverbal, "Writing nonverbals that work" | extended to seven spliced tags; per voice |
| Paragraphs separated by a blank line, one paragraph per scene | script-format, "Narration-only scripts" | kept; added the `Word:` trap |
| `[pause 8]` paragraph makes 8 s of silence | script-format, cue table | now a cue usable anywhere; exempt from the 4 s silence gate |
| `# notes` lines are skipped | script-format, "Characters that never reach the engine" | not carried over: the audio format has no body comments; use `[scene:]` |
| Default voice F4; M3 as the recommended male alternative; never change the user's voice without asking | casting, voice map and rule 8; deck-voice "Before the first render" | kept |
| Voice previews of all ten voices from one sentence | casting, "Audition before you cast" (`audition.mjs`) | per line, with emotion and language options |
| Redo: respell the word for that line, re-render, set the caption word back; never edit the WAV | writing-for-the-ear, "Pronunciation"; captions, caption rules; deck-voice "Redo a line" | the content-hash cache re-renders only the changed line |
| Fallback to macOS `say`, and tell the user the voice changed | setup, "Draft fallback" | drafts are explicit (`--draft`), never a silent fallback for finals |
| Exit codes | every SKILL.md, "Exit codes" | renumbered to the plugin's 0/1/2/3 scheme |
