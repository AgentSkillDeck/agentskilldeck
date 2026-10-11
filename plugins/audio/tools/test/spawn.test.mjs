import './fixtures/native-env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// The plugin manifest parses, and every CLI runs as a real child process from
// its real path and through a symlinked directory with a space in its name.
const pluginJson = fileURLToPath(new URL('../../.claude-plugin/plugin.json', import.meta.url));

test('plugins/audio/.claude-plugin/plugin.json parses', async () => {
  const text = await readFile(pluginJson, 'utf8');
  const manifest = JSON.parse(text);
  assert.equal(manifest.name, 'audio');
  assert.ok(manifest.description && manifest.description.length > 0);
});

// sounds.mjs (task 6): run as a real child process from its real path and through a
// symlinked directory with a space in it. No network: usage errors only.
{
  const { spawnSync } = await import('node:child_process');
  const { mkdtempSync, symlinkSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { after } = await import('node:test');
  const toolsDir = fileURLToPath(new URL('..', import.meta.url));
  const linkRoot = mkdtempSync(join(tmpdir(), 'aa link '));
  const linkedTools = join(linkRoot, 'tools');
  symlinkSync(toolsDir, linkedTools, 'dir');
  after(() => rmSync(linkRoot, { recursive: true, force: true }));
  for (const [label, dir] of [['real path', toolsDir], ['symlinked dir', linkedTools]]) {
    test(`sounds.mjs runs as a CLI via ${label}`, () => {
      const r = spawnSync(process.execPath, [join(dir, 'sounds.mjs'), 'search', 'rain', '--kind', 'speech'], { encoding: 'utf8', timeout: 20_000 });
      assert.equal(r.status, 1, r.stderr);
      assert.match(r.stderr, /Usage: node scripts\/sounds\.mjs search/);
      const none = spawnSync(process.execPath, [join(dir, 'sounds.mjs')], { encoding: 'utf8', timeout: 20_000 });
      assert.equal(none.status, 1);
    });
  }
}

// produce.mjs and audition.mjs (task 8): a full render through the fake engine
// (AGENTSKILLDECK_ENGINE_SCRIPT) with offline sounds, from both paths, plus usage errors.
{
  const { spawnSync } = await import('node:child_process');
  const { mkdtempSync, symlinkSync, rmSync, writeFileSync, existsSync, readFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { after } = await import('node:test');
  const toolsDir = fileURLToPath(new URL('..', import.meta.url));
  const fake = join(toolsDir, 'test', 'fixtures', 'fake-engine.mjs');
  const root = mkdtempSync(join(tmpdir(), 'aa spawn cli '));
  const linkedTools = join(root, 'skill dir', 'scripts');
  (await import('node:fs')).mkdirSync(join(root, 'skill dir'));
  symlinkSync(toolsDir, linkedTools, 'dir');
  after(() => rmSync(root, { recursive: true, force: true }));
  const script = join(root, 'my script.audio.md');
  writeFileSync(script, '---\npreset: drama\ncast:\n  ELI: { voice: M3 }\n---\nELI (scared): <breath> Did you hear that?\nNARRATOR: Nobody answered.\n');
  const env = { ...process.env, AGENTSKILLDECK_ENGINE_SCRIPT: fake };
  const ffmpegOk = spawnSync('ffmpeg', ['-version']).status === 0 || existsSync('/opt/homebrew/bin/ffmpeg');
  for (const [label, dir] of [['real path', toolsDir], ['symlinked dir', linkedTools]]) {
    test(`produce.mjs and audition.mjs run as CLIs via ${label}`, { skip: !ffmpegOk && 'ffmpeg not installed', timeout: 120_000 }, () => {
      const usage = spawnSync(process.execPath, [join(dir, 'produce.mjs')], { encoding: 'utf8', timeout: 20_000 });
      assert.equal(usage.status, 1, usage.stderr);
      assert.match(usage.stderr, /Usage: node scripts\/produce\.mjs/);
      const out = join(root, `out ${label}`);
      const r = spawnSync(process.execPath, [join(dir, 'produce.mjs'), script, '--out', out, '--offline', '--json'], { encoding: 'utf8', env, timeout: 100_000 });
      assert.equal(r.status, 0, r.stderr);
      assert.equal(JSON.parse(r.stdout).ok, true);
      for (const f of ['mix.wav', 'mix.mp3', 'timeline.json', 'captions.srt', 'captions.vtt', 'audio_meta.json', 'CREDITS.md', 'qa.json']) assert.ok(existsSync(join(out, f)), f);
      assert.ok(JSON.parse(readFileSync(join(out, 'timeline.json'), 'utf8')).lines.some((l) => l.kind === 'nv' && l.tag === 'breath'));

      const aUsage = spawnSync(process.execPath, [join(dir, 'audition.mjs')], { encoding: 'utf8', timeout: 20_000 });
      assert.equal(aUsage.status, 1);
      assert.match(aUsage.stderr, /Usage: node scripts\/audition\.mjs/);
      const aOut = join(root, `audition ${label}`);
      const a = spawnSync(process.execPath, [join(dir, 'audition.mjs'), 'Hello there.', '--voices', 'F1,M2', '--out', aOut], { encoding: 'utf8', env, timeout: 60_000 });
      assert.equal(a.status, 0, a.stderr);
      for (const f of ['F1.mp3', 'M2.mp3', 'audition.md']) assert.ok(existsSync(join(aOut, f)), f);
    });
  }
}

// record.mjs (task 12): usage errors, and a clone reference from a file, from
// the real path and through a symlinked `skill dir/scripts` (spaces in the path).
{
  const { spawnSync } = await import('node:child_process');
  const { mkdtempSync, mkdirSync, symlinkSync, rmSync, existsSync, readFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { after } = await import('node:test');
  const toolsDir = fileURLToPath(new URL('..', import.meta.url));
  const root = mkdtempSync(join(tmpdir(), 'aa spawn record '));
  mkdirSync(join(root, 'skill dir'));
  const linkedTools = join(root, 'skill dir', 'scripts');
  symlinkSync(toolsDir, linkedTools, 'dir');
  after(() => rmSync(root, { recursive: true, force: true }));
  const ffmpegOk = spawnSync('ffmpeg', ['-version']).status === 0 || existsSync('/opt/homebrew/bin/ffmpeg');
  const ref = join(root, 'my reference.wav');
  if (ffmpegOk) {
    const ff = existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
    spawnSync(ff, ['-hide_banner', '-y', '-f', 'lavfi', '-i', 'aevalsrc=0.2*sin(2*PI*120*t)*gt(mod(t\\,0.5)\\,0.1):s=44100:d=12', '-c:a', 'pcm_s16le', ref]);
  }
  for (const [label, dir] of [['real path', toolsDir], ['symlinked dir', linkedTools]]) {
    test(`record.mjs runs as a CLI via ${label}`, { skip: ffmpegOk ? false : 'ffmpeg not found' }, () => {
      const env = { ...process.env, AGENTSKILLDECK_VOICES: join(root, `voices ${label}`) };
      const none = spawnSync(process.execPath, [join(dir, 'record.mjs')], { encoding: 'utf8', timeout: 20_000, env });
      assert.equal(none.status, 1);
      assert.match(none.stderr, /Usage:/);
      const r = spawnSync(process.execPath, [join(dir, 'record.mjs'), '--reference', '--name', 'me', '--from', ref, '--consent', 'This is my own voice', '--json'], { encoding: 'utf8', timeout: 120_000, env });
      assert.equal(r.status, 0, r.stderr);
      assert.equal(JSON.parse(r.stdout).base, 'M4');
      assert.equal(JSON.parse(readFileSync(join(env.AGENTSKILLDECK_VOICES, 'me', 'voice.json'), 'utf8')).base, 'M4');
    });
  }
}

// Every CLI: --help prints the usage on stdout and exits 0.
{
  const { spawnSync } = await import('node:child_process');
  const { join } = await import('node:path');
  const toolsDir = fileURLToPath(new URL('..', import.meta.url));
  test('--help exits 0 with the usage on every audio CLI', () => {
    for (const cli of ['produce', 'audition', 'record', 'setup', 'sounds', 'calibrate']) {
      for (const flag of ['--help', '-h']) {
        const r = spawnSync(process.execPath, [join(toolsDir, `${cli}.mjs`), flag], { encoding: 'utf8', timeout: 20_000 });
        assert.equal(r.status, 0, `${cli} ${flag}: ${r.stderr}`);
        assert.match(r.stdout, /Usage:/, `${cli} ${flag}`);
        assert.equal(r.stderr, '', `${cli} ${flag}: no parse error`);
      }
    }
    const rp = spawnSync(process.execPath, [join(toolsDir, '..', '..', '..', 'scripts', 'render-preview.mjs'), '--help'], { encoding: 'utf8', timeout: 20_000 });
    assert.equal(rp.status, 0, rp.stderr);
    assert.match(rp.stdout, /Usage: node scripts\/render-preview\.mjs/);
  });
}
