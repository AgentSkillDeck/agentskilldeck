# Writing for the ear

Adapted from the careeros voice skill ("Writing for the ear" and its script-format rules, same author), extended here for multi-voice, multi-domain audio. Credited in `docs/coverage/audio-sources.md`.

The listener cannot re-read, see a heading or skim back. The words carry most of the emotion too: Supertonic has no emotion control, so a flat sentence stays flat whatever preset you pick. Write the script so that a stranger reading it aloud cold would perform it right.

## The seven rules

1. **About 2.5 words per second.** That is the pace of a clear narrator with natural pauses. Budget the script before writing it (table below). The voices run 2.75–3.47 words/s at speed 1.0 (see [casting](casting.md)); the domain preset and gaps bring the finished piece down toward 2.5.
2. **One breath per sentence.** Read each sentence in your head at speaking pace. If you run out of breath, split it. Most sentences land at 6–15 words; a 25-word sentence is a paragraph in disguise.
3. **Numbers as spoken words.** Write what a person says: "about two hundred milliseconds", "twenty twenty-six", "three point five percent", "nine thirty", "four ninety-nine". QA only expands plain English numbers up to one hundred and four-digit years, so anything else written as digits can fail the transcript check.
4. **Spell the acronyms people mishear.** "J W T", "S Q L", "A P I". Acronyms that are words stay as words (NASA, scuba). Keep code identifiers, URLs and file names on screen, not in the voice; if one must be said, say a short form: "agentatelier dot com".
5. **Contractions and plain words.** "It's", "don't", "we'll". "Use", not "utilise". Spoken English is looser than written English, and stiffness reads as robotic.
6. **No symbols, and no asterisks for emphasis.** `/ & % @ # * _ ( ) [ ] |` are stripped or misread. Write "and", "percent", "at". Turn parentheses into a comma or a new sentence. A word in asterisks (`*really*`, `**never**`) is treated as a stage direction and **dropped from the line** with a warning, so the sentence loses that word. Get emphasis from word order and punctuation instead: put the key word last ("Not once. Never."), give it its own short sentence, or repeat it.
7. **Nonverbals: at most one per 30 seconds per voice, never two in a row.** A breath before a turn in the argument. A small laugh after a light line. A sigh on a pain everyone knows. Never glued to a word, never inside a quiz question or drill. Details in [nonverbal](nonverbal.md).

## Length budget

| Length | Narration (2.5 w/s) | Ad (about 2.9 w/s at speed 1.1) | Meditation (about 1.6 w/s with pauses) |
|---|---|---|---|
| 15 s | 35 words | 40 words | 25 words |
| 30 s | 75 words | 85 words | 50 words |
| 60 s | 150 words | 170 words | 95 words |
| 5 min | 750 words | n/a | 480 words |
| 20 min chapter | 3,000 words | n/a | n/a |

Pauses, gaps and nonverbals add time. For a fixed-length piece (ads, video voiceover) draft, render with `--draft`, read `duration_s` in `timeline.json`, then cut words rather than speeding the voice past 1.15.

## Punctuation is direction

| Mark | What the engine does with it | Use it for |
|---|---|---|
| `.` | full stop, pitch falls | finality, authority, fragments for fear and anger |
| `,` | short break | lists, a breath in a long thought, hesitation |
| `...` | trailing hesitation | sadness, tiredness, a thought that drifts |
| `?` | rise | real questions; rhetorical ones sound like real ones |
| `!` | more energy | excitement, alarm. One per turn; three in a row sounds shouty |

Dashes, semicolons and colons are invisible to the ear. Rewrite them as a comma or a full stop.

## Sentence shape

- **Front-load the subject.** "The valve must be closed before you start" beats "Before you start, and only after checking the gauge, the valve must be closed."
- **End on the word that matters.** Stress falls at the end of a spoken sentence. "Ten years. You were gone for ten years." The repeated phrase lands the number.
- **Signpost.** "Three things." "First." "Second." "Last one." Readers see a list; listeners need to be told one is coming.
- **Repeat the key term.** Synonyms that help a reader ("the device", "the unit", "it") confuse a listener. Pick one name and keep it.
- **One idea per sentence, one scene per paragraph.** In narration mode each paragraph is one line and one beat of thought.

## Dialogue

- Turns of one to three sentences. People interrupt, trail off and answer questions with questions.
- In audio-only pieces, say names now and then ("Maya, wait.") so the listener knows who is speaking and to whom.
- Give each character a verbal habit: one says "Look," before every point; one never finishes a sentence; one speaks only in short commands. Pitch contrast does the rest (see [casting](casting.md)).
- Write the emotion into the words first, then pick the preset. `(angry)` on "I am upset with you." still sounds polite.

## Before and after

| Written for the eye | Written for the ear |
|---|---|
| The API returns a 429 status when >100 req/min are sent. | Send more than a hundred requests a minute and the A P I says "slow down". That's error four twenty-nine. |
| Lockout/tagout (LOTO) must be completed prior to maintenance. | Before you touch the machine, lock it out and tag it. Every time. |
| Revenue grew 23.5% YoY to $4.2M. | Revenue grew by almost a quarter this year, to four point two million dollars. |
| She was scared, and she whispered that she had heard something outside. | `MAYA (scared): <breath> Did you hear that? Something's outside.` |
| (Note: results may vary.) | Your results may be different. |

## Pronunciation

- Audition names and jargon first: `node scripts/audition.mjs "Siobhan reads the Kubernetes log." --voices F4,M3 --out out/audition`.
- If a word is mispronounced, try a nearby phrasing first. If the word must stay, respell it for that line only ("Kubernetes" as "koo-ber-net-eez"). QA compares the transcript with the respelled text, so it still passes. Afterwards, correct the spelling in `captions.srt`, `captions.vtt` and the line text in `timeline.json`; never touch the timings or the audio by hand.

## Final read-through checklist

- [ ] Word count fits the length budget.
- [ ] Every sentence passes the one-breath test.
- [ ] No digits beyond simple numbers, no symbols, no parentheses, no `*asterisk*` emphasis.
- [ ] Acronyms spelled where they would be misheard.
- [ ] Each emotional line would work without its preset.
- [ ] Nonverbals: none within 30 s of another for the same voice, none adjacent, all separated by spaces.
- [ ] Each speaker's turns are short and sound like that person.
