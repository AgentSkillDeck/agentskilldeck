# Delivery presets

Supertonic 3 has no emotion parameter. A delivery preset is a recipe: **the words you write**, then speed, gain, an EQ or compression filter, and the pause around the line. The words carry most of the emotion, so each preset below starts with a phrasing recipe. Call them delivery presets, never "emotional TTS".

Write the preset as the first word of the annotation: `ELI (scared): …`. Example lines come from the lab measurements (`docs/coverage/delivery-tuning.md`): every preset was rendered for every voice, rated by listening, then re-tuned by transcript.

## The stack

Effective speed = domain speed × cast speed × preset speed × modifier, clamped to 0.7–2.0.

- `meditation` (0.82) × `calm` (0.82) = 0.67, clamped to 0.70. Already on the floor: in a meditation, `neutral` (0.82) and `tender` (0.74) are slow enough, and `[pause N]` does the rest.
- `meditation` × `tired` (0.76) = 0.62, clamped to 0.70. Stacking slow on slow just hits the clamp; slow the words with commas and pauses instead.
- `ad` (1.1) × `excited` (1.24) = 1.36. Intelligible on short bursts, but check WER in `qa.json`.

Modifiers: `slow` ×0.9, `fast` ×1.1, `loud` +3 dB, `soft` −4 dB. Gain is applied to the line's clip before mixing; mastering sets the overall level afterwards, so relative gain between lines is what you hear.

## At a glance

| Preset | Speed | Gain | Filter | Pause before / after | Target words/s | Measured words/s | Suggested nonverbal |
|---|---|---|---|---|---|---|---|
| neutral | 1.00 | 0 dB | none | 0.10 / 0.10 s | 2.6–3.0 | 2.58 | none |
| happy | 1.08 | +1 | none | 0.05 / 0.10 | 2.9–3.3 | 2.96 | `<laugh>` |
| excited | 1.24 | +2 | none | 0.05 / 0.10 | 3.2–3.7 | 3.16 | none |
| sad | 0.79 | −3 | lowpass 6.5 kHz | 0.20 / 0.30 | 2.0–2.5 | 2.56 | `<sigh>` |
| angry | 1.02 | +3 | compressor −18 dB, 4:1 | 0.05 / 0.10 | 2.8–3.3 | 3.72 | none |
| scared | 1.18 | −1 | none | 0.10 / 0.10 | 2.9–3.5 | 2.77 | `<breath>` |
| hushed | 0.96 | −9 | highpass 250 Hz, lowpass 5 kHz | 0.20 / 0.20 | 2.3–2.7 | 2.26 | none |
| calm | 0.82 | −2 | none | 0.20 / 0.30 | 2.0–2.4 | 2.52 | none |
| surprised | 1.11 | +1 | none | 0.05 / 0.10 | 2.8–3.2 | 2.61 | `<breath>` |
| sarcastic | 0.94 | 0 | none | 0.10 / 0.15 | 2.4–2.8 | 2.74 | none |
| tender | 0.90 | −3 | lowpass 8 kHz | 0.20 / 0.30 | 2.2–2.6 | 2.57 | none |
| tired | 0.76 | −3 | none | 0.20 / 0.30 | 1.9–2.3 | 2.39 | `<sigh>` |
| authoritative | 1.01 | +1 | none | 0.10 / 0.15 | 2.4–2.8 | 2.47 | none |
| nervous | 1.04 | −1 | none | 0.05 / 0.10 | 2.9–3.4 | 3.57 | none |

Target words/s is the pace to write for, measured over the line's speech clip (words ÷ clip seconds) at domain speed 1.0. Measured words/s is what the lab line below actually gave (mean of M3 and F4, seed 0) after the speed tuning in `docs/coverage/delivery-tuning.md`. Dense lines (angry, nervous) run fast at any speed and lines full of full stops run slow, so the words set the pace as much as the preset does. The suggested nonverbal is only a suggestion: a preset never adds a nonverbal. Write the tag into the line yourself if it fits, within the one-per-30-seconds rule.

## neutral

- **When:** information, narration between emotional beats, instructions, anything where colour would distract.
- **Recipe:** complete, plain sentences. One fact each. No exclamation marks.
- **Lab line:** "The meeting starts at nine. Bring your notes."
- **Also:** `NARRATOR: The library closes at six on Fridays.`

## happy

- **When:** greetings, good news, a warm host, a reunion, the payoff of a kids' story.
- **Recipe:** exclamations on the first beat, then a short repeat ("Come in, come in!"), warm words ("oh", "the best"), optionally a `<laugh>` between two sentences.
- **Lab line:** "You made it! Oh, this is the best surprise. `<laugh>` Come in, come in!"
- **Also:** `HOST (happy): Oh, I love this one. Okay, let's do it.`

## excited

- **When:** wins, launches, ad hooks, a reveal, kids' call-and-response.
- **Recipe:** short bursts, repetition with escalation ("We won! We actually won!"), a question to pull the listener in. Keep it to two or three sentences; excitement wears out fast.
- **Lab line:** "We won! We actually won! Do you know what this means?"
- **Also:** `VO (excited): It's here. It's finally here. And it's free.`

## sad

- **When:** loss, regret, the low point of a story, a farewell.
- **Recipe:** short declaratives that stop early, ellipses where the voice would fail, a detail instead of a feeling ("She kept the light on"). A `<sigh>` at the start, never mid-word.
- **Lab line:** "`<sigh>` She kept the light on for him. Every night. He never came home."
- **Also:** `MAYA (sad): I kept your letters... all of them.`

## angry

