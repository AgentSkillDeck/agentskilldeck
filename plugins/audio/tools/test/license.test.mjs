import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowed, normaliseLicense, attribution } from '../lib/sounds/license.mjs';

test('isAllowed accepts CC0, PDM, public domain and CC BY 3.0/4.0 in the forms the APIs use', () => {
  for (const s of [
    'cc0', 'CC0', 'cc0 1.0', 'CC0 1.0', 'Creative Commons 0',
    'http://creativecommons.org/publicdomain/zero/1.0/', 'http://creativecommons.org/publicdomain/zero/1.0/deed.en',
    'pdm', 'pdm 1.0', 'https://creativecommons.org/publicdomain/mark/1.0/', 'Public domain',
    'http://creativecommons.org/licenses/publicdomain/',
    'by 4.0', 'by 3.0', 'CC BY 4.0', 'CC BY 3.0', 'Attribution', 'Attribution 4.0',
    'https://creativecommons.org/licenses/by/4.0/', 'http://creativecommons.org/licenses/by/3.0/us/',
    'generated',
  ]) assert.equal(isAllowed(s), true, s);
});

test('isAllowed rejects NC, ND, SA, old BY versions and unknown licenses', () => {
  for (const s of [
    'by-nc 4.0', 'CC BY-NC 4.0', 'by-sa 4.0', 'CC BY-SA 3.0', 'CC BY-ND 4.0', 'by-nc-sa 3.0',
    'https://creativecommons.org/licenses/by-sa/4.0', 'http://creativecommons.org/licenses/by-nc-nd/3.0/',
    'Attribution-NonCommercial', 'Attribution-ShareAlike 4.0', 'Attribution Noncommercial',
    'http://creativecommons.org/licenses/by/2.5/', 'CC BY 2.0', 'by 1.0',
    'GFDL', 'All rights reserved', '', undefined, null, 'sampling+',
  ]) assert.equal(isAllowed(s), false, String(s));
});

test('normaliseLicense gives a canonical label and URL', () => {
  assert.deepEqual(normaliseLicense('by 4.0'), { id: 'by', version: '4.0', label: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' });
  assert.deepEqual(normaliseLicense('http://creativecommons.org/publicdomain/zero/1.0/'), { id: 'cc0', version: '1.0', label: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' });
  assert.equal(normaliseLicense('Public domain').id, 'pd');
  assert.equal(normaliseLicense('by-sa 4.0'), null);
});

test('attribution strings follow the TASL format per license type', () => {
  const base = { title: 'Rain, Moderate', creator: 'InspectorJ', source_url: 'https://freesound.org/people/InspectorJ/sounds/401275' };
  assert.equal(
    attribution({ ...base, license: 'CC BY 4.0', license_url: 'https://creativecommons.org/licenses/by/4.0/' }),
    '"Rain, Moderate" by InspectorJ (https://freesound.org/people/InspectorJ/sounds/401275), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)',
  );
  assert.equal(
    attribution({ ...base, license: 'CC0 1.0', license_url: 'https://creativecommons.org/publicdomain/zero/1.0/' }),
    '"Rain, Moderate" by InspectorJ (https://freesound.org/people/InspectorJ/sounds/401275), CC0 1.0 (public domain dedication, no attribution required)',
  );
  assert.equal(
    attribution({ title: 'Rain (1)', creator: '', source_url: 'https://commons.wikimedia.org/wiki/File:Rain_(1).ogg', license: 'Public domain' }),
    '"Rain (1)" (https://commons.wikimedia.org/wiki/File:Rain_(1).ogg), public domain',
  );
  assert.equal(attribution({ title: 'Generated rain', license: 'generated' }), 'Generated rain: generated with ffmpeg, no attribution required');
});
