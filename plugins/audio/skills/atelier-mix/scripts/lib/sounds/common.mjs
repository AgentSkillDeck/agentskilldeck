import { attribution, normaliseLicense } from './license.mjs';

export const SEARCH_TTL_MS = 7 * 24 * 3600 * 1000; // searches are cached for a week (Openverse anonymous limits are low)

export const stripHtml = (s) => String(s ?? '')
  .replace(/<[^>]*>/g, '')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ').trim();

export const stripExt = (s) => String(s ?? '').replace(/\.(wav|mp3|ogg|oga|flac|aiff?|m4a|opus|webm)$/i, '').trim();

// Build a Sound from provider fields; returns null when the license is not allowed or there is no URL.
export function makeSound({ source, id, title, creator, license, license_url, source_url, download_url, duration_s }) {
  const lic = normaliseLicense(license);
  if (!lic || lic.id === 'generated' || !download_url) return null;
  const sound = {
    source, id: String(id), title: stripExt(title) || 'Untitled', creator: creator ? String(creator).trim() : '',
    license: lic.label, license_url: lic.url || license_url || '',
    source_url: source_url || download_url, download_url,
    duration_s: Number.isFinite(duration_s) ? Math.round(duration_s * 1000) / 1000 : null,
  };
  sound.attribution = attribution(sound);
  return sound;
}
