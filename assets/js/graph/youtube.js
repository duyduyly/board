export const VIDEO_CLASS = 'board-video';

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);
const EMBED_ORIGIN = 'https://www.youtube-nocookie.com/embed/';

/**
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
function validId(value) {
  return value && VIDEO_ID.test(value) ? value : null;
}

/**
 * Extracts a YouTube video id from a watch, shorts, embed or youtu.be link.
 * @param {string} href
 * @returns {string | null}
 */
export function youtubeVideoId(href) {
  let url;
  try {
    url = new URL(String(href).trim());
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol)) return null;
  if (url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  if (host === 'youtu.be') return validId(url.pathname.slice(1));
  if (!YOUTUBE_HOSTS.has(host)) return null;
  if (url.pathname === '/watch') return validId(url.searchParams.get('v'));
  const match = /^\/(?:shorts|embed)\/([^/]+)$/.exec(url.pathname);
  return match ? validId(match[1]) : null;
}

/**
 * @param {string} id a value returned by youtubeVideoId
 * @returns {string}
 */
export function youtubeEmbedURL(id) {
  return EMBED_ORIGIN + id + '?autoplay=1&rel=0';
}
