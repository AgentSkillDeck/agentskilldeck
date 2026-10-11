# Credits

Voices synthesised with Supertonic 3 by Supertone Inc. (https://github.com/supertone-inc/supertonic); code MIT, model weights OpenRAIL-M. AI-generated voices, not real people.

Sounds:

- "Soft Corporate by MusicLFiles" by MusicLFiles (https://commons.wikimedia.org/w/index.php?curid=123925096), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/) (faded)

Generated sounds: no attribution required (made with ffmpeg by agentskilldeck).

## About this example

Original script (agentskilldeck). A 55-second explainer in five chaptered scenes; the scenes become chapter markers in timeline.json and labels in the preview.

- Rendered by `produce.mjs` on 2026-10-11 with Supertonic 3 (supertonic 1.3.1); QA clean (8 segments).
- `mix.mp3`: re-encoded from mix.wav at 128 kbps CBR to stay under 1 MB (produce.mjs writes LAME VBR quality 2) (decoded true peak -1.75 dBTP, sample peak -1.76 dBFS).
- Sounds were fetched with their license sidecars, then trimmed, faded or looped as noted above; they are not committed (only the script, mix, captions, timeline, credits and preview are). The script's `./sounds/` paths point to those local files.
