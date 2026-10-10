// Live produce: real Supertonic + faster-whisper through the venv, offline sounds.
// Run with: LIVE_AUDIO=1 node --test plugins/audio/tools/test/produce-live.test.mjs
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '../produce.mjs';
import { probeDuration } from '../lib/ffmpeg.mjs';

const LIVE = process.env.LIVE_AUDIO === '1';
const skip = LIVE ? false : 'set LIVE_AUDIO=1 to run the live produce test';
const work = mkdtempSync(join(tmpdir(), 'aa live produce '));
after(() => { if (!process.env.KEEP_LIVE_OUT) rmSync(work, { recursive: true, force: true }); });

// Six speech lines, the T4-deferred <breath> case among them.
const SCRIPT = `---
title: The Lighthouse (live test)
lang: en
preset: drama
cast:
  NARRATOR: { voice: F4 }
  ELI:      { voice: M3, speed: 1.05 }
  MAYA:     { voice: F2 }
---
[scene: Lighthouse, night]  [ambience: wind | low]
NARRATOR: The lamp had burned for forty years.
ELI (scared): <breath> Did you hear that?
[sfx: wooden door creak]
MAYA (hushed): Don't move.
[pause 1.5]
ELI (nervous): Someone is on the stairs.
MAYA (calm): <laugh> It's only the wind.
NARRATOR (tender): And the light kept turning, all night long.
`;

test('live: a 6-line drama renders with QA clean, LUFS within ±1, and <breath> never spoken', { skip, timeout: 900_000 }, async () => {
  const script = join(work, 'lighthouse.audio.md');
  writeFileSync(script, SCRIPT);
  const out = join(work, 'out');
  let stdout = '';
  let stderr = '';
  const code = await main([script, '--out', out, '--offline', '--json'], { stdout: (s) => { stdout += s; }, stderr: (s) => { stderr += s; process.stderr.write(s); } });
  assert.equal(code, 0, `${stderr}\n${stdout}`);
  const summary = JSON.parse(stdout);
  assert.equal(summary.ok, true);
  assert.ok(Math.abs(summary.loudness.I - -16) <= 1, `LUFS ${summary.loudness.I}`);

  const qa = JSON.parse(readFileSync(join(out, 'qa.json'), 'utf8'));
  assert.equal(qa.ok, true, JSON.stringify(qa.lines, null, 2));
  assert.equal(qa.draft, false);
  assert.equal(qa.lines.length, 6);
  for (const l of qa.lines) assert.doesNotMatch(l.heard, /\b(breath\w*|rest|laugh\w*|sigh\w*)\b/i, `${l.id} heard "${l.heard}"`);
  const eliQa = qa.lines.find((l) => l.text === 'Did you hear that?');
  assert.ok(eliQa, 'the <breath> line was split: the engine only saw "Did you hear that?"');
  assert.match(eliQa.heard, /hear/i);

  const tl = JSON.parse(readFileSync(join(out, 'timeline.json'), 'utf8'));
  const breath = tl.lines.find((l) => l.kind === 'nv' && l.tag === 'breath');
  assert.ok(breath, 'timeline has the nv breath segment');
  assert.equal(breath.speaker, 'ELI');
  assert.ok(tl.lines.find((l) => l.kind === 'nv' && l.tag === 'laugh'));
  const mixDur = await probeDuration(join(out, 'mix.wav'));
  assert.ok(Math.abs(mixDur - tl.duration_s) < 0.05, `mix ${mixDur} vs timeline ${tl.duration_s}`);
  for (const l of tl.lines.filter((x) => x.kind === 'speech')) assert.ok(l.words.length > 0, `${l.id} has words`);
  for (const f of ['mix.mp3', 'captions.srt', 'captions.vtt', 'audio_meta.json', 'CREDITS.md']) assert.ok(existsSync(join(out, f)), f);
  assert.doesNotMatch(readFileSync(join(out, 'captions.srt'), 'utf8'), /breath|laugh/i);
});
