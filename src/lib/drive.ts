export type DriveKind = 'file' | 'document' | 'presentation' | 'spreadsheet';
export type ParsedDrive = { id: string; kind: DriveKind };

// Google file ids are long strings of letters, numbers, "-" and "_".
const ID_RE = '[A-Za-z0-9_-]{10,}';

/**
 * Reads a Google Drive / Docs link and returns the file id and kind, or null if it is not one we accept.
 * The app NEVER uses the pasted text as an iframe or image address: it only uses the id extracted here
 * to build the addresses below, so a bad or malicious link cannot make the page load another site.
 */
export function parseDriveUrl(raw: string): ParsedDrive | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase();

  if (host === 'drive.google.com') {
    if (/\/folders\//.test(u.pathname)) return null; // folders cannot be played or shown
    const file = u.pathname.match(new RegExp(`/file/(?:u/\\d+/)?d/(${ID_RE})`));
    if (file) return { id: file[1], kind: 'file' };
    const qid = u.searchParams.get('id');
    if ((u.pathname === '/open' || u.pathname === '/uc') && qid && new RegExp(`^${ID_RE}$`).test(qid)) {
      return { id: qid, kind: 'file' };
    }
    return null;
  }

  if (host === 'docs.google.com') {
    const doc = u.pathname.match(new RegExp(`^/(document|presentation|spreadsheets)/(?:u/\\d+/)?d/(${ID_RE})`));
    if (doc) {
      const kind: DriveKind = doc[1] === 'document' ? 'document' : doc[1] === 'presentation' ? 'presentation' : 'spreadsheet';
      return { id: doc[2], kind };
    }
  }

  return null;
}

// Plain-language reason why a link is not accepted (null = the link is fine).
export function driveUrlProblem(raw: string): string | null {
  const value = raw.trim();
  if (!value) return 'Falta el enlace de Google Drive.';

  let u: URL;
  try { u = new URL(value); } catch { return 'Eso no parece un enlace. Copia el enlace completo desde Google Drive.'; }
  if (u.protocol !== 'https:') return 'El enlace debe empezar con https://';

  const host = u.hostname.toLowerCase();
  if (host !== 'drive.google.com' && host !== 'docs.google.com') {
    return 'Solo se aceptan enlaces de Google Drive (drive.google.com) o de Documentos y Presentaciones de Google.';
  }
  if (host === 'drive.google.com' && /\/folders\//.test(u.pathname)) {
    return 'Es un enlace de carpeta. Abre el archivo y copia el enlace del archivo, no el de la carpeta.';
  }
  return parseDriveUrl(value) ? null : 'No se reconoce el enlace. En Drive usa «Compartir → Copiar enlace» sobre el archivo.';
}

const DOCS_SEGMENT: Record<Exclude<DriveKind, 'file'>, string> = {
  document: 'document',
  presentation: 'presentation',
  spreadsheet: 'spreadsheets',
};

// Address for the embedded viewer (iframe). Works only if the file is shared as "anyone with the link".
export function previewUrl(p: ParsedDrive): string {
  if (p.kind === 'file') return `https://drive.google.com/file/d/${p.id}/preview`;
  if (p.kind === 'presentation') return `https://docs.google.com/presentation/d/${p.id}/embed?start=false&loop=false`;
  return `https://docs.google.com/${DOCS_SEGMENT[p.kind]}/d/${p.id}/preview`;
}

// Address to open the original file in Google Drive (new tab).
export function openUrl(p: ParsedDrive): string {
  if (p.kind === 'file') return `https://drive.google.com/file/d/${p.id}/view`;
  return `https://docs.google.com/${DOCS_SEGMENT[p.kind]}/d/${p.id}`;
}

// Thumbnail / image address. Only reliable for files shared as "anyone with the link".
export function thumbnailUrl(p: ParsedDrive, width = 800): string {
  return `https://drive.google.com/thumbnail?id=${p.id}&sz=w${width}`;
}
