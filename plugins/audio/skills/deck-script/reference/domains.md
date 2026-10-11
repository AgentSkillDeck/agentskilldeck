# Domain presets and structure templates

Pick one preset per piece with `preset:` in the front matter (or `--preset`). The preset sets the pace, the gap between lines, the music behaviour, the loudness target and whether captions are on. The templates below give a structure that works for each domain, with lines you can adapt.

| Preset | Speed | Gap | Lead / tail | Music | Duck | Loudness target | Captions |
|---|---|---|---|---|---|---|---|
| education | 1.00 | 0.5 s | 0.5 / 1.0 s | bed | −12 dB | −16 LUFS, −1 dBTP | on |
| audiobook | 0.95 | 0.6 s | 0.75 / 2 s, room tone throughout | none | none | ACX: RMS −23…−18 dB, peak ≤ −3 dBFS, noise floor ≤ −60 dB | off |
| drama | 1.00 | 0.25 s | 0.5 / 1.0 s | scored | −12 dB | −16 LUFS, −1 dBTP | on |
| podcast | 1.03 | 0.3 s | 0.3 / 0.5 s | stinger | −12 dB | −16 LUFS, −1 dBTP | on |
| playbook | 0.95 | 0.7 s | 0.5 / 1.0 s | none | none | −16 LUFS, −1 dBTP | on |
| ad | 1.10 | 0.2 s | 0.2 / 0.3 s | bed | −10 dB | −14 LUFS, −1 dBTP | on |
| meditation | 0.82 | 1.2 s | 1.0 / 2.0 s | bed | −14 dB | −20 LUFS, −1 dBTP | off |
| kids | 0.92 | 0.5 s | 0.5 / 1.0 s | bed | −12 dB | −16 LUFS, −1 dBTP | on |
| language | 0.80 | 1.0 s | 0.5 / 1.0 s | none | none | −16 LUFS, −1 dBTP | on |
| video | 1.00 | 0.45 s | 0.3 / 0.5 s | bed (separate stem) | −12 dB | −14 LUFS, −1 dBTP | on, plus `audio_meta.json` |

The gap is the silence between lines; a `[pause N]` replaces it. Lead and tail are silence (or room tone) before the first and after the last line.

## education (lessons, explainers, courses)

**Structure: hook → three points → recap.**

```
[scene: Hook]
NARRATOR (excited): Your body has a memory. And it remembers things you've never even noticed.
[scene: Point one: the visitor]
NARRATOR: When a germ gets in, your immune system studies its shape.
[scene: Point two: the training]
NARRATOR: A vaccine shows your body that shape first, without the illness.
[scene: Point three: the memory]
NARRATOR: Memory cells keep the pattern for years. Sometimes for life.
[scene: Recap]
NARRATOR (calm): So. Shape, training, memory. That's how a vaccine works.
```

- One idea per scene; each `[scene:]` becomes a chapter in `timeline.json` and the captions.
- A question in the hook, an answer in the recap.
- Explain; do not advise. Supertonic's model license bars medical advice (see [ethics-licensing](ethics-licensing.md)).
- Low music bed, or none for dense material.

## audiobook

**Structure: chapter head → paragraphs, with room tone under everything.**

```
[scene: Chapter one. A Scandal in Bohemia]
NARRATOR: Chapter one. A Scandal in Bohemia.
[pause 1.5]
NARRATOR: To Sherlock Holmes she is always the woman.
```

- One narrator; characters may have their own voices, but most audiobooks keep dialogue in the narrator's voice with a preset change.
- Say the chapter title aloud; ACX expects it.
- The preset adds room tone: a generated low noise bed (never a searched sound) that runs from 0 s under the whole piece, including the 0.75 s head and 2 s tail, so pauses never drop to digital silence. It masters to ACX: RMS −23…−18 dB, peak ≤ −3 dBFS, noise floor ≤ −60 dB, constant 192 kbps mp3. One file per chapter.
- No music, no SFX. Disclose AI narration where the store requires it.
- Long chapters (5,000 words and up) render in batches; that is expected.

## drama (audio drama, animation voice tracks)

**Structure: cold scene → inciting line → escalation → turn → button.**

```
[scene: Lighthouse, night]  [ambience: sea waves, wind | low]
NARRATOR: The lamp had burned for forty years.
ELI (scared): <breath> Did you hear that?
[sfx: wooden door creak]
MAYA (hushed): Don't. Move.
[pause 1.5]
MAYA (happy, slow): <laugh> It's only the wind.
[music: swell]
```

- Short turns and a 0.25 s gap keep the scene moving. Use `[pause]` for the beats.
- Ambience in every scene; one SFX per action; music under the turn and the button.
- Per-speaker dialogue stems come out in `stems/`, for animators to lip-sync each character.
- Cast with pitch contrast (see [casting](casting.md)).

## podcast

**Structure: cold open → intro stinger → segments → outro.**

