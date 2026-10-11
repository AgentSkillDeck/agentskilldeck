import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { layoutTimeline, buildDialogueStem, buildMix, mixArgs } from '../lib/mix.mjs';
import { run, hasFfmpeg, probeDuration, onRun, countInputs } from '../lib/ffmpeg.mjs';

const HAVE_FFMPEG = await hasFfmpeg();
const SKIP = HAVE_FFMPEG ? false : 'ffmpeg not found (install ffmpeg or set AGENTSKILLDECK_FFMPEG) - skipping real-audio test';

async function sine(path, { f = 440, d = 1, ch = 'mono' } = {}) {
  await run(['-filter_complex', `sine=f=${f}:d=${d},aformat=sample_fmts=s16:sample_rates=44100:channel_layouts=${ch}`, '-c:a', 'pcm_s16le', path]);
  return path;
}

const speech = (id, n, speaker, extra = {}) => ({ id, n, kind: 'speech', speaker, voice: 'F1', lang: 'en', text: `line ${id}`, speed: 1, gain_db: 0, af: '', pre_s: 0, post_s: 0, ...extra });
const cue = (id, n, type, value, args = [], extra = {}) => ({ id, n, kind: 'cue', lang: 'en', cue: { type, value, args, ...extra } });

test('layoutTimeline places lines, gaps, pauses and cues at exact times', () => {
  const plan = {
    meta: { title: 'T' },
    preset: 'drama',
    items: [
      cue('L1-0', 1, 'scene', 'Night'),
      cue('L1-1', 1, 'ambience', 'sea', ['low'], { path: '/a/sea.wav' }),
      speech('L2-0', 2, 'NARRATOR'),
      speech('L3-0', 3, 'ELI'),
      { id: 'L3-1', n: 3, kind: 'nv', speaker: 'ELI', lang: 'en', tag: 'breath', gain_db: 0, af: '' },
      speech('L3-2', 3, 'ELI', { post_s: 0.2 }),
      cue('L4-0', 4, 'sfx', 'door', [], { path: '/a/door.wav' }),
      { id: 'L5-0', n: 5, kind: 'pause', lang: 'en', duration_s: 1.5 },
      speech('L6-0', 6, 'MAYA', { pre_s: 0.1 }),
      cue('L7-0', 7, 'sfx', 'thud', ['wait'], { path: '/a/thud.wav' }),
      cue('L8-0', 8, 'scene', 'Dawn'),
      cue('L8-1', 8, 'music', 'slow piano', [], { path: '/a/piano.wav' }),
      speech('L9-0', 9, 'NARRATOR'),
      cue('L10-0', 10, 'music', 'out'),
    ],
  };
  const rendered = {
    'L2-0': { path: '/r/2.wav', duration_s: 2 },
    'L3-0': { path: '/r/30.wav', duration_s: 1 },
    'L3-1': { path: '/r/31.wav', duration_s: 0.5 },
    'L3-2': { path: '/r/32.wav', duration_s: 1 },
    'L4-0': { path: '/a/door.wav', duration_s: 0.8 },
    'L6-0': { path: '/r/6.wav', duration_s: 1 },
    'L7-0': { path: '/a/thud.wav', duration_s: 0.8 },
    'L9-0': { path: '/r/9.wav', duration_s: 1 },
  };
  const preset = { gap_s: 0.25, lead_s: 0.5, tail_s: 1 };
  const tl = layoutTimeline(plan, rendered, preset);

  assert.deepEqual(tl.scenes, [{ name: 'Night', start: 0.5 }, { name: 'Dawn', start: 8.85 }]);
  assert.deepEqual(
    tl.lines.map((l) => [l.id, l.start, l.end]),
    [
      ['L2-0', 0.5, 2.5],
      ['L3-0', 2.75, 3.75],
      ['L3-1', 3.75, 4.25],
      ['L3-2', 4.25, 5.25],
      ['L6-0', 7.05, 8.05],
      ['L9-0', 9.1, 10.1],
    ],
  );
  assert.equal(tl.lines[1].speaker, 'ELI');
  assert.equal(tl.lines[1].path, '/r/30.wav');
  assert.equal(tl.lines[1].n, 3);
  assert.equal(tl.duration_s, 11.1);
  assert.deepEqual(
    tl.cues.map((c) => [c.type, c.start, c.end, c.path, Boolean(c.loop)]),
    [
      ['ambience', 0.5, 8.85, '/a/sea.wav', true],
      ['sfx', 5.45, 6.25, '/a/door.wav', false],
      ['sfx', 8.05, 8.85, '/a/thud.wav', false],
      ['music', 8.85, 11.1, '/a/piano.wav', true],
    ],
  );
  const amb = tl.cues[0];
  assert.ok(amb.gain_db < tl.cues[1].gain_db, 'ambience "low" sits under sfx');
});

