// Recording helpers: ffmpeg device arguments per OS (pure), device-list
// parsing, the silence auto-stop, the clean chain and the one-take splitter.
// The microphone is never opened: live capture is exercised with an ffmpeg
// lavfi source in place of the device.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  inputArgs, listDevicesArgs, parseDeviceList, captureArgs, autoStopper, cleanFilter, cleanRecording,
  splitTake, captureLive, measureLoudness, RECORD_LUFS, importable,
} from '../lib/recorder.mjs';
import { hasFfmpeg, readWavInfo, run } from '../lib/ffmpeg.mjs';

const SKIP = (await hasFfmpeg()) ? false : 'ffmpeg not found';
const tmp = mkdtempSync(join(tmpdir(), 'aa recorder '));
after(() => rmSync(tmp, { recursive: true, force: true }));

test('inputArgs: avfoundation on macOS, pulse on Linux, dshow on Windows', () => {
  assert.deepEqual(inputArgs({ platform: 'darwin' }), ['-f', 'avfoundation', '-i', ':0']);
  assert.deepEqual(inputArgs({ platform: 'darwin', device: '2' }), ['-f', 'avfoundation', '-i', ':2']);
  assert.deepEqual(inputArgs({ platform: 'darwin', device: 'MacBook Pro Microphone' }), ['-f', 'avfoundation', '-i', ':MacBook Pro Microphone']);
  assert.deepEqual(inputArgs({ platform: 'linux' }), ['-f', 'pulse', '-i', 'default']);
  assert.deepEqual(inputArgs({ platform: 'linux', device: 'alsa_input.usb' }), ['-f', 'pulse', '-i', 'alsa_input.usb']);
  assert.deepEqual(inputArgs({ platform: 'win32', device: 'Microphone (Realtek(R) Audio)' }), ['-f', 'dshow', '-i', 'audio=Microphone (Realtek(R) Audio)']);
  assert.throws(() => inputArgs({ platform: 'win32' }), /--device.*--list-devices/s);
  assert.throws(() => inputArgs({ platform: 'aix' }), /not supported/);
});

test('listDevicesArgs per OS', () => {
  assert.deepEqual(listDevicesArgs('darwin'), ['-f', 'avfoundation', '-list_devices', 'true', '-i', '']);
  assert.deepEqual(listDevicesArgs('linux'), ['-sources', 'pulse']);
  assert.deepEqual(listDevicesArgs('win32'), ['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy']);
});

test('parseDeviceList reads the audio inputs from each backend', () => {
  const mac = [
    '[AVFoundation indev @ 0x7f8] AVFoundation video devices:',
    '[AVFoundation indev @ 0x7f8] [0] FaceTime HD Camera',
    '[AVFoundation indev @ 0x7f8] [1] Capture screen 0',
    '[AVFoundation indev @ 0x7f8] AVFoundation audio devices:',
    '[AVFoundation indev @ 0x7f8] [0] MacBook Pro Microphone',
    '[AVFoundation indev @ 0x7f8] [1] ZoomAudioDevice',
    ': Input/output error',
  ].join('\n');
  assert.deepEqual(parseDeviceList('darwin', mac), [{ id: '0', name: 'MacBook Pro Microphone' }, { id: '1', name: 'ZoomAudioDevice' }]);
  const win = [
    '[dshow @ 000001] "Integrated Camera" (video)',
    '[dshow @ 000001]   Alternative name "@device_pnp_x"',
    '[dshow @ 000001] "Microphone Array (Realtek(R) Audio)" (audio)',
    '[dshow @ 000001]   Alternative name "@device_cm_{33D9}"',
  ].join('\n');
  assert.deepEqual(parseDeviceList('win32', win), [{ id: 'Microphone Array (Realtek(R) Audio)', name: 'Microphone Array (Realtek(R) Audio)' }]);
  const pulse = [
    'Auto-detected sources for pulse:',
    '  alsa_output.pci.analog-stereo.monitor [Monitor of Built-in Audio Analog Stereo]',
    '* alsa_input.pci.analog-stereo [Built-in Audio Analog Stereo]',
  ].join('\n');
  assert.deepEqual(parseDeviceList('linux', pulse), [
    { id: 'alsa_input.pci.analog-stereo', name: 'Built-in Audio Analog Stereo', default: true },
  ], 'monitors of outputs are not microphones');
});