- **When:** confrontation, refusal, a villain, a turning point.
- **Recipe:** fragments as full stops ("Not now. Not ever!"), direct address ("You don't get to…"), repetition, one exclamation at the end. Never swearing as a substitute for structure.
- **Lab line:** "No. You don't get to walk in here and tell me what to do. Not now. Not ever!"
- **Also:** `ELI (angry): You lied. To me. To all of us.`

## scared

- **When:** danger, suspense, the moment before a reveal.
- **Recipe:** fragments, repeated starts ("I didn't... I didn't"), a breath before, questions, commands of one or two words ("Don't. Move."). Put `<breath>` first on the line so it is spliced before the speech. The steady voices (M3, M5) can swallow two one-word sentences in a row (tuning heard "Don't. Move." as "Dove"), so for them write "Don't move" or "Don't... move" instead.
- **Lab line:** "`<breath>` Did you hear that? Something's outside. Don't. Move."
- **Also:** `KID (scared): Is it... is it under the bed?`

## hushed

- **When:** secrets, sleeping children, sneaking, an aside to the listener, an ASMR-style intro.
- **Recipe:** short imperative sentences, "quietly", "keep your voice down". The filter thins and quiets the voice (−9 dB), so keep the words simple. Hushed is a quiet voice, not a true whisper; Supertonic cannot whisper.
- **Lab line:** "Keep your voice down. They're asleep upstairs. Follow me, quietly."
- **Also:** `MAYA (hushed): Not here. Meet me by the boats.`

## calm

- **When:** meditation, reassurance, de-escalation, the steady voice in a crisis, closing a lesson.
- **Recipe:** imperative breathing language, full stops between actions ("Hold it. And let it go."), second person, present tense. Add `[pause N]` cues for real stillness rather than slowing the speed further.
- **Lab line:** "Breathe in slowly. Hold it. And let it go. You are safe here."
- **Also:** `GUIDE (calm): Notice your feet on the floor. That's all. Just notice.`

## surprised

- **When:** a twist, an unexpected guest, a plot reveal, "wait, what?" moments in a podcast.
- **Recipe:** a breath, then a short question ("Wait, what?"), then the reason in a full sentence with the key fact last ("You were gone for ten years!").
- **Lab line:** "`<breath>` Wait, what? That's impossible! You were gone for ten years!"
- **Also:** `CO_HOST (surprised): Hang on. That was in nineteen ninety?`

## sarcastic

- **When:** dry humour, a jaded character, a podcast aside, comic relief.
- **Recipe:** an overly positive opener ("Oh, great."), a flat factual middle, a modern understatement to close ("Love that for us."). The words do all the work; the engine has no sarcastic tone, so a sarcastic line must read as sarcastic on paper.
- **Lab line:** "Oh, great. Another meeting that could have been an email. Love that for us."
- **Also:** `TEEN (sarcastic): Wow. A whole hour of chores. Best Saturday ever.`

## tender

- **When:** comfort, love, bedtime, an apology, a parent to a child.
- **Recipe:** short reassurances, "hey" and the listener's name, promises in plain words ("I'm right here"), no exclamations. The lowpass softens the edge.
- **Lab line:** "Hey. It's okay. I'm right here, and I'm not going anywhere."
- **Also:** `MUM (tender): Sleep now, little one. The stars will keep watch.`

## tired

- **When:** the end of a long day, exhaustion, a burnt-out mentor, comic weariness.
- **Recipe:** repetition that sags ("Long day. Long, long day."), an ellipsis, a plain wish ("I just need to sit down"), a `<sigh>` first.
- **Lab line:** "`<sigh>` Long day. Long, long day. I just need to sit down for a minute."
- **Also:** `DETECTIVE (tired): Three nights. No sleep. And still no name.`

## authoritative

- **When:** training playbooks, safety steps, a commander, a documentary voice, a course intro.
- **Recipe:** "Listen carefully." as an opener, numbered steps said aloud ("Step one:"), imperative verbs first, no hedges ("try to", "maybe"), a clear closing instruction ("Then report back.").
- **Lab line:** "Listen carefully. Step one: shut down the main valve. Step two: check the pressure. Then report back."
- **Also:** `TRAINER (authoritative): Gloves on. Goggles on. Now, and only now, open the panel.`

## nervous

- **When:** asking someone out, a job interview scene, a confession, a junior employee, comic awkwardness.
- **Recipe:** fillers ("um", "I mean", "I don't know"), self-corrections, hedges, a question at the end. Whisper often leaves "um" out of its transcript, and each dropped filler counts against the 15% WER limit, so keep to one or two fillers in a line of fifteen words or more.
- **Lab line:** "So, um, I was wondering, if you're not busy, maybe we could, I don't know, get coffee?"
- **Also:** `INTERN (nervous): I, um, I think I broke the build. Maybe. A little.`

## Choosing between neighbours

| If you mean | Use | Not |
|---|---|---|
| quiet because of danger | scared + `soft` | hushed (too composed) |
| quiet because of intimacy | tender | hushed (too thin) |
| loud joy | excited | happy + `loud` (still mid-energy) |
| firm but kind | authoritative + `slow` | angry |
| relieved | happy + `slow`, or calm | there is no relieved preset |
| whispered | hushed, written as a whisper would be | there is no whisper; `<whisper>` is read aloud |

Speeds were tuned by measurement (words/s and transcript checks on M3 and F4, see `docs/coverage/delivery-tuning.md`); owner listening can still move any of them. Speed and gain values above match `tools/lib/presets.mjs`; if a tuning pass changes them, this guide changes with them.
