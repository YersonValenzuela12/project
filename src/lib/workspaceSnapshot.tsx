import { useState } from 'react';
import { FileText, Table as TableIcon, Eye, EyeOff, X } from 'lucide-react';
import { supabase } from './supabase';
import { cn } from './utils';

// ---------------------------------------------------------------------------
// A snapshot is a frozen copy of a Workspace note or table, taken at the moment
// it is attached to a form. It lives inside the submission, so the
// administrator can read it without needing access to the original document,
// and later edits by the worker do not change what was submitted.
// ---------------------------------------------------------------------------
export type AttachmentSnapshot = {
  id: string;
  title: string;
  type: 'note' | 'table';
  taken_at: string;
  content?: string;
  columns?: any[];
  rows?: any[];
  cells?: any[];
};

export const MAX_ATTACHMENTS = 5;

// ---- safe HTML (same rules as the Workspace note editor) ----
const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'DIV', 'P', 'SPAN', 'FONT']);
const DROP_WITH_CONTENT = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE']);
const ALLOWED_STYLE_PROPS = new Set(['font-weight', 'font-style', 'text-decoration', 'text-decoration-line', 'text-align', 'background-color']);

export function sanitizeHtml(dirty: string): string {
  const doc = new DOMParser().parseFromString(dirty, 'text/html');
  const clean = (parent: Node) => {
    Array.from(parent.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) return;
      if (child.nodeType !== Node.ELEMENT_NODE) { parent.removeChild(child); return; }
      const el = child as HTMLElement;
      if (DROP_WITH_CONTENT.has(el.tagName)) { parent.removeChild(el); return; }
      if (!ALLOWED_TAGS.has(el.tagName)) {
        clean(el);
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
        return;
      }
      const style = el.getAttribute('style');
      Array.from(el.attributes).forEach((a) => el.removeAttribute(a.name));
      if (style) {
        const kept = style
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean)
          .filter((decl) => {
            const idx = decl.indexOf(':');
            if (idx < 0) return false;
            const prop = decl.slice(0, idx).trim().toLowerCase();
            const value = decl.slice(idx + 1).toLowerCase();
            return ALLOWED_STYLE_PROPS.has(prop) && !/url\(|expression|javascript|@import/.test(value);
          });
        if (kept.length) el.setAttribute('style', kept.join('; '));
      }
      clean(el);
    });
  };
  clean(doc.body);
  return doc.body.innerHTML;
}

const toViewHtml = (raw: string): string =>
  /<[a-z][\s\S]*>/i.test(raw)
    ? sanitizeHtml(raw)
    : raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

// ---- colors (table cells store either an old short key or a hex value) ----
const LEGACY_COLORS: Record<string, string> = {
  red: '#f4cccc', orange: '#fce5cd', amber: '#fff2cc', emerald: '#d9ead3', blue: '#cfe2f3', violet: '#d9d2e9', gray: '#e5e7eb',
};
const resolveColor = (value?: string | null): string =>
  !value ? 'transparent' : value.startsWith('#') ? value : LEGACY_COLORS[value] ?? 'transparent';
const contrastText = (hex: string): string | undefined => {
  if (!hex.startsWith('#') || hex.length < 7) return undefined;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55 ? '#ffffff' : undefined;
};

export async function takeSnapshot(docId: string, title: string, type: 'note' | 'table'): Promise<AttachmentSnapshot> {
  const taken_at = new Date().toISOString();

  if (type === 'note') {
    const { data } = await supabase.from('note_contents').select('content').eq('document_id', docId).maybeSingle();
    return { id: docId, title, type, taken_at, content: toViewHtml(data?.content ?? '') };
  }

  const [{ data: cols }, { data: rws }] = await Promise.all([
    supabase.from('table_columns').select('id, name, position, data_type, color, style').eq('document_id', docId).order('position'),
    supabase.from('table_rows').select('id, position').eq('document_id', docId).order('position'),
  ]);
  const rowIds = (rws ?? []).map((r: any) => r.id);
  const { data: cls } = rowIds.length > 0
    ? await supabase.from('table_cells').select('row_id, column_id, value, color, style').in('row_id', rowIds)
    : { data: [] as any[] };
  return { id: docId, title, type, taken_at, columns: cols ?? [], rows: rws ?? [], cells: cls ?? [] };
}

