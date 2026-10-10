# Credits

Voices synthesised with Supertonic 3 by Supertone Inc. (https://github.com/supertone-inc/supertonic); code MIT, model weights OpenRAIL-M. AI-generated voices, not real people.

Generated sounds: no attribution required (made with ffmpeg by agentatelier).

## About this example

Original script (agentatelier). One voice (F4) reads the same two sentences in English, Spanish, French, Hindi, Japanese and Korean, with a `(lang: xx)` annotation on each line. Checked line by line with faster-whisper base in each language; whisper writes the Hindi line in Urdu script (same speech, other alphabet), so QA records a note instead of a word error rate for it.

- Rendered by `produce.mjs` on 2026-10-11 with Supertonic 3 (supertonic 1.3.1); QA clean (6 segments).
- `mix.mp3`: LAME VBR quality 2 from mix.wav, as produce.mjs writes it (decoded true peak -1.88 dBTP, sample peak -1.91 dBFS).
- No sounds: voice only.
