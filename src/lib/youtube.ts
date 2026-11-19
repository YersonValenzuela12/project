export type ParsedYoutube =
  | { kind: 'video'; id: string; start?: number }
  | { kind: 'playlist'; id: string };

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const LIST_ID = /^[A-Za-z0-9_-]{10,64}$/;

const HOSTS = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com',
  'youtu.be',
  'youtube-nocookie.com', 'www.youtube-nocookie.com',
]);

// "90", "1m30s", "1h2m3s" -> seconds (null if it is not a time).
function parseStart(value: string | null): number | undefined {
  if (!value) return undefined;
  if (/^\d+$/.test(value)) {
    const n = Number(value);
    return n > 0 && n < 43200 ? n : undefined;
  }
  const m = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || (!m[1] && !m[2] && !m[3])) return undefined;
  const n = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return n > 0 && n < 43200 ? n : undefined;
}

/**
 * Reads a YouTube link and returns the video (or playlist) id, or null if it is not one we accept.
 * The app NEVER uses the pasted text as an iframe address: it only uses the id extracted here to build
 * the player address, so a bad or malicious link cannot make the page load another site.
 */
export function parseYoutubeUrl(raw: string): ParsedYoutube | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase();
  if (!HOSTS.has(host)) return null;

  const start = parseStart(u.searchParams.get('t')) ?? parseStart(u.searchParams.get('start'));
  const segments = u.pathname.split('/').filter(Boolean);

  // youtu.be/<id>
  if (host === 'youtu.be') {
    return segments[0] && VIDEO_ID.test(segments[0]) ? { kind: 'video', id: segments[0], start } : null;
  }

  // youtube.com/watch?v=<id>
  if (segments[0] === 'watch') {
    const v = u.searchParams.get('v');
    if (v && VIDEO_ID.test(v)) return { kind: 'video', id: v, start };
    return null;
  }

  // youtube.com/embed/<id>, /shorts/<id>, /live/<id>, /v/<id>
  if (['embed', 'shorts', 'live', 'v'].includes(segments[0] ?? '') && segments[1]) {
    if (segments[1] === 'videoseries') {
      const list = u.searchParams.get('list');
      return list && LIST_ID.test(list) ? { kind: 'playlist', id: list } : null;
    }
    return VIDEO_ID.test(segments[1]) ? { kind: 'video', id: segments[1], start } : null;
  }

  // youtube.com/playlist?list=<id>
  if (segments[0] === 'playlist') {
    const list = u.searchParams.get('list');
    return list && LIST_ID.test(list) ? { kind: 'playlist', id: list } : null;
  }

  return null;
}

// Plain-language reason why a link is not accepted (null = the link is fine).
export function youtubeProblem(raw: string): string | null {
  const value = raw.trim();
  if (!value) return 'Falta el enlace de YouTube.';

  let u: URL;
  try { u = new URL(value); } catch { return 'Eso no parece un enlace. Copia el enlace completo desde YouTube.'; }
  if (u.protocol !== 'https:') return 'El enlace debe empezar con https://';

  const host = u.hostname.toLowerCase();
  if (!HOSTS.has(host)) return 'Solo se aceptan enlaces de YouTube (youtube.com o youtu.be).';

  const first = u.pathname.split('/').filter(Boolean)[0] ?? '';
  if (first.startsWith('@') || ['channel', 'c', 'user'].includes(first)) {
    return 'Es un enlace de canal. Abre el video y copia el enlace del video.';
  }
  return parseYoutubeUrl(value) ? null : 'No se reconoce el enlace. En YouTube usa «Compartir → Copiar» sobre el video.';
}

// Address of the embedded player. "nocookie" is YouTube's privacy-friendly domain.
// fs=0 hides YouTube's own fullscreen button (Selecom has its own "Ampliar"); rel=0 limits suggestions to the same channel.
export function youtubeEmbedUrl(p: ParsedYoutube): string {
  const q = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1', iv_load_policy: '3', fs: '0' });
  const base = 'https://www.youtube-nocookie.com/embed';
  if (p.kind === 'video') {
    if (p.start) q.set('start', String(p.start));
    return `${base}/${p.id}?${q.toString()}`;
  }
  q.set('list', p.id);
  return `${base}/videoseries?${q.toString()}`;
}

// Open on YouTube (administrator only).
export function youtubeWatchUrl(p: ParsedYoutube): string {
  return p.kind === 'video' ? `https://www.youtube.com/watch?v=${p.id}` : `https://www.youtube.com/playlist?list=${p.id}`;
}

// Cover that YouTube already generates for every video (playlists have no direct cover).
export function youtubeThumbnailUrl(p: ParsedYoutube): string | null {
  return p.kind === 'video' ? `https://img.youtube.com/vi/${p.id}/hqdefault.jpg` : null;
}