function NoteView({ s }: { s: AttachmentSnapshot }) {
  return (
    <div
      className="border border-ink-200 rounded-lg p-3 text-sm bg-ink-50 text-ink-800 leading-relaxed max-h-72 overflow-y-auto"
      style={{ whiteSpace: 'pre-wrap' }}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(s.content ?? '') }}
    />
  );
}

function TableView({ s }: { s: AttachmentSnapshot }) {
  const cols = [...(s.columns ?? [])].sort((a, b) => a.position - b.position);
  const rows = [...(s.rows ?? [])].sort((a, b) => a.position - b.position);
  const cellMap = new Map<string, any>((s.cells ?? []).map((c: any) => [`${c.row_id}:${c.column_id}`, c]));

  return (
    <div className="overflow-auto border border-ink-200 rounded-lg max-h-72">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            {cols.map((col) => {
              const st = col.style ?? {};
              const bg = resolveColor(col.color);
              return (
                <th
                  key={col.id}
                  className="border border-ink-200 px-2 py-1.5 bg-ink-50"
                  style={{
                    ...(bg !== 'transparent' ? { backgroundColor: bg } : {}),
                    textAlign: (st.a ?? 'left') as any,
                    fontWeight: st.b === false ? 400 : 700,
                    fontStyle: st.i ? 'italic' : 'normal',
                    textDecoration: st.u ? 'underline' : 'none',
                    textTransform: st.up ? 'uppercase' : 'none',
                    color: contrastText(bg),
                  }}
                >
                  {col.name}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {cols.map((col) => {
                const c = cellMap.get(`${row.id}:${col.id}`);
                const st = c?.style ?? {};
                const type = st.t ?? col.data_type ?? 'text';
                const bg = resolveColor(c?.color);
                let value = c?.value ?? '';
                if (type === 'date' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
                  const [y, m, d] = value.slice(0, 10).split('-');
                  value = `${d}/${m}/${y}`;
                }
                return (
                  <td
                    key={col.id}
                    className="border border-ink-200 px-2 py-1.5"
                    style={{
                      backgroundColor: bg,
                      textAlign: (st.a ?? (type === 'number' ? 'right' : 'left')) as any,
                      fontWeight: st.b ? 700 : 400,
                      fontStyle: st.i ? 'italic' : 'normal',
                      textDecoration: st.u ? 'underline' : 'none',
                      textTransform: st.up ? 'uppercase' : 'none',
                      color: contrastText(bg),
                    }}
                  >
                    {value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SnapshotList({ items, onRemove }: { items: AttachmentSnapshot[]; onRemove?: (id: string) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {items.map((s) => (
        <div key={s.id} className="border border-ink-200 rounded-lg bg-white">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className={cn('h-8 w-8 rounded-md flex items-center justify-center shrink-0', s.type === 'note' ? 'bg-amber-50 text-amber-600' : 'bg-primary-50 text-primary-600')}>
              {s.type === 'note' ? <FileText size={15} /> : <TableIcon size={15} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ink-900 truncate">{s.title}</div>
              <div className="text-[11px] text-ink-400">
                {s.type === 'note' ? 'Bloc' : 'Tabla'} · copia del {new Date(s.taken_at).toLocaleString('es-PE')}
              </div>
            </div>
            <button
              type="button"
              className="h-7 px-2 rounded-md text-xs text-ink-600 hover:bg-ink-100 flex items-center gap-1"
              onClick={() => setOpenId(openId === s.id ? null : s.id)}
            >
              {openId === s.id ? <><EyeOff size={13} /> Ocultar</> : <><Eye size={13} /> Ver</>}
            </button>
            {onRemove && (
              <button type="button" className="h-7 w-7 rounded-md text-ink-400 hover:bg-red-50 hover:text-red-600 flex items-center justify-center" title="Quitar adjunto" onClick={() => onRemove(s.id)}>
                <X size={14} />
              </button>
            )}
          </div>
          {openId === s.id && (
            <div className="p-3 border-t border-ink-100">
              {s.type === 'note' ? <NoteView s={s} /> : <TableView s={s} />}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