test('layoutTimeline: missing rendered audio is an error; unresolved cue is a warning', () => {
  assert.throws(() => layoutTimeline({ items: [speech('L1-0', 1, 'A')] }, {}, {}), /L1-0/);
  const tl = layoutTimeline({ items: [cue('L1-0', 1, 'sfx', 'boom')] }, {}, {});
  assert.equal(tl.cues.length, 0);
  assert.match(tl.warnings.join('\n'), /boom/);
});

test('mixArgs builds one graph with sidechain ducking, optional carve and amix normalize=0', () => {
  const args = mixArgs({ dialogue: '/s/d.wav', sfx: '/s/sfx.wav', ambience: '/s/amb.wav', music: '/s/m.wav' }, { duration_s: 10, out: '/o/mix.wav', carve: true });
  assert.equal(countInputs(args), 4);
  const graph = args[args.indexOf('-filter_complex') + 1];
  assert.match(graph, /sidechaincompress=threshold=0\.031623:ratio=8:release=400/);
  assert.match(graph, /equalizer=f=2500:t=q:w=1:g=-4/);
  assert.match(graph, /amix=inputs=4:normalize=0/);
  const noCarve = mixArgs({ dialogue: '/s/d.wav', music: '/s/m.wav' }, { duration_s: 10, out: '/o/mix.wav', carve: false });
  assert.doesNotMatch(noCarve[noCarve.indexOf('-filter_complex') + 1], /equalizer/);
  const dryOnly = mixArgs({ dialogue: '/s/d.wav' }, { duration_s: 10, out: '/o/mix.wav' });
  assert.doesNotMatch(dryOnly[dryOnly.indexOf('-filter_complex') + 1], /sidechaincompress/);
});

