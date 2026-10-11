# Ethics, licensing and disclosure

Read this before producing anything that will be published, sold or played to people who did not ask for it.

## The voice model: Supertonic 3

- The code is MIT. The model weights are under **OpenRAIL-M**, a responsible-AI license with use restrictions that travel with every output and derivative. License text: https://huggingface.co/Supertone/supertonic-3/blob/main/LICENSE
- Use restrictions, in short. Do not use the model or its output:
  - to break any law;
  - to exploit or harm minors;
  - to spread verifiably false information meant to harm others, or personal information that can be used to harm someone;
  - to defame, disparage or harass;
  - to **impersonate a real person** (deepfakes) without their consent;
  - for fully automated decisions that harm someone's legal rights;
  - to discriminate, or to exploit a vulnerable group in a way that causes harm;
  - to **give medical advice** or interpret medical results;
  - for justice, law-enforcement, immigration or asylum profiling.
- The license also bars placing generated content in any context **without clearly disclosing that it is machine generated**. Treat disclosure as required for anything published.
- Credit Supertonic in `CREDITS.md` (written automatically) and keep that credit with the published audio.

## Real voices: only with consent, never impersonation

- The ten voices are synthetic presets, not people. Never present one as a real, named person ("read by Morgan Freeman", "a message from our CEO") unless that person recorded it.
- Do not write a script that puts words in a real person's mouth, in any context, without their documented consent. Parody needs to be unmistakable and still disclosed.
- **The user's own voice** ([your-voice](your-voice.md)): recorded lines (`voice: record`) and local clones (`voice: clone:<name>`) need a typed statement, "This is my own voice" or "I have the speaker's consent: <name>", stored with the audio. The user types it; the agent never types it for them or invents a name. produce refuses a recorded speaker or a clone without it.
- **Never clone a voice whose owner did not agree**: a celebrity, a politician, a colleague, a family member who was not asked, a voice taken from a video. Refuse, explain why, and offer the closest preset by traits (see [casting](casting.md)). The same holds for a recording of someone else's voice imported with `--from`.
- A clone is AI-generated speech in a real person's voice. Disclose it like any synthetic voice, and never use it to make the person appear to say something they would not agree to. Chatterbox (MIT, Resemble AI) marks every converted line with the PerTh imperceptible watermark; keep it, and keep the clone credit in `CREDITS.md`.
- Recorded lines are the speaker's real performance: credit them as such ("ME: recorded by the speaker").

## Disclosure by domain

| Domain | What to disclose and where |
|---|---|
| audiobook | Most stores require AI narration to be declared at upload. Say "Narrated by a synthetic voice" in the credits and metadata. |
| ad | Platform and advertising rules increasingly require synthetic-voice disclosure; put it in the ad copy or description. Never imply a real endorser. |
| podcast | Say it in the show notes, and once in the episode if hosts are synthetic. |
| education, playbook | Note it in the course or document credits. For safety procedures, the organisation's approved text must be used word for word. |
| kids | Disclose to the parent or teacher. Never generate a synthetic voice that claims to be the child's real parent, teacher or a real person. |
| meditation | Credits and description. Do not present it as therapy or medical treatment. |
| video | Credits or description, plus the platform's AI-content label where it exists. |

A short disclosure line that works everywhere: "Voices generated with Supertonic 3, a synthetic text-to-speech model." With a clone: "Includes an AI clone of <name>'s voice, made with their consent."

## Sounds and music

- Only CC0, Public Domain (Mark) and CC BY 3.0/4.0 are used (see [sound-sourcing](sound-sourcing.md)). NC (NonCommercial), ND (NoDerivatives) and SA (ShareAlike) are refused: a mixed piece is a derivative, and commercial use must stay possible.
- **CC0 and public domain:** no credit required. The pipeline still credits them, which is good practice.
- **CC BY:** the credit is a condition of the license. Keep `CREDITS.md` with the audio, and copy its lines into the description, show notes or end credits wherever it is published. The format is title, creator, source and license (TASL): `"Heavy rain" by J. Doe (https://…), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)`.
- Generated beds (ffmpeg noise, room tone, tones) need no attribution.
- User-supplied files (`[sfx: ./my-sound.wav]`) are the user's responsibility. Ask where they came from if it is unclear and the piece will be published.
- Licenses in search results come from third parties. If a result looks mislabelled, skip it.

## Text

- Use original writing, the user's own text, or public-domain text (for example the Sherlock Holmes stories, all public domain in the US; check the rules where the piece will be published). Do not voice copyrighted books, articles or lyrics without the rights holder's permission.
- Health, legal and financial content: explain, do not advise. Add "This is general information, not advice" where a listener might act on it.

## Credits in this plugin

Writing-for-the-ear and script rules are adapted from the careeros voice skill (same author). Mixing ideas (voiceover carve, ducking, the loudness gate, SFX peak marks, two-pass loudness) come from HyperFrames, opus-sound-layer, SoundDirector and other public projects, credited in `docs/coverage/audio-sources.md` and the repository NOTICE.
