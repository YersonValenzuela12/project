import { parseDriveUrl, type ParsedDrive } from './drive';
import { parseYoutubeUrl, type ParsedYoutube } from './youtube';

export type Source = 'DRIVE' | 'YOUTUBE';

// One content points to either a Google Drive file or a YouTube video / playlist.
export type Media =
  | { source: 'DRIVE'; drive: ParsedDrive }
  | { source: 'YOUTUBE'; youtube: ParsedYoutube };

// Turns the stored link into something the viewer can play, or null if it is empty / not valid for that source.
export function resolveMedia(source: Source | undefined, url: string | null): Media | null {
  if (!url) return null;
  if (source === 'YOUTUBE') {
    const youtube = parseYoutubeUrl(url);
    return youtube ? { source: 'YOUTUBE', youtube } : null;
  }
  const drive = parseDriveUrl(url);
  return drive ? { source: 'DRIVE', drive } : null;
}