test('real 3-clip mix from generated sines matches the timeline duration (±50 ms)', { skip: SKIP }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aa mix '));
  try {
    const a = await sine(join(dir, 'a.wav'), { f: 330, d: 0.6 });
    const b = await sine(join(dir, 'b.wav'), { f: 440, d: 0.9 });
    const c = await sine(join(dir, 'c.wav'), { f: 550, d: 1.2 });
    const amb = await sine(join(dir, 'amb.wav'), { f: 110, d: 0.7, ch: 'stereo' });
    const sfx = await sine(join(dir, 'sfx.wav'), { f: 880, d: 0.2 });
    const mus = await sine(join(dir, 'mus.wav'), { f: 220, d: 1.1, ch: 'stereo' });
    const plan = {
      meta: {},
      items: [
        cue('L1-0', 1, 'ambience', 'room', [], { path: amb }),
        cue('L1-1', 1, 'music', 'start', [], { path: mus }),
        speech('L2-0', 2, 'A'),
        cue('L3-0', 3, 'sfx', 'ping', [], { path: sfx }),
        speech('L4-0', 4, 'B', { af: 'highpass=f=250,lowpass=f=5000', gain_db: -9 }),
        speech('L5-0', 5, 'A', { post_s: 0.3 }),
      ],
    };
    const rendered = {
      'L2-0': { path: a, duration_s: 0.6 },
      'L4-0': { path: b, duration_s: 0.9 },
      'L5-0': { path: c, duration_s: 1.2 },
      'L3-0': { path: sfx, duration_s: 0.2 },
    };
    const tl = layoutTimeline(plan, rendered, { gap_s: 0.25, lead_s: 0.5, tail_s: 1 });
    const stems = await buildDialogueStem(tl, join(dir, 'stems', 'dialogue.wav'));
    assert.deepEqual(Object.keys(stems.speakers).sort(), ['A', 'B']);
    assert.ok(Math.abs((await probeDuration(stems.dialogue)) - tl.duration_s) <= 0.05);
    const mixed = await buildMix(tl, stems, { music: 'scored' }, join(dir, 'mix.wav'));
    const d = await probeDuration(mixed.path);
    assert.ok(Math.abs(d - tl.duration_s) <= 0.05, `mix ${d}s vs timeline ${tl.duration_s}s`);
    for (const k of ['sfx', 'ambience', 'music']) {
      assert.ok(mixed.stems[k], `${k} stem written`);
      assert.ok((await stat(mixed.stems[k])).size > 1000);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('600-item plan mixes with at most 10 ffmpeg inputs per invocation', { skip: SKIP, timeout: 180000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aa big '));
  const calls = [];
  const off = onRun((args) => calls.push(args));
  try {
    const clips = [];
    for (const [i, d] of [0.3, 0.4, 0.5].entries()) clips.push({ path: await sine(join(dir, `clip${i}.wav`), { f: 300 + i * 100, d }), d });
    const sfxFiles = [];
    for (let i = 0; i < 12; i++) sfxFiles.push(await sine(join(dir, `sfx${i}.wav`), { f: 900 + i * 50, d: 0.2 }));
    const ambFiles = [await sine(join(dir, 'amb0.wav'), { f: 100, d: 1.5 }), await sine(join(dir, 'amb1.wav'), { f: 120, d: 2 })];
    const mus = await sine(join(dir, 'mus.wav'), { f: 200, d: 3 });
    const speakers = ['NARRATOR', 'ELI', 'MAYA'];
    const items = [];
    const rendered = {};
    let n = 0;
    for (let i = 0; items.length < 600; i++) {
      n++;
      const id = `L${n}-0`;
      if (i === 0) items.push(cue(id, n, 'music', 'start', [], { path: mus }));
      else if (i === 300) items.push(cue(id, n, 'music', 'swell'));
      else if (i === 590) items.push(cue(id, n, 'music', 'out'));
      else if (i % 100 === 1) items.push(cue(id, n, 'ambience', 'room', ['low'], { path: ambFiles[((i / 100) | 0) % 2] }));
      else if (i % 10 === 5) {
        const p = sfxFiles[i % 12];
        items.push(cue(id, n, 'sfx', 'x', [], { path: p }));
        rendered[id] = { path: p, duration_s: 0.2 };
      } else if (i % 25 === 0) items.push({ id, n, kind: 'pause', lang: 'en', duration_s: 0.3 });
      else {
        const clip = clips[i % 3];
        const extra = i % 50 === 2 ? { af: 'lowpass=f=5000', gain_db: -3 } : {};
        items.push(speech(id, n, speakers[i % 3], extra));
        rendered[id] = { path: clip.path, duration_s: clip.d };
        if (i % 7 === 0 && items.length < 600) {
          const nid = `L${n}-1`;
          items.push({ id: nid, n, kind: 'nv', speaker: speakers[i % 3], lang: 'en', tag: 'breath', gain_db: 0, af: '' });
          rendered[nid] = { path: clips[0].path, duration_s: clips[0].d };
        }
      }
    }
    assert.equal(items.length, 600);
    const tl = layoutTimeline({ meta: {}, items }, rendered, { gap_s: 0.25, lead_s: 0.5, tail_s: 1 });
    const stems = await buildDialogueStem(tl, join(dir, 'stems', 'dialogue.wav'));
    const mixed = await buildMix(tl, stems, { music: 'scored' }, join(dir, 'mix.wav'));
    const worst = Math.max(...calls.map(countInputs));
    assert.ok(worst <= 10, `an ffmpeg call used ${worst} inputs`);
    const d = await probeDuration(mixed.path);
    assert.ok(Math.abs(d - tl.duration_s) <= 0.05, `mix ${d}s vs timeline ${tl.duration_s}s`);
  } finally {
    off();
    await rm(dir, { recursive: true, force: true });
  }
});
