# Casting the ten voices

Supertonic 3 ships ten preset voices: F1–F5 and M1–M5. None is a real person, and none may be presented as one (see [ethics-licensing](ethics-licensing.md)). The user's own voice, recorded or cloned with consent, is the only real voice a piece may carry ([your-voice](your-voice.md)). Every voice can speak every supported language; audition a line in the target language before casting a non-English piece.

## The voice map (measured)

All ten voices read the same sentence at seed 0, `total_steps` 10, speed 1.0. Median pitch and pitch range come from a pitch track of each clip; words/s is words ÷ clip length.

| Voice | Median pitch | Pitch range | Words/s | Character | Cast as |
|---|---|---|---|---|---|
| F1 | 188 Hz | 63 Hz | 2.84 | mid female, moderate movement, even pace | everyday characters, a friendly teacher, second podcast host |
| F2 | 207 Hz | 116 Hz | 3.03 | brightest and most expressive voice | kids' heroes, excitable characters, happy and surprised lines, ad hooks |
| F3 | 179 Hz | 83 Hz | 2.75 | warm mid-low female, slowest of all | tender and calm parts, bedtime narrator, meditation guide |
| F4 | 196 Hz | 83 Hz | 3.33 | clear, bright, brisk | default narrator, lessons, explainers, video voiceover |
| F5 | 158 Hz | 42 Hz | 2.94 | lowest and flattest female | authority, documentary, a cool or stern character, playbooks |
| M1 | 141 Hz | 108 Hz | 2.84 | highest and liveliest male | young men, comic roles, an enthusiastic host, kids' sidekick |
| M2 | 89 Hz | 109 Hz | 2.90 | deep and expressive | dramatic leads, villains, a storyteller with range |
| M3 | 96 Hz | 28 Hz | 3.47 | deep, steady, quickest | recommended male narrator, procedures, news-style reads |
| M4 | 120 Hz | 51 Hz | 3.04 | mid male, moderate movement | everyman roles, co-host, the colleague |
| M5 | 89 Hz | 29 Hz | 2.85 | deep and steady, unhurried | calm authority, audiobook narrator, meditation, an elder |

Reading the table:
- **Pitch range is expressiveness.** Over 100 Hz (F2, M1, M2) the voice moves; use it for emotional and comic lines. Under 45 Hz (F5, M3, M5) it holds steady; use it for instructions and calm.
- **Words/s differs by up to 25 %.** M3 (3.47) and F4 (3.33) are brisk; F3 (2.75) is slow. To even a pair out, set a cast speed: `M3: { voice: M3, speed: 0.92 }` brings M3 near 3.2.
- **Gender of the nonverbal sample follows the voice letter.** M voices get male breaths and gasps, F voices female. In the default `auto` mode a laugh is the voice's own; every other nonverbal is a sample ([nonverbal](nonverbal.md)).

## Casting rules

1. **One narrator per piece.** The narrator is the listener's anchor. Switching narrators mid-piece reads as a mistake. Audiobooks: one narrator; character voices are allowed for dialogue.
2. **Contrast pitch between scene partners.** Two characters who speak to each other need clearly different voices: cross gender, or at least about 30 Hz apart in median pitch. M2 and M5 (both 89 Hz) in the same scene blur together; M1 (141) against M5 (89) does not.
3. **Pair a steady voice with an expressive one.** For same-gender pairs: F5 with F2, M3 with M1, M5 with M2. The difference in pitch range reads as personality.
4. **Narrator apart from characters.** Pick the narrator's voice first, then cast characters away from it. With an F4 narrator, prefer F2, F5 or male voices for characters.
5. **Reuse only for small parts that never meet.** Ten voices are the limit. A guard in scene one and a waiter in scene five can share M4, with a different preset and a cast speed of 0.95 or 1.05.
6. **Kids' pieces:** bright voices (F2, M1) for the young characters; a warm narrator (F3 or F4).
7. **Steady voices carry instructions.** Playbooks, safety and language drills sound more trustworthy in F5, M3 or M5.
8. **Keep the user's choice.** If the user names a voice, use it. Do not swap voices between renders without asking.
9. **The user's own voice.** For a character the user wants to voice themselves, cast `voice: record` (they read the lines) or `voice: clone:<name>` (a clone of their voice from one reference recording). Both are in [your-voice](your-voice.md), with the consent rule. A clone's base voice is the preset nearest its median pitch (shown in `voice.json`); contrast scene partners against that base as with any preset.

## Starting casts by domain

| Domain | Narrator or host | Others |
|---|---|---|
| education, video | F4 or M3 | a second voice for quotes: M4 or F1 |
| audiobook | M5 or F3 | characters: M2, F2, M1, F5 as needed |
| drama | F4 narrator | leads M2 and F2; support M1, F5, M4 |
| podcast | F1 and M4, or F2 and M3 | guest: F5 or M2 |
| playbook | M3 or F5 | none |
| ad | F2 or M1 (energy), F5 or M5 (premium) | tag line: the contrasting voice |
| meditation | F3 or M5 | none |
| kids | F3 narrator | F2 and M1 for characters |
| language | F4 or M3 for the target phrase | the other one for the English gloss |

## Audition before you cast

```sh
node scripts/audition.mjs "The lamp had burned for forty years." --voices all --out out/audition
node scripts/audition.mjs "Did you hear that?" --voices F2,M1 --emotion scared --out out/audition
node scripts/audition.mjs "Tranquila. Ya pasó." --voices F1,F3 --lang es --out out/audition
```

It writes one mp3 per voice and `audition.md` listing them. Play the files for the user and let them choose; describe each with the table above, not with claims about how it "sounds like" a person. Audition the actual lines that matter most (the emotional peak, the hardest names), not a generic sentence.

To re-measure the table after an engine update: audition one sentence for all ten voices, then measure each clip's median pitch (any pitch tracker, voiced frames only) and words/s, and update this file.
