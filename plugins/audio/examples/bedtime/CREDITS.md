# Credits

Voices synthesised with Supertonic 3 by Supertone Inc. (https://github.com/supertone-inc/supertonic); code MIT, model weights OpenRAIL-M. AI-generated voices, not real people.

Sounds:

- "Crickets Night 2" by PhilllChabbb (https://freesound.org/people/PhilllChabbb/sounds/245834), CC0 1.0 (public domain dedication, no attribution required) (faded)
- "Sparkling Star 01" by MATRIXXX_ (https://freesound.org/people/MATRIXXX_/sounds/462095), CC0 1.0 (public domain dedication, no attribution required) (faded)
- "Owl hoot" by freemaster2 (https://freesound.org/people/freemaster2/sounds/385097), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/) (faded)
- "Sigh_4_Female" by Drkvixn91 (https://freesound.org/people/Drkvixn91/sounds/318085), CC0 1.0 (public domain dedication, no attribution required)
- "Music box lullaby" by csnmedia (https://freesound.org/people/csnmedia/sounds/381973), CC0 1.0 (public domain dedication, no attribution required) (faded)

Generated sounds: no attribution required (made with ffmpeg by agentskilldeck).

## About this example

Original script (agentskilldeck), kids preset. GLOW's laugh is the voice's own (three joined native laugh tags). PIP's yawn plays the bundled sigh clip, because a native yawn is spoken as a word (owner listening, placement test).

- Rendered by `produce.mjs` on 2026-10-11 with Supertonic 3 (supertonic 1.3.1); QA clean (12 segments).
- `mix.mp3`: re-encoded from mix.wav at 112 kbps CBR to stay under 1 MB (produce.mjs writes LAME VBR quality 2), through a -2.19 dBFS peak limiter because the encode overshot the peak limit (decoded true peak -1.85 dBTP, sample peak -1.94 dBFS).
- Sounds were fetched with their license sidecars, then trimmed, faded or looped as noted above; they are not committed (only the script, mix, captions, timeline, credits and preview are). The script's `./sounds/` paths point to those local files.
