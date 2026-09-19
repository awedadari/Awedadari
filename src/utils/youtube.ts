/**
 * Utility helper to parse and validate YouTube URLs and extract video IDs.
 * Supported URL formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/live/VIDEO_ID
 * - https://m.youtube.com/watch?v=VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 */

export function extractYouTubeVideoId(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // 1. Direct standard 11-char video ID format
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // 2. Parse using URL API
  try {
    const urlStr = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(urlStr);

    const hostname = parsed.hostname.toLowerCase();

    // youtu.be/VIDEO_ID
    if (hostname === 'youtu.be' || hostname.endsWith('.youtu.be')) {
      const id = parsed.pathname.replace(/^\/+/, '').split('/')[0]?.split('?')[0];
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
        return id;
      }
    }

    // youtube.com variants
    if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com')) {
      // /watch?v=VIDEO_ID
      if (parsed.pathname === '/watch') {
        const v = parsed.searchParams.get('v');
        if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
          return v;
        }
      }

      // /live/VIDEO_ID
      if (parsed.pathname.startsWith('/live/')) {
        const id = parsed.pathname.slice(6).split('/')[0]?.split('?')[0];
        if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
          return id;
        }
      }

      // /embed/VIDEO_ID
      if (parsed.pathname.startsWith('/embed/')) {
        const id = parsed.pathname.slice(7).split('/')[0]?.split('?')[0];
        if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
          return id;
        }
      }

      // /shorts/VIDEO_ID
      if (parsed.pathname.startsWith('/shorts/')) {
        const id = parsed.pathname.slice(8).split('/')[0]?.split('?')[0];
        if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
          return id;
        }
      }
    }
  } catch {
    // URL parsing failed, try fallback regex
  }

  // 3. Fallback regex matching common YouTube video ID occurrences
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|live\/|shorts\/)|youtu\.be\/)([\w-]{11})/i;
  const match = trimmed.match(regex);
  if (match && match[1] && /^[a-zA-Z0-9_-]{11}$/.test(match[1])) {
    return match[1];
  }

  return null;
}

export function isValidYouTubeUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  return extractYouTubeVideoId(url) !== null;
}

export function getYouTubeWatchUrl(videoId: string, originalUrl?: string): string {
  if (originalUrl && isValidYouTubeUrl(originalUrl) && originalUrl.startsWith('http')) {
    return originalUrl;
  }
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
}
