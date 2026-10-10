# Credits

Voices synthesised with Supertonic 3 by Supertone Inc. (https://github.com/supertone-inc/supertonic); code MIT, model weights OpenRAIL-M. AI-generated voices, not real people.

Sounds:

- "Gentle Stream" by EvilDavo (https://freesound.org/people/EvilDavo/sounds/507155), CC0 1.0 (public domain dedication, no attribution required) (looped three times with crossfades)
- "NEPTUN-Solo-07 Tibetan Singing Bowl" by the_very_Real_Horst (https://freesound.org/people/the_very_Real_Horst/sounds/240934), CC0 1.0 (public domain dedication, no attribution required) (faded)
- "Long Ambient Pad" by indigo.cloud (https://freesound.org/people/indigo.cloud/sounds/254856), CC0 1.0 (public domain dedication, no attribution required) (looped three times with crossfades)

Generated sounds: no attribution required (made with ffmpeg by agentatelier).

## About this example

Original script (agentatelier). Box-style breathing with timed [pause] cues; the silences inside the stream and pad bed are allowed by the gate because the script asked for them.

- Rendered by `produce.mjs` on 2026-10-11 with Supertonic 3 (supertonic 1.3.1); QA clean (14 segments).
- `mix.mp3`: re-encoded from mix.wav at 64 kbps CBR to stay under 1 MB (produce.mjs writes LAME VBR quality 2) (decoded true peak -1.25 dBTP, sample peak -1.37 dBFS).
- Sounds were fetched with their license sidecars, then trimmed, faded or looped as noted above; they are not committed (only the script, mix, captions, timeline, credits and preview are). The script's `./sounds/` paths point to those local files.