test('captureArgs: mono 44.1 kHz PCM, silence detection, a hard length cap', () => {
  const a = captureArgs({ input: ['-f', 'pulse', '-i', 'default'], out: '/x/take.wav', maxSeconds: 30, silenceS: 1.2 });
  assert.deepEqual(a.slice(0, 4), ['-f', 'pulse', '-i', 'default']);
  assert.ok(a.includes('silencedetect=noise=-40dB:d=1.2'));
  assert.deepEqual(a.slice(a.indexOf('-t'), a.indexOf('-t') + 2), ['-t', '30']);
  assert.equal(a.at(-1), '/x/take.wav');
  for (const x of ['-ac', '1', '-ar', '44100', 'pcm_s16le']) assert.ok(a.includes(x), x);
});

test('autoStopper: stops on the first silence after speech, not on leading silence', () => {
  const lead = autoStopper({ minSpeechS: 0.3 });
  assert.equal(lead.feed('[silencedetect @ 0x1] silence_start: 0'), false, 'silent before the user speaks');
  assert.equal(lead.feed('[silencedetect @ 0x1] silence_end: 2.4 | silence_duration: 2.4'), false);
  assert.equal(lead.feed('size=  12kB time=00:00:03.00'), false);
  assert.equal(lead.feed('[silencedetect @ 0x1] silence_start: 4.85'), true, 'speech then 1.2 s silence: stop');
  const direct = autoStopper({ minSpeechS: 0.3 });
  assert.equal(direct.feed('[silencedetect @ 0x2] silence_start: 2.1'), true, 'speech from the first instant');
  const blip = autoStopper({ minSpeechS: 0.3 });
  assert.equal(blip.feed('[silencedetect @ 0x2] silence_start: 0.1'), false, 'a click is not speech');
});

test('cleanFilter: highpass, light denoise and silence trim at both ends', () => {
  const f = cleanFilter();
  assert.match(f, /highpass=f=80/);
  assert.match(f, /afftdn=nr=10/);
  assert.equal((f.match(/silenceremove/g) ?? []).length, 2);
  assert.equal((f.match(/areverse/g) ?? []).length, 2);
  assert.doesNotMatch(cleanFilter({ trim: false }), /silenceremove/);
});

test('importable: the brief\'s file types', () => {
  for (const f of ['a.wav', 'b.MP3', 'c.m4a', 'd.aac', 'e.flac', 'f.ogg']) assert.ok(importable(f), f);
  for (const f of ['a.txt', 'b.mp4', 'c']) assert.equal(importable(f), false, f);
});

const w = (word, start, end) => ({ w: word, start, end, p: 0.9 });

test('splitTake aligns the take to the script lines, tolerating small misreads', () => {
  const lines = [
    { id: 'L5', text: 'The lamp had burned for forty years.' },
    { id: 'L7', text: '<laugh> Did you hear that?' },
    { id: 'L9', text: "It's only the wind." },
  ];
  const words = [
    w('The', 0.5, 0.7), w('lamp', 0.7, 1.0), w('has', 1.0, 1.2), w('burned', 1.2, 1.5), w('for', 1.5, 1.6), w('40', 1.6, 2.0), w('years.', 2.0, 2.4),
    w('Um,', 3.0, 3.2), w('did', 3.6, 3.8), w('you', 3.8, 3.9), w('hear', 3.9, 4.1), w('that?', 4.1, 4.5),
    w("It's", 5.5, 5.7), w('only', 5.7, 5.9), w('the', 5.9, 6.0), w('wind.', 6.0, 6.5),
  ];
  const parts = splitTake(lines, words, { duration_s: 7 });
  assert.deepEqual(parts.map((p) => p.id), ['L5', 'L7', 'L9']);
  assert.equal(parts[0].heard, 'The lamp has burned for 40 years.');
  assert.match(parts[1].heard, /did you hear that\?$/);
  assert.equal(parts[2].heard, "It's only the wind.");
  // Cuts do not overlap, keep a little air, and stay inside the take.
  assert.ok(parts[0].start < 0.5 && parts[0].start >= 0);
  for (let i = 1; i < parts.length; i++) assert.ok(parts[i].start >= parts[i - 1].end - 1e-9, `${parts[i].id} starts after ${parts[i - 1].id} ends`);
  assert.ok(parts[2].end <= 7 && parts[2].end > 6.5);
  // Word times are relative to the cut.
  assert.ok(Math.abs(parts[2].words[0].start - (5.5 - parts[2].start)) < 1e-6);
});

