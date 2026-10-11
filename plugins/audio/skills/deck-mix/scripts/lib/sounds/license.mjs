// License policy for sound assets: CC0, Public Domain (Mark) and CC BY 3.0/4.0 only.
// Anything NonCommercial, NoDerivatives or ShareAlike is rejected, as is any
// license we cannot positively identify.

const CC0_URL = 'https://creativecommons.org/publicdomain/zero/1.0/';
const PDM_URL = 'https://creativecommons.org/publicdomain/mark/1.0/';
const BY_VERSIONS = new Set(['3.0', '4.0']);

// Returns {id: 'cc0'|'pdm'|'pd'|'by'|'generated', version, label, url} or null if not allowed.
export function normaliseLicense(input) {
  if (typeof input !== 'string') return null;
  const s = input.trim().toLowerCase();
  if (!s) return null;
  if (s === 'generated') return { id: 'generated', version: '', label: 'generated', url: '' };
  // Restrictive terms anywhere in the string disqualify it, whatever else it says.
  if (/\b(nc|nd|sa)\b|by-(nc|nd|sa)|non-?commercial|no-?deriv|share-?alike|sampling/.test(s)) return null;

  if (/publicdomain\/zero|^cc0\b|^cc-zero|creative commons 0|^cc 0\b/.test(s)) {
    return { id: 'cc0', version: '1.0', label: 'CC0 1.0', url: CC0_URL };
  }
  if (/publicdomain\/mark|^pdm\b|public domain mark/.test(s)) {
    return { id: 'pdm', version: '1.0', label: 'Public Domain Mark 1.0', url: PDM_URL };
  }
  if (/^public domain$|^pd$|licenses\/publicdomain/.test(s)) {
    return { id: 'pd', version: '', label: 'Public domain', url: '' };
  }

  // CC BY: URL form, "by 4.0", "cc by 4.0", "cc-by-4.0", "attribution 4.0" or a bare "attribution"/"by".
  let m = s.match(/creativecommons\.org\/licenses\/by\/(\d\.\d)/)
    ?? s.match(/^(?:cc[ -])?by(?:[ -](\d\.\d))?$/)
    ?? s.match(/^attribution(?: (\d\.\d))?$/)
    ?? s.match(/^creative commons attribution(?: (\d\.\d))?(?: (?:international|unported))?(?: license)?$/);
  if (m) {
    const version = m[1] ?? '4.0'; // unversioned BY (Freesound "Attribution", Openverse "by" without version) is treated as current 4.0
    if (!BY_VERSIONS.has(version)) return null;
    return { id: 'by', version, label: `CC BY ${version}`, url: `https://creativecommons.org/licenses/by/${version}/` };
  }
  return null;
}

export function isAllowed(licenseString) {
  return normaliseLicense(licenseString) !== null;
}

export function needsAttribution(licenseString) {
  return normaliseLicense(licenseString)?.id === 'by';
}

// TASL (title, author, source, license) attribution line.
//   BY:    "Title" by Creator (source), licensed under CC BY 4.0 (license url)
//   CC0:   "Title" by Creator (source), CC0 1.0 (public domain dedication, no attribution required)
//   PD/M:  "Title" by Creator (source), public domain
//   gen:   Title: generated with ffmpeg, no attribution required
export function attribution(sound) {
  const lic = normaliseLicense(sound.license);
  if (lic?.id === 'generated') return `${sound.title || 'Generated sound'}: generated with ffmpeg, no attribution required`;
  const who = sound.creator ? ` by ${sound.creator}` : '';
  const where = sound.source_url ? ` (${sound.source_url})` : '';
  const head = `"${sound.title || 'Untitled'}"${who}${where}`;
  if (!lic) return `${head}, ${sound.license ?? 'unknown license'}`;
  if (lic.id === 'by') return `${head}, licensed under ${lic.label} (${sound.license_url || lic.url})`;
  if (lic.id === 'cc0') return `${head}, CC0 1.0 (public domain dedication, no attribution required)`;
  if (lic.id === 'pdm') return `${head}, public domain (Public Domain Mark 1.0)`;
  return `${head}, public domain`;
}
