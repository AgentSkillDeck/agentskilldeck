# Credits

Voices synthesised with Supertonic 3 by Supertone Inc. (https://github.com/supertone-inc/supertonic); code MIT, model weights OpenRAIL-M. AI-generated voices, not real people.

Sounds:

- "Wind-sea 04-091007" by ra_gun (https://freesound.org/people/ra_gun/sounds/82271), CC0 1.0 (public domain dedication, no attribution required) (faded)
- "Sigh_4_Female" by Drkvixn91 (https://freesound.org/people/Drkvixn91/sounds/318085), CC0 1.0 (public domain dedication, no attribution required)
- "Binaural Thunder A - Short" by digifishmusic (https://freesound.org/people/digifishmusic/sounds/34777), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/) (trimmed (0s +7), faded)
- "door_knock" by wjtaylor (https://freesound.org/people/wjtaylor/sounds/268500), CC0 1.0 (public domain dedication, no attribution required) (faded)
- "Male breathing" by zogmachine (https://freesound.org/people/zogmachine/sounds/202606), CC0 1.0 (public domain dedication, no attribution required)
- "Wooden door creaking" by TheBuilder15 (https://freesound.org/people/TheBuilder15/sounds/367052), CC0 1.0 (public domain dedication, no attribution required) (faded)
- "Melancholic piano music" by ZHRØ (https://freesound.org/people/ZHR%C3%98/sounds/623426), CC0 1.0 (public domain dedication, no attribution required) (faded)

Generated sounds: no attribution required (made with ffmpeg by agentskilldeck).

## About this example

Original script (agentskilldeck). Three voices with per-line delivery presets over wind, sea and thunder. ELI's small laugh is the voice's own (two joined native laugh tags); MAYA's sigh and ELI's breath are bundled CC0 clips, set 5.2 dB and 4.6 dB under the line's speech.

- Rendered by `produce.mjs` on 2026-10-11 with Supertonic 3 (supertonic 1.3.1); QA clean (13 segments).
- `mix.mp3`: re-encoded from mix.wav at 112 kbps CBR to stay under 1 MB (produce.mjs writes LAME VBR quality 2) (decoded true peak -0.98 dBTP, sample peak -0.98 dBFS).
- Sounds were fetched with their license sidecars, then trimmed, faded or looped as noted above; they are not committed (only the script, mix, captions, timeline, credits and preview are). The script's `./sounds/` paths point to those local files.