test('splitTake marks a line that was not read as missing', () => {
  const lines = [{ id: 'L1', text: 'Good morning.' }, { id: 'L2', text: 'Pass the salt, please.' }, { id: 'L3', text: 'Thank you.' }];
  const parts = splitTake(lines, [w('Good', 0.2, 0.5), w('morning.', 0.5, 1.0), w('Thank', 2.0, 2.3), w('you.', 2.3, 2.6)], { duration_s: 3 });
  assert.equal(parts[1].missing, true);
  assert.equal(parts[1].heard, '');
  assert.equal(parts[0].heard, 'Good morning.');
  assert.equal(parts[2].heard, 'Thank you.');
});

async function speechLike(path, { lead = 1, body = 2, tail = 1, level = 0.05 } = {}) {
  // tone bursts with a quiet noise floor around them, like a mic take
  const expr = `if(between(t,${lead},${lead + body}),${level}*sin(2*PI*180*t)*(0.6+0.4*sin(2*PI*3*t)),0)+0.0005*(random(0)-0.5)`;
  await run(['-f', 'lavfi', '-i', `aevalsrc=${expr.replaceAll(',', '\\,')}:s=48000:d=${lead + body + tail}`, '-ac', '2', '-c:a', 'pcm_s16le', path]);
}

test('cleanRecording trims the silence, denoises and sets the loudness to -20 LUFS (44.1 kHz mono s16)', { skip: SKIP }, async () => {
  const src = join(tmp, 'take raw.wav');
  await speechLike(src);
  const r = await cleanRecording(src, join(tmp, 'clean.wav'));
  const info = await readWavInfo(r.path);
  assert.equal(info.sampleRate, 44100);
  assert.equal(info.channels, 1);
  assert.ok(r.duration_s > 1.9 && r.duration_s < 2.7, `trimmed to ~2 s plus air, got ${r.duration_s}`);
  const m = await measureLoudness(r.path);
  assert.ok(Math.abs(m.I - RECORD_LUFS) < 1.5, `loudness ${m.I}`);
  assert.ok(m.TP <= -0.9, `true peak ${m.TP}`);
  // Any importable format goes through ffmpeg.
  const mp3 = join(tmp, 'take.mp3');
  await run(['-i', src, '-c:a', 'libmp3lame', '-b:a', '128k', mp3]);
  const r2 = await cleanRecording(mp3, join(tmp, 'clean2.wav'), { maxSeconds: 1.5 });
  assert.ok(r2.duration_s <= 1.55, `capped at 1.5 s, got ${r2.duration_s}`);
});

test('captureLive stops by itself after speech and 1.2 s of silence (lavfi in place of the microphone)', { skip: SKIP }, async () => {
  const out = join(tmp, 'live.wav');
  const input = ['-re', '-f', 'lavfi', '-i', 'aevalsrc=if(between(t\\,0.4\\,1.4)\\,0.3*sin(2*PI*220*t)\\,0):s=44100:d=12'];
  const t0 = Date.now();
  const r = await captureLive({ input, out, maxSeconds: 12, silenceS: 1.2 });
  assert.equal(r.stoppedBy, 'silence');
  assert.ok(existsSync(out));
  assert.ok((Date.now() - t0) / 1000 < 9, 'did not run to the 12 s cap');
  const info = await readWavInfo(out);
  assert.ok(info.samples / info.sampleRate < 6);
  const capped = await captureLive({ input: ['-f', 'lavfi', '-i', 'aevalsrc=0.3*sin(2*PI*220*t):s=44100:d=5'], out: join(tmp, 'cap.wav'), maxSeconds: 1, silenceS: 1.2 });
  assert.equal(capped.stoppedBy, 'max');
});