```
[scene: Cold open]
SAM (surprised): Wait. You're telling me octopuses have three hearts?
JO (happy): Three hearts. And blue blood. <laugh>
[music: start]
[pause 2]
[music: out]
[scene: Intro]
JO: Welcome to Small Wonders. I'm Jo.
SAM: And I'm Sam. Today: the octopus.
[scene: Segment one]
```

- The cold open is the best 10–20 s of the episode, played before the intro.
- Two to four hosts, each with a habit (one asks, one explains).
- Front matter `music:` holds the stinger; `[music: start]` then `[music: out]` around the intro gives a 3 s fade. Without any music cue, a front-matter bed plays under the whole episode, which is rarely what a podcast wants.
- Banter needs reactions: short lines like "No way." and "Right?" between long ones.

## playbook (training, procedures, safety)

**Structure: purpose → numbered steps with confirm pauses → check → close.**

```
[scene: Purpose]
TRAINER (authoritative): This is the lockout procedure for line three. Follow every step, in order.
[scene: Step one]
TRAINER: Step one. Tell everyone in the area you're shutting the machine down.
[pause 2]
[scene: Step two]
TRAINER: Step two. Switch off at the main isolator. Then lock it, and tag it with your name.
[pause 3]
TRAINER (authoritative, slow): Check. Try to start the machine. It must not move.
```

- Say step numbers aloud; each step is its own scene, so the timeline lists the steps.
- After each step, a `[pause 2]` or `[pause 3]` gives the listener time to do it. Pauses over 4 s pass QA only when they are written as `[pause N]`.
- Imperative verbs first, one action per sentence, no nonverbals, no music.
- Repeat the critical warning at the end.

## ad (promo, 15/30/60 s)

Beat sheets (at about 2.9 words/s):

| Length | Beats | Words |
|---|---|---|
| 15 s | hook (3 s) → benefit (8 s) → call to action (4 s) | about 40 |
| 30 s | hook (4 s) → problem (6 s) → product (10 s) → proof (5 s) → call to action (5 s) | about 85 |
| 60 s | hook (5 s) → problem (10 s) → product (20 s) → two proofs (15 s) → offer and call to action (10 s) | about 170 |

```
VO (excited): Still typing meeting notes by hand?
VO: Notely listens, writes the summary, and sends it before you're back at your desk.
VO (authoritative): Try it free for thirty days. Notely dot app.
```

- Render with `--draft` and check `duration_s` against the slot; cut words, never rush the voice.
- Upbeat bed, −14 LUFS. No unverifiable claims; disclose the synthetic voice where the platform requires it.

## meditation

**Structure: arrive → breath counting → body scan or image → return.**

```
[ambience: soft rain | low]
GUIDE (calm): Find a comfortable position. Let your eyes close.
[pause 3]
GUIDE (calm): Breathe in, two, three, four.
[pause 4]
GUIDE (calm): And out, two, three, four.
[pause 4]
```

- Pace by breath counts: one count per second, the pause matches the count.
- Ambience runs under the silences, so long pauses never sound like dead air. Pauses over 4 s are fine when written as `[pause N]`.
- Calm is already near the 0.7 speed floor at this preset; slow down with pauses, not speed.
- −20 LUFS: meditation should be quieter than speech content.

## kids (stories, songs, learning)

**Structure: invitation → story beats with call-and-response → gentle close.**

```
NARRATOR (happy): Can you roar like a lion? Ready? One, two, three!
[pause 2]
LEO (excited): ROAR! That was a good one!
NARRATOR (tender): And now, little lion, it's time to sleep.
```

- Call-and-response: a question, then a 2 s pause for the child, then the answer.
- Bright character voices (F2, M1), warm narrator (F3), playful SFX, light music.
- Repetition is a feature: a refrain every three or four beats.
- Capitals do not make a shout; the engine reads `ROAR` and `roar` the same. The preset and the exclamation mark do the work.

## language (learning and drills)

**Structure: phrase → pause → repeat → gloss.**

```
---
preset: language
lang: en
cast:
  TUTOR: { voice: F4 }
  NATIVE: { voice: F1, lang: es }
---
TUTOR: How to order a coffee.
NATIVE (neutral, slow): Un café, por favor.
[pause 3]
NATIVE (neutral, slow): Un café, por favor.
[pause 3]
TUTOR: A coffee, please.
```

- Target phrase twice with a repeat-after-me pause, then the gloss in the learner's language.
- Put `lang:` on the cast entry (or per line: `NATIVE (calm, lang: fr): …`). Any non-English line switches QA to the multilingual whisper model with a 30 % WER limit.
- No music, no nonverbals; 0.8 speed is deliberate.

## video (HyperFrames voiceover)

**Structure: one paragraph or line per scene of the video.**

```
NARRATOR: Every team has a meeting that could have been an email.
[scene: Problem]
NARRATOR: The notes get lost. The decisions get forgotten.
[scene: Solution]
NARRATOR: So we built a tool that remembers for you.
```

- Narration-only scripts work well: each paragraph becomes a scene.
- Music comes out as a separate stem, so the video editor can mix it again.
- `audio_meta.json` holds voice paths, word timings, SFX and bed for HyperFrames; `timeline.json` has the scenes. See [captions](captions.md).
