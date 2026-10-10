# Captions, timeline and video hand-off

Every render writes timing data alongside the audio, so a video tool, a player or a reader can follow along.

## Files

| File | Contents |
|---|---|
| `captions.srt`, `captions.vtt` | speaker-labelled captions, split at word boundaries using word timestamps |
| `timeline.json` | `{version: 1, title, duration_s, scenes, lines, cues, assets}`; each line has `id, speaker, voice, emotion, text, start, end, words[{w, start, end}]` |
| `audio_meta.json` | HyperFrames shape: `voices[{id, path, duration_s, words[{text, start, end}]}]`, `sfx[{id, path, start}]`, `bgm` (`{path}` or null), `total_duration_s` |

Times are seconds from the start of `mix.wav`, which includes the lead.

## Caption rules

- At most **42 characters per line** and **2 lines per caption**. The broadcast norm; readable on phones.
- Breaks fall between words, never inside one, timed by the whisper word timestamps from the QA pass.
- **Speaker labels** on: `ELI: Did you hear that?`. A narrator-only piece still gets labels; strip them for the user if they want plain captions.
- Nonverbals do not appear in captions.
- Caption text is the script text, not the transcript. If a word was respelled for pronunciation, correct its spelling in both caption files and the `timeline.json` line text afterwards. Never change times.
- `--no-qa` and draft renders have no transcript, so word timing there is not final. Re-render as a final before delivering captions.

Domains with captions off by default (audiobook, meditation) still get the files; the setting only signals whether they are expected deliverables.

## Scenes and chapters

`[scene: Name]` cues become `scenes[{name, start}]`. Use them as chapters in a podcast app, slide changes in a lesson, steps in a playbook, or cuts in a video. A narration-only script gets one line per paragraph; add `[scene:]` cues between paragraphs if a video needs named scenes.

## For video (HyperFrames)

`audio_meta.json` is what the video plugin reads: voice clip paths with word timings for karaoke captions and lip-sync, SFX starts for visual hits, and the music bed as a separate file so the editor can re-balance it. Use the `video` preset for voiceovers: music on its own stem, −14 LUFS.

For animation, use the per-speaker stems (`stems/dialogue-<speaker>.wav`) and the `lines[].words` timings for each character's mouth.
