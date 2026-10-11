# Your own voice: recorded lines and free local cloning

A user can put their own voice in a piece in two ways, both free and on their machine:

| | Recorded lines (`voice: record`) | Clone (`voice: clone:<name>`) |
|---|---|---|
| What you hear | the user's real performance, line by line | Supertonic speech converted to the user's timbre |
| The user reads | every line of that character | one 10–60 s reference paragraph, once |
| Edit a line later | re-record that line | edit the text and re-run produce |
| Extra install | none | the clone engine (`setup.mjs --install-clone`, about 2.6 GB, asked once) |
| Best for | a personal message, a host intro, a few lines | a long narration or many lines in the user's voice |

Consent comes first in both: see [Consent](#consent).

## Ask before the microphone

Never open the microphone without asking. Say what will happen, then offer the two ways in:

> I can put your own voice on ME's lines. Either you record them now with your microphone (I'll show each line; it stops by itself when you pause), or you give me audio you already have (wav, mp3, m4a, aac, flac or ogg) and I'll cut it into the lines. Which do you prefer?

- macOS asks for microphone permission for the terminal app the first time. If recording fails, the user allows it in System Settings > Privacy & Security > Microphone and tries again.
- A live recording needs the user at a terminal to read the lines as they appear; `record.mjs` refuses live capture without one (an agent's shell has no terminal). Give them the exact command (absolute paths) to run in their own terminal. Run `--from` imports yourself.
- `node scripts/record.mjs --list-devices` lists microphones; pass `--device <id>` to choose one (required on Windows).

## Consent

Every recording and every clone needs one typed statement, stored with the audio:

- `This is my own voice`
- `I have the speaker's consent: <name>`

Ask the user to type it themselves, then pass it word for word with `--consent "<statement>"` (or they type it at the prompt when running the command in their terminal). Never type it on their behalf, never invent a name, and do not proceed if they cannot give it. The statement is stored in `<out>/recordings/consent.json` (recorded lines, per speaker) or `~/.agentskilldeck/voices/<name>/consent.json` (clones). Each file also records how it was given (`"via": "flag"` or `"prompt"`) and when. This is a recorded attestation by the user, not a verification: the tools cannot check who typed it or whether the named person really agreed. `produce.mjs` refuses a `record` speaker or a clone without it (exit 1). Cloning a voice without the owner's consent, or presenting a clone as someone who did not agree, is never allowed ([ethics-licensing](ethics-licensing.md)).

## Recorded lines

1. Cast the speaker as `ME: { voice: record }`.
2. Record, with the same `--out` that produce will use:

```sh
# live, line by line (the user runs this in their terminal)
node scripts/record.mjs /abs/script.audio.md --speaker ME --out /abs/out/final --consent "This is my own voice"
# live, all lines in one go
node scripts/record.mjs /abs/script.audio.md --speaker ME --out /abs/out/final --one-take
# from a file: one line, or every line in one take
node scripts/record.mjs /abs/script.audio.md --speaker ME --out /abs/out/final --line 8 --from /abs/me-line8.m4a
node scripts/record.mjs /abs/script.audio.md --speaker ME --out /abs/out/final --one-take --from /abs/me-all.wav
```

3. `node scripts/produce.mjs /abs/script.audio.md --out /abs/out/final` uses the recordings in place of synthesis. Timeline, captions from the transcript's word times, stems, mix, master and QA are unchanged.

What record.mjs does with each take: trims the silence at both ends (keeping a little air), applies a light denoise (`afftdn`) and an 80 Hz highpass, sets the level to −20 LUFS, transcribes it and compares it with the line (the same check as QA: word error rate 0.15 for English). Files go to `<out>/recordings/<line-id>.wav` (the line id is `L` + the script line number) and `recordings.json` (path, duration, WER, transcript, consent). In the mix a recorded line sits 6 dB lower, level with the synthetic voices.

- **Live line by line:** each line is shown with its nonverbals as directions, e.g. `(laugh) Good morning, Eli.`; perform them yourself. Recording stops after 1.2 s of silence following speech, on Enter, or after 30 s. A take that fails the check can be re-recorded, kept (`k`) or skipped.
- **One take:** read all of the speaker's lines in order, pausing between them. The take is cut at the transcript's word times, aligned to the script word by word, so a misread or an "um" only affects its own line. Lines over WER 0.15, or not heard at all, are listed.
- **Fixing lines:** exit 3 lists the failed lines and the exact command to redo them (`--line 8,10`). `--keep-failed` keeps a take that differs from the script on purpose. If the user edits a recorded line's text, produce asks for it to be recorded again.
- **Delivery:** emotions and speed presets do not apply to a real performance; the pause timing around the line does.

## Clone voices

1. Record a reference once (10–60 s of natural speech; longer is cut at 60 s):

```sh
node scripts/record.mjs --reference --name me --consent "This is my own voice"          # live: reads a ~45 s paragraph
node scripts/record.mjs --reference --name me --from /abs/voice-memo.m4a --consent "..."   # from a file
```

It stores `~/.agentskilldeck/voices/me/` with `reference.wav`, `consent.json` and `voice.json` (base voice, median pitch, duration). `--force` replaces an existing reference.

2. Cast `ME: { voice: clone:me }` and render with produce as usual. The first render needs the clone engine: ask once, then `node scripts/setup.mjs --install-clone` ([setup](setup.md)).

How it works: each line is synthesised by Supertonic with the clone's **base voice** (the preset nearest the reference's median pitch, chosen at reference time; `clone:me@F2` forces another), then Chatterbox voice conversion (Resemble AI, MIT) gives it the reference's timbre. Words, timing and delivery come from Supertonic, so delivery presets and the native laugh still work (the base voice's row in the native-tag table applies). QA, retakes and the timeline run on the converted audio. One converter process serves the whole render (take 0, every retake round and any nonverbal fallback), so the model loads once, in about 30 s; conversion then takes about 2 s per second of audio on an M-series Mac. Converted takes are cached like any other take: re-running an unchanged script starts no converter. To preview a clone, render a one-line script with it.

- Every converted line carries Resemble's PerTh imperceptible watermark. It stays on.
- `CREDITS.md` names Chatterbox and each cloned voice, with whose consent.
- A reference works best as clean, close, natural speech in a quiet room: no music, no other voices, no heavy processing. The converter uses the first 10 s of it.
- Drafts (`--draft`) use the system voice and skip the conversion.
