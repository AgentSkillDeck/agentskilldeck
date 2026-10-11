# Credits

Voices synthesised with Supertonic 3 by Supertone Inc. (https://github.com/supertone-inc/supertonic); code MIT, model weights OpenRAIL-M. AI-generated voices, not real people.

Sounds:

- "factory ambience machines humming different pitches1" by kyles (https://freesound.org/people/kyles/sounds/635535), CC0 1.0 (public domain dedication, no attribution required) (faded)
- "jp_tinypadlock01" by JPolito (https://freesound.org/people/JPolito/sounds/391704), CC0 1.0 (public domain dedication, no attribution required) (faded)

Generated sounds: no attribution required (made with ffmpeg by agentskilldeck).

## About this example

Original script (agentskilldeck), following the usual lockout/tagout order (prepare and notify, shut down, isolate, lock and tag, release stored energy, verify). A training illustration, not a substitute for your site's written procedure.

- Rendered by `produce.mjs` on 2026-10-11 with Supertonic 3 (supertonic 1.3.1); QA clean (8 segments).
- `mix.mp3`: LAME VBR quality 2 from mix.wav, as produce.mjs writes it, through a -1.42 dBFS peak limiter because the encode overshot the peak limit (decoded true peak -1.06 dBTP, sample peak -1.35 dBFS).
- Sounds were fetched with their license sidecars, then trimmed, faded or looped as noted above; they are not committed (only the script, mix, captions, timeline, credits and preview are). The script's `./sounds/` paths point to those local files.
