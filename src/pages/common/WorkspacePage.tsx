import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
  FileText, Table as TableIcon, Plus, X, Share2, Trash2, Search, Archive, ArchiveRestore, Copy,
  History, CheckCircle2, ClipboardCopy, Type, Palette, AlignLeft, AlignCenter, AlignRight, Undo2, RotateCcw,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, Avatar, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';

const TYPE_LABELS: Record<string, string> = { note: 'Bloc', table: 'Tabla' };
const CELL_TYPE_LABELS: Record<string, string> = { text: 'Texto', number: 'Número', date: 'Fecha', status: 'Estado' };
const STATUS_OPTIONS = ['Pendiente', 'En progreso', 'Completado'];

// ---------------------------------------------------------------------------
// Colors. Older tables stored a short key ("red", "blue"...); new picks store a
// hex value. resolveColor() understands both, so nothing already saved breaks.
// ---------------------------------------------------------------------------
const LEGACY_COLORS: Record<string, string> = {
  red: '#f4cccc', orange: '#fce5cd', amber: '#fff2cc', emerald: '#d9ead3', blue: '#cfe2f3', violet: '#d9d2e9', gray: '#e5e7eb',
};
const CLASSIC_COLORS = ['#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#cfe2f3', '#d9d2e9', '#e5e7eb'];

const hslToHex = (h: number, s: number, l: number) => {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (x: number) => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
};
const PALETTE_HUES = [0, 25, 45, 120, 170, 205, 235, 275, 320];
const PALETTE_LIGHTNESS = [92, 84, 74, 62, 50];
const PALETTE_GRID = PALETTE_LIGHTNESS.flatMap((l) => PALETTE_HUES.map((h) => hslToHex(h, 75, l)));
const GRAY_COLORS = ['#ffffff', '#f3f4f6', '#e5e7eb', '#d1d5db', '#9ca3af', '#6b7280', '#4b5563', '#374151', '#111827'];

const resolveColor = (value?: string | null): string =>
  !value ? 'transparent' : value.startsWith('#') ? value : LEGACY_COLORS[value] ?? 'transparent';

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const isValidHex = (v: string) => HEX_RE.test(v.trim());
const normalizeHex = (v: string) => {
  let h = v.trim().replace('#', '').toLowerCase();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return `#${h}`;
};

// White text on dark backgrounds so the content stays readable.
const contrastText = (hex: string): string | undefined => {
  if (!hex.startsWith('#') || hex.length < 7) return undefined;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55 ? '#ffffff' : undefined;
};

const RECENT_KEY = 'selecom_ws_recent_colors';
const loadRecents = (): string[] => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; }
};
const saveRecent = (hex: string): string[] => {
  const next = [hex, ...loadRecents().filter((c) => c.toLowerCase() !== hex.toLowerCase())].slice(0, 10);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  return next;
};

type CellType = 'text' | 'number' | 'date' | 'status';
type CellStyle = { b?: boolean; i?: boolean; u?: boolean; up?: boolean; a?: 'left' | 'center' | 'right'; t?: CellType };
type Sel = { r1: number; r2: number; c1: number; c2: number };

const colLetter = (index: number) => {
  let s = '';
  let n = index;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
};

// ---------------------------------------------------------------------------
// Safe HTML for notes: only basic formatting survives. Anything else (scripts,
// images with handlers, links, iframes, unknown attributes) is stripped, both
// when saving and when loading, so a shared note can never run code in
// someone else's browser.
// ---------------------------------------------------------------------------
const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'DIV', 'P', 'SPAN', 'FONT']);
const DROP_WITH_CONTENT = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE']);
const ALLOWED_STYLE_PROPS = new Set(['font-weight', 'font-style', 'text-decoration', 'text-decoration-line', 'text-align', 'background-color']);

function sanitizeHtml(dirty: string): string {
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

// Notes saved as plain text (before formatting existed): escape and keep line breaks so they look identical.
const toEditorHtml = (raw: string): string =>
  /<[a-z][\s\S]*>/i.test(raw)
    ? sanitizeHtml(raw)
    : raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

// ---------------------------------------------------------------------------
// Shared formatting toolbar (used by the note editor and by the table editor)
// ---------------------------------------------------------------------------
type ToolbarState = { b?: boolean; i?: boolean; u?: boolean; up?: boolean; a?: string | null };

function FormatToolbar({
  state, disabled, onBold, onItalic, onUnderline, onAlign, onUpper, onColor, onColorOpen, currentColor, typeValue, onType,
}: {
  state: ToolbarState;
  disabled?: boolean;
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
  onAlign: (a: 'left' | 'center' | 'right') => void;
  onUpper: () => void;
  onColor: (value: string) => void; // 'none' or a hex like '#f4cccc'
  onColorOpen?: () => void;
  currentColor?: string | null;
  typeValue?: string | null;
  onType?: (t: CellType) => void;
}) {
  const [colorPos, setColorPos] = useState<{ top: number; left: number } | null>(null);
  const [typeOpen, setTypeOpen] = useState(false);
  const [hexInput, setHexInput] = useState('');
  const [recents, setRecents] = useState<string[]>([]);
  const colorBtnRef = useRef<HTMLButtonElement>(null);

  const btn = (active?: boolean) =>
    cn('h-7 w-7 rounded-md flex items-center justify-center text-sm transition shrink-0', active ? 'bg-primary-100 text-primary-700' : 'text-ink-600 hover:bg-ink-100');
  const noFocusLoss = { onMouseDown: (e: ReactMouseEvent) => e.preventDefault() };

  const toggleColor = () => {
    if (colorPos) { setColorPos(null); return; }
    onColorOpen?.();
    const rect = colorBtnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 272;
    setColorPos({ top: rect.bottom + 4, left: Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8) });
    setHexInput(currentColor ?? '');
    setRecents(loadRecents());
    setTypeOpen(false);
  };
  const pick = (value: string) => {
    onColor(value);
    if (value !== 'none') setRecents(saveRecent(value));
    setColorPos(null);
  };
  const swatch = (hex: string) => (
    <button
      key={hex}
      type="button"
      {...noFocusLoss}
      onClick={() => pick(hex)}
      className="h-6 rounded-md border border-ink-200 hover:scale-110 transition"
      style={{ backgroundColor: hex }}
      title={hex}
    />
  );
  const sectionLabel = (text: string) => <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400 mt-2.5 mb-1">{text}</p>;

  return (
    <div className={cn('flex items-center gap-0.5 border border-ink-200 rounded-lg p-0.5 relative bg-white flex-wrap', disabled && 'opacity-40 pointer-events-none')}>
      <button type="button" {...noFocusLoss} onClick={onBold} className={cn(btn(state.b), 'font-bold')} title="Negrita">B</button>
      <button type="button" {...noFocusLoss} onClick={onItalic} className={cn(btn(state.i), 'italic font-serif')} title="Cursiva">I</button>
      <button type="button" {...noFocusLoss} onClick={onUnderline} className={cn(btn(state.u), 'underline')} title="Subrayado">U</button>
      <span className="w-px h-4 bg-ink-200 mx-0.5" />
      <button type="button" {...noFocusLoss} onClick={() => onAlign('left')} className={btn(state.a === 'left')} title="Alinear a la izquierda"><AlignLeft size={14} /></button>
      <button type="button" {...noFocusLoss} onClick={() => onAlign('center')} className={btn(state.a === 'center')} title="Centrar"><AlignCenter size={14} /></button>
      <button type="button" {...noFocusLoss} onClick={() => onAlign('right')} className={btn(state.a === 'right')} title="Alinear a la derecha"><AlignRight size={14} /></button>
      <span className="w-px h-4 bg-ink-200 mx-0.5" />
      <button type="button" {...noFocusLoss} onClick={onUpper} className={cn(btn(state.up), 'text-[11px] font-semibold')} title="Mayúsculas">AA</button>

      <button ref={colorBtnRef} type="button" {...noFocusLoss} onClick={toggleColor} className={btn(!!colorPos)} title="Color de resaltado"><Palette size={14} /></button>
      {colorPos && (
        <>
          <div className="fixed inset-0 z-[65]" onClick={() => setColorPos(null)} />
          <div
            className="fixed z-[66] w-[272px] bg-white border border-ink-200 rounded-xl shadow-pop p-3 overflow-y-auto"
            style={{ top: colorPos.top, left: colorPos.left, maxHeight: `calc(100vh - ${colorPos.top + 12}px)` }}
          >
            <button
              type="button"
              {...noFocusLoss}
              onClick={() => pick('none')}
              className="w-full h-7 rounded-md border border-ink-200 text-xs text-ink-600 hover:bg-ink-50 flex items-center justify-center gap-1.5"
            >
              <X size={12} /> Sin color
            </button>

            {recents.length > 0 && (
              <>
                {sectionLabel('Recientes')}
                <div className="grid grid-cols-9 gap-1">{recents.map(swatch)}</div>
              </>
            )}

            {sectionLabel('Clásicos')}
            <div className="grid grid-cols-9 gap-1">{CLASSIC_COLORS.map(swatch)}</div>

            {sectionLabel('Paleta')}
            <div className="grid grid-cols-9 gap-1">{PALETTE_GRID.map(swatch)}</div>

            {sectionLabel('Grises')}
            <div className="grid grid-cols-9 gap-1">{GRAY_COLORS.map(swatch)}</div>

            {sectionLabel('Personalizado')}
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={isValidHex(hexInput) ? normalizeHex(hexInput) : '#ffffff'}
                onChange={(e) => setHexInput(e.target.value)}
                className="h-8 w-10 p-0 border border-ink-200 rounded cursor-pointer bg-white"
                title="Elegir un color exacto"
              />
              <input
                className="input h-8 text-xs flex-1 font-mono"
                value={hexInput}
                onChange={(e) => setHexInput(e.target.value)}
                placeholder="#f4cccc"
                maxLength={7}
              />
              <button
                type="button"
                className="btn-primary h-8 text-xs"
                disabled={!isValidHex(hexInput)}
                onClick={() => pick(normalizeHex(hexInput))}
              >
                Usar
              </button>
            </div>
            {currentColor && (
              <p className="text-[11px] text-ink-400 mt-1.5">
                Color de la selección:{' '}
                <button type="button" className="font-mono underline" onClick={() => setHexInput(currentColor)}>{currentColor}</button>
              </p>
            )}
          </div>
        </>
      )}

      {onType && (
        <>
          <span className="w-px h-4 bg-ink-200 mx-0.5" />
          <div className="relative">
            <button
              type="button"
              {...noFocusLoss}
              onClick={() => { setTypeOpen((o) => !o); setColorPos(null); }}
              className={cn('h-7 px-1.5 rounded-md flex items-center gap-1 text-[11px] font-medium transition', typeOpen ? 'bg-primary-100 text-primary-700' : 'text-ink-600 hover:bg-ink-100')}
              title="Tipo de dato de la celda"
            >
              <Type size={13} /> {typeValue ? CELL_TYPE_LABELS[typeValue] : 'Tipo'}
            </button>
            {typeOpen && (
              <>
                <div className="fixed inset-0 z-[65]" onClick={() => setTypeOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-[66] bg-white border border-ink-200 rounded-lg shadow-pop py-1 w-32">
                  {(Object.entries(CELL_TYPE_LABELS) as [CellType, string][]).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      {...noFocusLoss}
                      onClick={() => { onType(val); setTypeOpen(false); }}
                      className={cn('w-full text-left px-3 py-1.5 text-xs hover:bg-ink-50', typeValue === val && 'font-semibold text-primary-700')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function WorkspacePage() {
  const { profile } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [peopleMap, setPeopleMap] = useState<Map<string, any>>(new Map());
  const [myPermissions, setMyPermissions] = useState<Map<string, 'view' | 'edit' | 'owner'>>(new Map());
  const [openDoc, setOpenDoc] = useState<any | null>(null);
  const [creating, setCreating] = useState<'note' | 'table' | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'note' | 'table'>('all');
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'mine' | 'shared'>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived'>('active');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'az' | 'za'>('recent');

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const fetchDocs = async () => {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase.from('shared_documents').select('*').order('updated_at', { ascending: false });
    const rows = data ?? [];

    const ids = Array.from(new Set([...rows.map((d: any) => d.created_by), ...rows.map((d: any) => d.updated_by)].filter(Boolean)));
    let pm = new Map<string, any>();
    if (ids.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name, initials, avatar_color').in('id', ids);
      pm = new Map((profs ?? []).map((p: any) => [p.id, p]));
    }
    setPeopleMap(pm);

    const { data: shares } = await supabase.from('shared_document_users').select('document_id, permission').eq('user_id', profile.id);
    const permMap = new Map<string, 'view' | 'edit' | 'owner'>();
    rows.forEach((d: any) => { if (d.created_by === profile.id) permMap.set(d.id, 'owner'); });
    (shares ?? []).forEach((s: any) => { if (!permMap.has(s.document_id)) permMap.set(s.document_id, s.permission); });
    setMyPermissions(permMap);

    setDocs(rows);
    setLoading(false);
  };

  useEffect(() => { fetchDocs(); }, [profile?.id]);

  const deleteDoc = async (doc: any) => {
    if (!confirm(`¿Eliminar "${doc.title}"? Esta acción no se puede deshacer, y también se borra para quien lo tenga compartido.`)) return;
    const { error } = await supabase.from('shared_documents').delete().eq('id', doc.id);
    if (error) { alert(`No se pudo eliminar: ${error.message}`); return; }
    notify('Documento eliminado.');
    fetchDocs();
  };

  const archiveDoc = async (doc: any) => {
    if (!profile) return;
    const { error } = await supabase.from('shared_documents').update({
      status: 'archived', archived_at: new Date().toISOString(), archived_by: profile.id,
    }).eq('id', doc.id);
    if (error) { alert(`No se pudo archivar: ${error.message}`); return; }
    await supabase.from('audit_logs').insert({
      actor_name: profile.full_name, action: 'workspace document archived', target: doc.title,
      detail: `${TYPE_LABELS[doc.type]} archivado`, document_id: doc.id,
    });
    notify('Documento archivado.');
    fetchDocs();
  };

  const restoreDoc = async (doc: any) => {
    if (!profile) return;
    const { error } = await supabase.from('shared_documents').update({
      status: 'active', archived_at: null, archived_by: null,
    }).eq('id', doc.id);
    if (error) { alert(`No se pudo restaurar: ${error.message}`); return; }
    await supabase.from('audit_logs').insert({
      actor_name: profile.full_name, action: 'workspace document restored', target: doc.title,
      detail: `${TYPE_LABELS[doc.type]} restaurado`, document_id: doc.id,
    });
    notify('Documento restaurado.');
    fetchDocs();
  };

  const duplicateDoc = async (doc: any) => {
    if (!profile) return;
    const newId = crypto.randomUUID();
    const newTitle = `${doc.title} - Copia`;
    const { error } = await supabase.from('shared_documents').insert({ id: newId, title: newTitle, type: doc.type, updated_by: profile.id });
    if (error) { alert(`No se pudo duplicar: ${error.message}`); return; }

    if (doc.type === 'note') {
      const { data: orig } = await supabase.from('note_contents').select('content').eq('document_id', doc.id).single();
      await supabase.from('note_contents').insert({ document_id: newId, content: orig?.content ?? '' });
    } else {
      const [{ data: cols }, { data: rws }] = await Promise.all([
        supabase.from('table_columns').select('*').eq('document_id', doc.id).order('position'),
        supabase.from('table_rows').select('*').eq('document_id', doc.id).order('position'),
      ]);
      const colIdMap = new Map<string, string>();
      for (const col of cols ?? []) {
        const { data: newCol } = await supabase.from('table_columns').insert({
          document_id: newId, name: col.name, position: col.position, data_type: col.data_type ?? 'text',
          color: col.color ?? null, style: col.style ?? null,
        }).select().single();
        if (newCol) colIdMap.set(col.id, newCol.id);
      }
      const rowIdMap = new Map<string, string>();
      for (const row of rws ?? []) {
        const { data: newRow } = await supabase.from('table_rows').insert({ document_id: newId, position: row.position }).select().single();
        if (newRow) rowIdMap.set(row.id, newRow.id);
      }
      const origRowIds = (rws ?? []).map((r: any) => r.id);
      if (origRowIds.length > 0) {
        const { data: cls } = await supabase.from('table_cells').select('*').in('row_id', origRowIds);
        const newCells = (cls ?? [])
          .map((c: any) => ({ row_id: rowIdMap.get(c.row_id), column_id: colIdMap.get(c.column_id), value: c.value, color: c.color ?? null, style: c.style ?? null }))
          .filter((c: any) => c.row_id && c.column_id);
        if (newCells.length > 0) await supabase.from('table_cells').insert(newCells);
      }
    }

    await supabase.from('audit_logs').insert({
      actor_name: profile.full_name, action: 'workspace document duplicated', target: newTitle,
      detail: `Copia de "${doc.title}"`, document_id: newId,
    });

    notify('Documento duplicado.');
    fetchDocs();
  };

  const createDoc = async (type: 'note' | 'table') => {
    if (!profile) return;
    setCreating(type);
    const title = type === 'note' ? 'Nuevo bloc' : 'Nueva tabla';
    const newId = crypto.randomUUID();
    const { error } = await supabase
      .from('shared_documents')
      .insert({ id: newId, title, type, updated_by: profile.id });
    if (error) {
      console.error('Error al crear el documento:', error);
      alert(`No se pudo crear: ${error.message}`);
      setCreating(null);
      return;
    }
    const nowIso = new Date().toISOString();
    const doc = { id: newId, title, type, created_by: profile.id, updated_by: profile.id, created_at: nowIso, updated_at: nowIso, status: 'active' };

    if (type === 'note') {
      await supabase.from('note_contents').insert({ document_id: doc.id, content: '' });
    } else {
      // New tables start as a small grid (4 columns x 5 rows) so they feel like a sheet.
      const { data: cols } = await supabase
        .from('table_columns')
        .insert(['Columna 1', 'Columna 2', 'Columna 3', 'Columna 4'].map((name, i) => ({ document_id: doc.id, name, position: i, data_type: 'text' })))
        .select();
      const { data: rws } = await supabase
        .from('table_rows')
        .insert(Array.from({ length: 5 }, (_, i) => ({ document_id: doc.id, position: i })))
        .select();
      if (cols && rws) {
        await supabase.from('table_cells').insert(rws.flatMap((r: any) => cols.map((c: any) => ({ row_id: r.id, column_id: c.id, value: '' }))));
      }
    }

    await logActivity({ actorName: profile.full_name, action: 'workspace document created', target: 'document', detail: `${title} (${TYPE_LABELS[type]})` });

    setCreating(null);
    notify(type === 'note' ? 'Bloc creado correctamente.' : 'Tabla creada correctamente.');
    setOpenDoc(doc);
    fetchDocs();
  };

  if (!profile) return null;

  const visibleDocs = docs
    .filter((d) => (d.status ?? 'active') === statusFilter)
    .filter((d) => typeFilter === 'all' || d.type === typeFilter)
    .filter((d) => {
      const perm = myPermissions.get(d.id);
      if (ownerFilter === 'mine') return perm === 'owner';
      if (ownerFilter === 'shared') return perm && perm !== 'owner';
      return true;
    })
    .filter((d) => !searchQuery || d.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'recent') return b.updated_at.localeCompare(a.updated_at);
      if (sortBy === 'oldest') return a.updated_at.localeCompare(b.updated_at);
      if (sortBy === 'az') return a.title.localeCompare(b.title);
      return b.title.localeCompare(a.title);
    });

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-[80] bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in max-w-sm">
          <CheckCircle2 size={16} className="shrink-0" /> {toast}
        </div>
      )}

      <PageHeader
        title="Espacio de Trabajo"
        subtitle="Blocs y tablas compartidas entre el equipo — reemplaza las notas en papel"
        breadcrumbs={['Inicio', 'Espacio de Trabajo']}
        actions={
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => createDoc('note')} disabled={!!creating}>
              <FileText size={15} /> {creating === 'note' ? 'Creando…' : 'Nuevo Bloc'}
            </button>
            <button className="btn-primary" onClick={() => createDoc('table')} disabled={!!creating}>
              <TableIcon size={15} /> {creating === 'table' ? 'Creando…' : 'Nueva Tabla'}
            </button>
          </div>
        }
      />

      <Card className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              className="input h-9 pl-8"
              placeholder="Buscar por título…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select className="input h-9 w-auto" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
            <option value="all">Todos los tipos</option>
            <option value="note">Bloc</option>
            <option value="table">Tabla</option>
          </select>
          <select className="input h-9 w-auto" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value as any)}>
            <option value="all">Mis espacios y compartidos</option>
            <option value="mine">Creados por mí</option>
            <option value="shared">Compartidos conmigo</option>
          </select>
          <select className="input h-9 w-auto" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="recent">Más recientes</option>
            <option value="oldest">Más antiguos</option>
            <option value="az">Nombre A-Z</option>
            <option value="za">Nombre Z-A</option>
          </select>
          <div className="flex items-center gap-1.5 bg-ink-50 rounded-lg p-1 ml-auto">
            <button
              onClick={() => setStatusFilter('active')}
              className={cn('px-3 py-1.5 rounded-md text-xs font-semibold transition', statusFilter === 'active' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800')}
            >Activos</button>
            <button
              onClick={() => setStatusFilter('archived')}
              className={cn('px-3 py-1.5 rounded-md text-xs font-semibold transition', statusFilter === 'archived' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800')}
            >Archivados</button>
          </div>
        </div>
      </Card>

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-ink-500">Cargando…</div></Card>
      ) : visibleDocs.length === 0 ? (
        <Card><div className="p-8 text-center text-sm text-ink-500">
          {statusFilter === 'archived' ? 'No hay documentos archivados.' : docs.length === 0 ? 'Aún no hay blocs ni tablas. Crea el primero arriba.' : 'Nada coincide con tu búsqueda o filtros.'}
        </div></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleDocs.map((d) => {
            const perm = myPermissions.get(d.id);
            const updater = peopleMap.get(d.updated_by);
            const owner = peopleMap.get(d.created_by);
            const isArchived = d.status === 'archived';
            return (
              <Card key={d.id}>
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${d.type === 'note' ? 'bg-amber-50 text-amber-600' : 'bg-primary-50 text-primary-600'}`}>
                    {d.type === 'note' ? <FileText size={18} /> : <TableIcon size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink-900 truncate">{d.title}</div>
                    <div className="text-xs text-ink-500">{TYPE_LABELS[d.type]}{perm !== 'owner' && owner ? ` · de ${owner.full_name}` : ''}</div>
                  </div>
                  <Badge className={perm === 'owner' ? 'bg-primary-50 text-primary-700' : perm === 'edit' ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-100 text-ink-500'}>
                    {perm === 'owner' ? 'Tuyo' : perm === 'edit' ? 'Editar' : 'Ver'}
                  </Badge>
                </div>
                <div className="text-xs text-ink-500 mt-3 pt-3 border-t border-ink-100">
                  Última modificación: {new Date(d.updated_at).toLocaleString('es-PE')}
                  {updater && <div>por {updater.full_name}</div>}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 mt-3">
                  {perm === 'owner' && !isArchived && (
                    <button className="h-8 w-8 rounded-lg border border-ink-200 text-ink-500 hover:bg-ink-50 flex items-center justify-center" title="Archivar" onClick={() => archiveDoc(d)}>
                      <Archive size={13} />
                    </button>
                  )}
                  {perm === 'owner' && isArchived && (
                    <button className="h-8 w-8 rounded-lg border border-ink-200 text-ink-500 hover:bg-ink-50 flex items-center justify-center" title="Restaurar" onClick={() => restoreDoc(d)}>
                      <ArchiveRestore size={13} />
                    </button>
                  )}
                  {(perm === 'owner' || perm === 'edit' || perm === 'view') && (
                    <button className="h-8 w-8 rounded-lg border border-ink-200 text-ink-500 hover:bg-ink-50 flex items-center justify-center" title="Duplicar" onClick={() => duplicateDoc(d)}>
                      <Copy size={13} />
                    </button>
                  )}
                  {perm === 'owner' && (
                    <button
                      className="h-8 px-3 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 flex items-center gap-1.5"
                      onClick={() => deleteDoc(d)}
                    >
                      <Trash2 size={13} /> Eliminar
                    </button>
                  )}
                  <button className="btn-primary h-8 text-xs" onClick={() => setOpenDoc(d)}>
                    Abrir
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {openDoc && openDoc.type === 'note' && (
        <NoteEditorModal doc={openDoc} myPermission={myPermissions.get(openDoc.id) ?? 'view'} owner={peopleMap.get(openDoc.created_by)} onClose={() => setOpenDoc(null)} onSaved={fetchDocs} notify={notify} />
      )}
      {openDoc && openDoc.type === 'table' && (
        <TableEditorModal doc={openDoc} myPermission={myPermissions.get(openDoc.id) ?? 'view'} owner={peopleMap.get(openDoc.created_by)} onClose={() => setOpenDoc(null)} onSaved={fetchDocs} notify={notify} />
      )}
    </div>
  );
}

function DocInfoLine({ doc, owner }: { doc: any; owner: any }) {
  return (
    <p className="text-xs text-ink-400 mb-3">
      {owner && <>Propietario: <span className="text-ink-600">{owner.full_name}</span> · </>}
      Creado: {new Date(doc.created_at).toLocaleDateString('es-PE')}
    </p>
  );
}

function ActivityPanel({ docId }: { docId: string }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('audit_logs').select('*').eq('document_id', docId).order('created_at', { ascending: false }).limit(20);
    setEntries(data ?? []);
    setLoading(false);
  };

  return (
    <div className="mt-4 border-t border-ink-100 pt-3">
      <button className="text-xs font-medium text-ink-500 hover:text-ink-800 flex items-center gap-1.5" onClick={() => { const next = !open; setOpen(next); if (next) load(); }}>
        <History size={13} /> {open ? 'Ocultar actividad' : 'Ver actividad'}
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
          {loading ? (
            <p className="text-xs text-ink-400">Cargando…</p>
          ) : entries.length === 0 ? (
            <p className="text-xs text-ink-400">Sin actividad registrada todavía.</p>
          ) : (
            entries.map((e) => (
              <div key={e.id} className="text-xs text-ink-600">
                <span className="font-medium text-ink-800">{e.actor_name}</span> — {e.detail ?? e.action}
                <span className="text-ink-400"> · {new Date(e.created_at).toLocaleString('es-PE')}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// "Versión anterior": every time someone saves real changes, the state the
// document had just BEFORE that save is kept as a single backup (the previous
// one is replaced). Restoring loads it into the editor; nothing is final until
// the person presses Guardar.
// ---------------------------------------------------------------------------
type BackupInfo = { saved_at: string; saved_by: string | null };

const iconBtn = 'h-8 w-8 rounded-md hover:bg-ink-100 flex items-center justify-center text-ink-500 disabled:opacity-30 disabled:pointer-events-none';

function useBackupInfo(docId: string, canEdit: boolean) {
  const [info, setInfo] = useState<BackupInfo | null>(null);
  useEffect(() => {
    if (!canEdit) return;
    (async () => {
      const { data } = await supabase.from('document_backups').select('saved_at, saved_by').eq('document_id', docId).maybeSingle();
      setInfo(data ?? null);
    })();
  }, [docId, canEdit]);
  return info;
}

async function fetchTableSnapshot(docId: string, title: string) {
  const [{ data: cols }, { data: rws }] = await Promise.all([
    supabase.from('table_columns').select('id, name, position, data_type, color, style').eq('document_id', docId).order('position'),
    supabase.from('table_rows').select('id, position').eq('document_id', docId).order('position'),
  ]);
  const rowIds = (rws ?? []).map((r: any) => r.id);
  const { data: cls } = rowIds.length > 0
    ? await supabase.from('table_cells').select('row_id, column_id, value, color, style').in('row_id', rowIds)
    : { data: [] as any[] };
  return { type: 'table', title, columns: cols ?? [], rows: rws ?? [], cells: cls ?? [] };
}

function NoteEditorModal({ doc, myPermission, owner, onClose, onSaved, notify }: { doc: any; myPermission: string; owner: any; onClose: () => void; onSaved: () => void; notify: (msg: string) => void }) {
  const { profile } = useAuth();
  const canEdit = myPermission === 'owner' || myPermission === 'edit';
  const [title, setTitle] = useState(doc.title);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [fmt, setFmt] = useState<ToolbarState>({});
  const contentRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const backupInfo = useBackupInfo(doc.id, canEdit);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('note_contents').select('content').eq('document_id', doc.id).single();
      const html = toEditorHtml(data?.content ?? '');
      setLoading(false);
      requestAnimationFrame(() => { if (contentRef.current) contentRef.current.innerHTML = html; });
    })();
  }, [doc.id]);

  const refreshFmt = () => {
    if (!canEdit) return;
    setFmt({
      b: document.queryCommandState('bold'),
      i: document.queryCommandState('italic'),
      u: document.queryCommandState('underline'),
      a: document.queryCommandState('justifyCenter') ? 'center' : document.queryCommandState('justifyRight') ? 'right' : 'left',
    });
  };

  const exec = (command: string, value?: string) => {
    if (!canEdit) return;
    contentRef.current?.focus();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, value);
    setDirty(true);
    refreshFmt();
  };

  // The color picker has its own text box, which would steal the text selection; remember it first.
  const rememberSelection = () => {
    const sel = window.getSelection();
    savedRangeRef.current = sel && sel.rangeCount > 0 && contentRef.current?.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
  };
  const applyHighlight = (value: string) => {
    const sel = window.getSelection();
    if (savedRangeRef.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    }
    exec('hiliteColor', value === 'none' ? 'transparent' : value);
  };

  // Real conversion of the selected text to uppercase, keeping bold/italic/etc. untouched.
  const upperSelection = () => {
    const root = contentRef.current;
    const sel = window.getSelection();
    if (!canEdit || !root || !sel || sel.rangeCount === 0 || sel.isCollapsed || !root.contains(sel.anchorNode)) {
      notify('Selecciona primero el texto que quieres pasar a mayúsculas.');
      return;
    }
    const range = sel.getRangeAt(0);
    const { startContainer, startOffset, endContainer, endOffset } = range;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    while (node) {
      if (range.intersectsNode(node)) {
        const text = node.nodeValue ?? '';
        const from = node === startContainer ? startOffset : 0;
        const to = node === endContainer ? endOffset : text.length;
        node.nodeValue = text.slice(0, from) + text.slice(from, to).toUpperCase() + text.slice(to);
      }
      node = walker.nextNode();
    }
    setDirty(true);
    try {
      const restored = document.createRange();
      restored.setStart(startContainer, startOffset);
      restored.setEnd(endContainer, endOffset);
      sel.removeAllRanges();
      sel.addRange(restored);
    } catch { /* selection could not be restored; not critical */ }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(contentRef.current?.innerText ?? '');
      notify('Contenido copiado.');
    } catch {
      alert('No se pudo copiar. Tu navegador bloqueó el acceso al portapapeles.');
    }
  };

  const restoreBackup = async () => {
    const { data } = await supabase.from('document_backups').select('snapshot, saved_at').eq('document_id', doc.id).maybeSingle();
    if (!data?.snapshot || data.snapshot.type !== 'note') { notify('Aún no hay una versión anterior guardada de este bloc.'); return; }
    const when = new Date(data.saved_at).toLocaleString('es-PE');
    if (!confirm(`Se va a cargar la versión anterior (guardada el ${when}). Reemplaza lo que ves ahora; podrás revisarla y pulsar Guardar para confirmarla. ¿Continuar?`)) return;
    if (contentRef.current) contentRef.current.innerHTML = toEditorHtml(data.snapshot.content ?? '');
    if (data.snapshot.title) setTitle(data.snapshot.title);
    setDirty(true);
    notify('Versión anterior cargada. Revísala y pulsa Guardar para confirmar.');
  };

  const save = async () => {
    if (!profile) return;
    setSaving(true);

    if (dirty) {
      // Keep what is stored right now as the single "previous version" before overwriting it.
      const { data: current } = await supabase.from('note_contents').select('content').eq('document_id', doc.id).maybeSingle();
      await supabase.from('document_backups').upsert(
        { document_id: doc.id, snapshot: { type: 'note', title: doc.title, content: current?.content ?? '' }, saved_by: profile.id, saved_at: new Date().toISOString() },
        { onConflict: 'document_id' },
      );
    }

    const html = sanitizeHtml(contentRef.current?.innerHTML ?? '');
    await supabase.from('shared_documents').update({ title, updated_by: profile.id, updated_at: new Date().toISOString() }).eq('id', doc.id);
    await supabase.from('note_contents').update({ content: html }).eq('document_id', doc.id);
    await supabase.from('audit_logs').insert({ actor_name: profile.full_name, action: 'workspace document updated', target: title, detail: 'Bloc actualizado', document_id: doc.id });
    setSaving(false);
    notify('Documento actualizado.');
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-ink-900/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[88vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-1 gap-2">
          <input
            className="text-lg font-bold text-ink-900 border-none focus:outline-none flex-1 min-w-0"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
            disabled={!canEdit}
          />
          <div className="flex items-center gap-1 shrink-0">
            {canEdit && (
              <>
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec('undo')} className={iconBtn} title="Deshacer"><Undo2 size={16} /></button>
                <button
                  onClick={restoreBackup}
                  disabled={!backupInfo}
                  className={iconBtn}
                  title={backupInfo ? `Cargar la versión anterior (guardada el ${new Date(backupInfo.saved_at).toLocaleString('es-PE')})` : 'Aún no hay una versión anterior guardada'}
                >
                  <RotateCcw size={16} />
                </button>
              </>
            )}
            <button onClick={handleCopy} className={iconBtn} title="Copiar contenido"><ClipboardCopy size={16} /></button>
            <button onClick={() => setShareOpen(true)} className={iconBtn} title="Compartir"><Share2 size={16} /></button>
            <button onClick={onClose} className={iconBtn}><X size={16} /></button>
          </div>
        </div>
        <DocInfoLine doc={doc} owner={owner} />

        {loading ? (
          <div className="py-8 text-center text-sm text-ink-500">Cargando…</div>
        ) : (
          <>
            {canEdit && (
              <div className="mb-2 w-fit max-w-full">
                <FormatToolbar
                  state={fmt}
                  onBold={() => exec('bold')}
                  onItalic={() => exec('italic')}
                  onUnderline={() => exec('underline')}
                  onAlign={(a) => exec(a === 'left' ? 'justifyLeft' : a === 'center' ? 'justifyCenter' : 'justifyRight')}
                  onUpper={upperSelection}
                  onColor={applyHighlight}
                  onColorOpen={rememberSelection}
                />
              </div>
            )}
            <div
              ref={contentRef}
              contentEditable={canEdit}
              suppressContentEditableWarning
              onInput={() => setDirty(true)}
              onKeyUp={refreshFmt}
              onMouseUp={refreshFmt}
              onPaste={(e) => {
                // Always paste as plain text so no foreign formatting or markup gets in.
                e.preventDefault();
                document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
              }}
              className={cn('input w-full min-h-[260px] overflow-y-auto leading-relaxed', !canEdit && 'bg-ink-50 text-ink-700')}
              style={{ whiteSpace: 'pre-wrap', height: 'auto' }}
            />
          </>
        )}
        {!canEdit && <p className="text-xs text-ink-400 mt-2">Solo puedes ver este bloc — no tienes permiso de edición.</p>}
        <div className="flex gap-2 mt-5">
          <button className="btn-secondary flex-1" onClick={onClose}>{canEdit ? 'Cancelar' : 'Cerrar'}</button>
          {canEdit && <button className="btn-primary flex-1" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>}
        </div>
        <ActivityPanel docId={doc.id} />
      </div>
      {shareOpen && <ShareModal docId={doc.id} onClose={() => setShareOpen(false)} />}
    </div>
  );
}

// Style/color keys: data cells use "<rowId>:<colId>", title cells use "h:<colId>".
const headerKey = (colId: string) => `h:${colId}`;
const isHeaderKey = (key: string) => key.startsWith('h:');

type TableSnap = {
  columns: any[];
  rows: any[];
  cells: Map<string, string>;
  cellColors: Map<string, string>;
  cellStyles: Map<string, CellStyle>;
};

function TableEditorModal({ doc, myPermission, owner, onClose, onSaved, notify }: { doc: any; myPermission: string; owner: any; onClose: () => void; onSaved: () => void; notify: (msg: string) => void }) {
  const { profile } = useAuth();
  const canEdit = myPermission === 'owner' || myPermission === 'edit';
  const [title, setTitle] = useState(doc.title);
  const [columns, setColumns] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [cells, setCells] = useState<Map<string, string>>(new Map());
  const [cellColors, setCellColors] = useState<Map<string, string>>(new Map());
  const [cellStyles, setCellStyles] = useState<Map<string, CellStyle>>(new Map());
  const [selection, setSelection] = useState<Sel | null>(null);
  const [anchor, setAnchor] = useState<{ r: number; c: number } | null>(null);
  const [undoSnap, setUndoSnap] = useState<TableSnap | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const typingKey = useRef<string | null>(null);
  const backupInfo = useBackupInfo(doc.id, canEdit);

  const load = async () => {
    setLoading(true);
    const [{ data: cols }, { data: rws }] = await Promise.all([
      supabase.from('table_columns').select('*').eq('document_id', doc.id).order('position'),
      supabase.from('table_rows').select('*').eq('document_id', doc.id).order('position'),
    ]);
    setColumns((cols ?? []).map((c: any) => ({ ...c, data_type: c.data_type ?? 'text' })));
    setRows(rws ?? []);

    const valueMap = new Map<string, string>();
    const colorMap = new Map<string, string>();
    const styleMap = new Map<string, CellStyle>();
    (cols ?? []).forEach((c: any) => {
      if (c.color) colorMap.set(headerKey(c.id), c.color);
      if (c.style && typeof c.style === 'object') styleMap.set(headerKey(c.id), c.style);
    });
    const rowIds = (rws ?? []).map((r: any) => r.id);
    if (rowIds.length > 0) {
      const { data: cls } = await supabase.from('table_cells').select('*').in('row_id', rowIds);
      (cls ?? []).forEach((c: any) => {
        const key = `${c.row_id}:${c.column_id}`;
        valueMap.set(key, c.value ?? '');
        if (c.color) colorMap.set(key, c.color);
        if (c.style && typeof c.style === 'object') styleMap.set(key, c.style);
      });
    }
    setCells(valueMap);
    setCellColors(colorMap);
    setCellStyles(styleMap);
    setLoading(false);
  };

  useEffect(() => { load(); }, [doc.id]);

  // ---- undo: one step back (the state before the last action) ----
  const pushUndo = () => {
    setUndoSnap({ columns, rows, cells, cellColors, cellStyles });
    setDirty(true);
    typingKey.current = null;
  };
  // Typing in the same cell counts as a single step.
  const pushUndoTyping = (key: string) => {
    if (typingKey.current !== key) {
      setUndoSnap({ columns, rows, cells, cellColors, cellStyles });
      typingKey.current = key;
    }
    setDirty(true);
  };
  const undo = () => {
    if (!undoSnap) return;
    setColumns(undoSnap.columns);
    setRows(undoSnap.rows);
    setCells(undoSnap.cells);
    setCellColors(undoSnap.cellColors);
    setCellStyles(undoSnap.cellStyles);
    setUndoSnap(null);
    setSelection(null);
    typingKey.current = null;
  };

  // A cell's own type wins; otherwise it inherits the type its column had before (keeps old tables working).
  const effType = (key: string, col: any): CellType => (cellStyles.get(key)?.t ?? col.data_type ?? 'text') as CellType;

  // ---- selection (row -1 is the title row) ----
  const isSelected = (ri: number, ci: number) =>
    !!selection && ri >= selection.r1 && ri <= selection.r2 && ci >= selection.c1 && ci <= selection.c2;

  const handleCellMouseDown = (e: ReactMouseEvent, ri: number, ci: number) => {
    if (!canEdit) return;
    if (e.shiftKey && anchor) {
      e.preventDefault();
      setSelection({ r1: Math.min(anchor.r, ri), r2: Math.max(anchor.r, ri), c1: Math.min(anchor.c, ci), c2: Math.max(anchor.c, ci) });
    } else {
      setAnchor({ r: ri, c: ci });
      setSelection({ r1: ri, r2: ri, c1: ci, c2: ci });
    }
  };
  const handleCellFocus = (ri: number, ci: number) => {
    if (!canEdit) return;
    setAnchor({ r: ri, c: ci });
    setSelection((prev) => (prev && prev.r1 === ri && prev.r2 === ri && prev.c1 === ci && prev.c2 === ci ? prev : { r1: ri, r2: ri, c1: ci, c2: ci }));
  };
  const selectRow = (ri: number) => {
    if (!canEdit || columns.length === 0) return;
    setAnchor({ r: ri, c: 0 });
    setSelection({ r1: ri, r2: ri, c1: 0, c2: columns.length - 1 });
  };
  const selectColumn = (ci: number) => {
    if (!canEdit) return;
    setAnchor({ r: -1, c: ci });
    setSelection({ r1: -1, r2: rows.length - 1, c1: ci, c2: ci });
  };

  const selectedInfo = (): { key: string; col: any; header: boolean }[] => {
    if (!selection) return [];
    const out: { key: string; col: any; header: boolean }[] = [];
    for (let r = selection.r1; r <= selection.r2; r++) {
      for (let c = selection.c1; c <= selection.c2; c++) {
        const col = columns[c];
        if (!col) continue;
        if (r === -1) out.push({ key: headerKey(col.id), col, header: true });
        else if (rows[r]) out.push({ key: `${rows[r].id}:${col.id}`, col, header: false });
      }
    }
    return out;
  };

  // ---- formatting applied to the selected cells ----
  const isFlagOn = (key: string, flag: 'b' | 'i' | 'u' | 'up'): boolean => {
    const v = cellStyles.get(key)?.[flag];
    if (flag === 'b' && isHeaderKey(key)) return v !== false; // titles are bold unless turned off
    return !!v;
  };
  const patchStyles = (fn: (cur: CellStyle, key: string) => CellStyle) => {
    const keys = selectedInfo().map((s) => s.key);
    if (keys.length === 0) return;
    pushUndo();
    setCellStyles((prev) => {
      const next = new Map(prev);
      keys.forEach((k) => {
        const updated = fn({ ...(next.get(k) ?? {}) }, k);
        if (Object.keys(updated).length > 0) next.set(k, updated); else next.delete(k);
      });
      return next;
    });
  };
  const toggleFlag = (flag: 'b' | 'i' | 'u' | 'up') => {
    const list = selectedInfo();
    if (list.length === 0) return;
    const allOn = list.every((s) => isFlagOn(s.key, flag));
    patchStyles((cur, key) => {
      if (allOn) {
        if (flag === 'b' && isHeaderKey(key)) cur.b = false; else delete cur[flag];
      } else {
        cur[flag] = true;
      }
      return cur;
    });
  };
  const setAlign = (a: 'left' | 'center' | 'right') => patchStyles((cur) => { cur.a = a; return cur; });
  const applyColor = (value: string) => {
    const keys = selectedInfo().map((s) => s.key);
    if (keys.length === 0) return;
    pushUndo();
    setCellColors((prev) => {
      const next = new Map(prev);
      keys.forEach((k) => { if (value === 'none') next.delete(k); else next.set(k, value); });
      return next;
    });
  };
  const applyType = (t: CellType) => {
    const keys = selectedInfo().filter((s) => !s.header).map((s) => s.key);
    if (keys.length === 0) { notify('El tipo se cambia en las celdas de datos, no en los títulos.'); return; }
    pushUndo();
    setCellStyles((prev) => {
      const next = new Map(prev);
      keys.forEach((k) => next.set(k, { ...(next.get(k) ?? {}), t }));
      return next;
    });
  };

  const infos = selectedInfo();
  const flagOn = (f: 'b' | 'i' | 'u' | 'up') => infos.length > 0 && infos.every((s) => isFlagOn(s.key, f));
  const aligns = infos.map((s) => cellStyles.get(s.key)?.a ?? (!s.header && effType(s.key, s.col) === 'number' ? 'right' : 'left'));
  const alignState = aligns.length > 0 && aligns.every((a) => a === aligns[0]) ? aligns[0] : null;
  const dataTypes = infos.filter((s) => !s.header).map((s) => effType(s.key, s.col));
  const typeState = dataTypes.length > 0 && dataTypes.every((t) => t === dataTypes[0]) ? dataTypes[0] : null;
  const selColors = infos.map((s) => resolveColor(cellColors.get(s.key)));
  const currentColor = selColors.length > 0 && selColors.every((c) => c === selColors[0]) && selColors[0] !== 'transparent' ? selColors[0] : null;

  // ---- structure edits ----
  const setCell = (rowId: string, colId: string, value: string) => {
    pushUndoTyping(`${rowId}:${colId}`);
    setCells((prev) => new Map(prev).set(`${rowId}:${colId}`, value));
  };
  const addColumn = () => {
    pushUndo();
    pendingScroll.current = 'col';
    setColumns((prev) => [...prev, { id: `new-col-${Date.now()}`, name: `Columna ${prev.length + 1}`, position: prev.length, data_type: 'text', _new: true }]);
  };
  const addRow = () => {
    pushUndo();
    pendingScroll.current = 'row';
    setRows((prev) => [...prev, { id: `new-row-${Date.now()}`, position: prev.length, _new: true }]);
  };
  const renameColumn = (colId: string, name: string) => {
    pushUndoTyping(headerKey(colId));
    setColumns((prev) => prev.map((c) => (c.id === colId ? { ...c, name } : c)));
  };

  const deleteSelectedRows = () => {
    if (!selection || selection.r2 < 0) { notify('Selecciona primero una celda de la fila que quieres borrar.'); return; }
    const from = Math.max(selection.r1, 0);
    const ids = new Set(rows.slice(from, selection.r2 + 1).map((r) => r.id));
    pushUndo();
    setRows((prev) => prev.filter((r) => !ids.has(r.id)));
    setSelection(null);
    setAnchor(null);
  };
  const deleteSelectedColumns = () => {
    if (!selection) { notify('Selecciona primero una celda de la columna que quieres borrar.'); return; }
    const ids = new Set(columns.slice(selection.c1, selection.c2 + 1).map((c) => c.id));
    if (ids.size >= columns.length) { notify('La tabla necesita al menos una columna.'); return; }
    pushUndo();
    setColumns((prev) => prev.filter((c) => !ids.has(c.id)));
    setSelection(null);
    setAnchor(null);
  };

  const handleCopy = async () => {
    const upper = (key: string, v: string) => (cellStyles.get(key)?.up ? v.toUpperCase() : v);
    const header = columns.map((c) => upper(headerKey(c.id), c.name)).join('\t');
    const body = rows
      .map((row) => columns.map((col) => {
        const key = `${row.id}:${col.id}`;
        return upper(key, cells.get(key) ?? '');
      }).join('\t'))
      .join('\n');
    const text = [header, body].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      notify('Tabla copiada — puedes pegarla en Excel o WhatsApp.');
    } catch {
      alert('No se pudo copiar. Tu navegador bloqueó el acceso al portapapeles.');
    }
  };

  // ---- previous version (backup saved automatically on every save with changes) ----
  const restoreBackup = async () => {
    const { data } = await supabase.from('document_backups').select('snapshot, saved_at').eq('document_id', doc.id).maybeSingle();
    const snap = data?.snapshot;
    if (!snap || snap.type !== 'table') { notify('Aún no hay una versión anterior guardada de esta tabla.'); return; }
    const when = new Date(data.saved_at).toLocaleString('es-PE');
    if (!confirm(`Se va a cargar la versión anterior (guardada el ${when}). Reemplaza lo que ves ahora; podrás revisarla y pulsar Guardar para confirmarla. ¿Continuar?`)) return;

    // Rows/columns that still exist keep their id; ones deleted since then come back as new ones.
    const [{ data: dbCols }, { data: dbRows }] = await Promise.all([
      supabase.from('table_columns').select('id').eq('document_id', doc.id),
      supabase.from('table_rows').select('id').eq('document_id', doc.id),
    ]);
    const colIdsInDb = new Set((dbCols ?? []).map((c: any) => c.id));
    const rowIdsInDb = new Set((dbRows ?? []).map((r: any) => r.id));
    const stamp = Date.now();
    const colMap = new Map<string, string>();
    const rowMap = new Map<string, string>();

    const restoredCols = (snap.columns ?? []).map((c: any, i: number) => {
      const exists = colIdsInDb.has(c.id);
      const id = exists ? c.id : `new-col-r${stamp}-${i}`;
      colMap.set(c.id, id);
      return { ...c, id, position: i, data_type: c.data_type ?? 'text', ...(exists ? {} : { _new: true }) };
    });
    const restoredRows = (snap.rows ?? []).map((r: any, i: number) => {
      const exists = rowIdsInDb.has(r.id);
      const id = exists ? r.id : `new-row-r${stamp}-${i}`;
      rowMap.set(r.id, id);
      return { ...r, id, position: i, ...(exists ? {} : { _new: true }) };
    });

    const valueMap = new Map<string, string>();
    const colorMap = new Map<string, string>();
    const styleMap = new Map<string, CellStyle>();
    (snap.columns ?? []).forEach((c: any) => {
      const newId = colMap.get(c.id);
      if (!newId) return;
      if (c.color) colorMap.set(headerKey(newId), c.color);
      if (c.style) styleMap.set(headerKey(newId), c.style);
    });
    (snap.cells ?? []).forEach((c: any) => {
      const r = rowMap.get(c.row_id);
      const col = colMap.get(c.column_id);
      if (!r || !col) return;
      const key = `${r}:${col}`;
      valueMap.set(key, c.value ?? '');
      if (c.color) colorMap.set(key, c.color);
      if (c.style) styleMap.set(key, c.style);
    });

    pushUndo(); // so the restore itself can be undone
    setColumns(restoredCols);
    setRows(restoredRows);
    setCells(valueMap);
    setCellColors(colorMap);
    setCellStyles(styleMap);
    if (snap.title) setTitle(snap.title);
    setSelection(null);
    setAnchor(null);
    notify('Versión anterior cargada. Revísala y pulsa Guardar para confirmar.');
  };

  const save = async () => {
    if (!profile) return;
    setSaving(true);

    if (dirty) {
      // Keep what is stored right now as the single "previous version" before overwriting it.
      const snapshot = await fetchTableSnapshot(doc.id, doc.title);
      await supabase.from('document_backups').upsert(
        { document_id: doc.id, snapshot, saved_by: profile.id, saved_at: new Date().toISOString() },
        { onConflict: 'document_id' },
      );
    }

    await supabase.from('shared_documents').update({ title, updated_by: profile.id, updated_at: new Date().toISOString() }).eq('id', doc.id);

    const { data: existingCols } = await supabase.from('table_columns').select('id').eq('document_id', doc.id);
    const originalColIds = new Set((existingCols ?? []).map((c: any) => c.id));
    const colIdMap = new Map<string, string>();
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const hk = headerKey(col.id);
      const colExtras = { color: cellColors.get(hk) ?? null, style: cellStyles.get(hk) ?? null };
      if (col._new) {
        const { data: created } = await supabase.from('table_columns').insert({ document_id: doc.id, name: col.name, position: i, data_type: col.data_type, ...colExtras }).select().single();
        if (created) colIdMap.set(col.id, created.id);
      } else {
        await supabase.from('table_columns').update({ name: col.name, position: i, data_type: col.data_type, ...colExtras }).eq('id', col.id);
        colIdMap.set(col.id, col.id);
        originalColIds.delete(col.id);
      }
    }
    for (const removedId of originalColIds) await supabase.from('table_columns').delete().eq('id', removedId);

    const { data: existingRows } = await supabase.from('table_rows').select('id').eq('document_id', doc.id);
    const originalRowIds = new Set((existingRows ?? []).map((r: any) => r.id));
    const rowIdMap = new Map<string, string>();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row._new) {
        const { data: created } = await supabase.from('table_rows').insert({ document_id: doc.id, position: i }).select().single();
        if (created) rowIdMap.set(row.id, created.id);
      } else {
        await supabase.from('table_rows').update({ position: i }).eq('id', row.id);
        rowIdMap.set(row.id, row.id);
        originalRowIds.delete(row.id);
      }
    }
    for (const removedId of originalRowIds) await supabase.from('table_rows').delete().eq('id', removedId);

    const cellRows: any[] = [];
    for (const row of rows) {
      const realRowId = rowIdMap.get(row.id) ?? row.id;
      for (const col of columns) {
        const realColId = colIdMap.get(col.id) ?? col.id;
        const key = `${row.id}:${col.id}`;
        cellRows.push({
          row_id: realRowId,
          column_id: realColId,
          value: cells.get(key) ?? '',
          color: cellColors.get(key) ?? null,
          style: cellStyles.get(key) ?? null,
        });
      }
    }
    if (cellRows.length > 0) {
      await supabase.from('table_cells').upsert(cellRows, { onConflict: 'row_id,column_id' });
    }

    await supabase.from('audit_logs').insert({ actor_name: profile.full_name, action: 'workspace document updated', target: title, detail: 'Tabla actualizada', document_id: doc.id });

    setSaving(false);
    notify('Documento actualizado.');
    onSaved();
    onClose();
  };

  const selectionOverlay = <div className="absolute inset-0 pointer-events-none ring-2 ring-inset ring-primary-500 bg-primary-500/10" />;

  // After adding a row or column, scroll the table so the new one is visible.
  const scrollBoxRef = useRef<HTMLDivElement>(null);
  const pendingScroll = useRef<'row' | 'col' | null>(null);
  useEffect(() => {
    const el = scrollBoxRef.current;
    const what = pendingScroll.current;
    if (!el || !what) return;
    if (what === 'row') el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    else el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
    pendingScroll.current = null;
  }, [rows.length, columns.length]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-ink-900/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden">
        {/* Top bar (fixed): title, formatting tools and actions stay in view while the table scrolls */}
        <div className="shrink-0 px-6 pt-5 pb-3 border-b border-ink-100">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              className="text-lg font-bold text-ink-900 border-none focus:outline-none flex-1 min-w-[160px]"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
              disabled={!canEdit}
            />
            {canEdit && (
              <FormatToolbar
                state={{ b: flagOn('b'), i: flagOn('i'), u: flagOn('u'), up: flagOn('up'), a: alignState }}
                disabled={infos.length === 0}
                onBold={() => toggleFlag('b')}
                onItalic={() => toggleFlag('i')}
                onUnderline={() => toggleFlag('u')}
                onAlign={setAlign}
                onUpper={() => toggleFlag('up')}
                onColor={applyColor}
                currentColor={currentColor}
                typeValue={typeState}
                onType={applyType}
              />
            )}
            <div className="flex items-center gap-1 shrink-0">
              {canEdit && (
                <>
                  <button onClick={undo} disabled={!undoSnap} className={iconBtn} title="Deshacer el último cambio"><Undo2 size={16} /></button>
                  <button
                    onClick={restoreBackup}
                    disabled={!backupInfo}
                    className={iconBtn}
                    title={backupInfo ? `Cargar la versión anterior (guardada el ${new Date(backupInfo.saved_at).toLocaleString('es-PE')})` : 'Aún no hay una versión anterior guardada'}
                  >
                    <RotateCcw size={16} />
                  </button>
                </>
              )}
              <button onClick={handleCopy} className={iconBtn} title="Copiar tabla"><ClipboardCopy size={16} /></button>
              <button onClick={() => setShareOpen(true)} className={iconBtn} title="Compartir"><Share2 size={16} /></button>
              <button onClick={onClose} className={iconBtn}><X size={16} /></button>
            </div>
          </div>
          <div className="-mb-2 mt-1"><DocInfoLine doc={doc} owner={owner} /></div>
        </div>

        {/* Middle: only the table scrolls. Column letters, titles and row numbers stay pinned. */}
        <div className="flex-1 min-h-0 flex flex-col px-6 py-3">
          {loading ? (
            <div className="py-8 text-center text-sm text-ink-500">Cargando…</div>
          ) : (
            <>
              <div ref={scrollBoxRef} className="flex-1 min-h-0 overflow-auto border border-ink-300 rounded-lg">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="sticky top-0 left-0 z-[31] w-9 min-w-[36px] bg-ink-100 border border-ink-200 shadow-[inset_-1px_-1px_0_#d1d5db]" />
                      {columns.map((col, ci) => (
                        <th key={col.id} className="sticky top-0 z-[21] bg-ink-100 border border-ink-200 p-0 font-normal shadow-[inset_0_-1px_0_#d1d5db]">
                          <div
                            className={cn('flex items-center justify-center h-6 text-[11px] font-semibold text-ink-500 select-none', canEdit && 'cursor-pointer hover:bg-ink-200/60')}
                            onClick={() => selectColumn(ci)}
                          >
                            {colLetter(ci)}
                          </div>
                        </th>
                      ))}
                    </tr>
                    <tr>
                      <th
                        className={cn('sticky top-[23px] left-0 z-30 bg-ink-100 border border-ink-200 text-[10px] font-semibold text-ink-400 select-none shadow-[inset_-1px_-1px_0_#d1d5db]', canEdit && 'cursor-pointer hover:bg-ink-200/60')}
                        title="Seleccionar la fila de títulos"
                        onClick={() => selectRow(-1)}
                      >
                        T
                      </th>
                      {columns.map((col, ci) => {
                        const hk = headerKey(col.id);
                        const style = cellStyles.get(hk) ?? {};
                        const bg = resolveColor(cellColors.get(hk));
                        return (
                          <th
                            key={col.id}
                            className="sticky top-[23px] z-20 bg-ink-50 border border-ink-200 p-0 shadow-[inset_0_-1px_0_#d1d5db]"
                            style={bg !== 'transparent' ? { backgroundColor: bg } : undefined}
                            onMouseDown={(e) => handleCellMouseDown(e, -1, ci)}
                          >
                            <input
                              className="w-full h-9 min-w-[120px] px-2 bg-transparent outline-none text-xs text-ink-800"
                              style={{
                                textAlign: style.a ?? 'left',
                                fontWeight: isFlagOn(hk, 'b') ? 700 : 400,
                                fontStyle: style.i ? 'italic' : 'normal',
                                textDecoration: style.u ? 'underline' : 'none',
                                textTransform: style.up ? 'uppercase' : 'none',
                                color: contrastText(bg),
                              }}
                              value={col.name}
                              onChange={(e) => renameColumn(col.id, e.target.value)}
                              onFocus={() => handleCellFocus(-1, ci)}
                              readOnly={!canEdit}
                            />
                            {isSelected(-1, ci) && selectionOverlay}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, ri) => (
                      <tr key={row.id}>
                        <td
                          className={cn('sticky left-0 z-10 bg-ink-100 border border-ink-200 text-center text-[11px] font-semibold text-ink-500 select-none shadow-[inset_-1px_0_0_#d1d5db]', canEdit && 'cursor-pointer hover:bg-ink-200/60')}
                          onClick={() => selectRow(ri)}
                        >
                          {ri + 1}
                        </td>
                        {columns.map((col, ci) => {
                          const key = `${row.id}:${col.id}`;
                          const value = cells.get(key) ?? '';
                          const style = cellStyles.get(key) ?? {};
                          const type = effType(key, col);
                          const bg = resolveColor(cellColors.get(key));
                          const align = style.a ?? (type === 'number' ? 'right' : 'left');
                          const textStyle = {
                            textAlign: align,
                            fontWeight: style.b ? 700 : 400,
                            fontStyle: style.i ? 'italic' : 'normal',
                            textDecoration: style.u ? 'underline' : 'none',
                            textTransform: style.up ? 'uppercase' : 'none',
                            color: contrastText(bg),
                          } as const;
                          const common = 'w-full h-9 min-w-[120px] px-2 bg-transparent outline-none text-xs text-ink-900';
                          return (
                            <td
                              key={col.id}
                              className="border border-ink-200 p-0 relative"
                              style={{ backgroundColor: bg }}
                              onMouseDown={(e) => handleCellMouseDown(e, ri, ci)}
                            >
                              {type === 'status' ? (
                                <select
                                  className={common}
                                  style={textStyle}
                                  value={value}
                                  onChange={(e) => setCell(row.id, col.id, e.target.value)}
                                  onFocus={() => handleCellFocus(ri, ci)}
                                  disabled={!canEdit}
                                >
                                  <option value="">—</option>
                                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                              ) : (
                                <input
                                  type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
                                  className={cn(common, '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none')}
                                  style={textStyle}
                                  value={value}
                                  onChange={(e) => setCell(row.id, col.id, e.target.value)}
                                  onFocus={() => handleCellFocus(ri, ci)}
                                  readOnly={!canEdit}
                                />
                              )}
                              {isSelected(ri, ci) && selectionOverlay}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="shrink-0 flex items-center justify-between gap-3 mt-2">
                <p className="text-[11px] text-ink-400">
                  {canEdit
                    ? 'Clic en una celda para darle formato o cambiar su tipo · Shift+clic selecciona varias · el número de fila, la letra de columna o la «T» las seleccionan completas · los cambios se aplican al pulsar Guardar.'
                    : 'Solo puedes ver esta tabla — no tienes permiso de edición.'}
                </p>
                <span className="text-[11px] text-ink-400 shrink-0">{rows.length} filas · {columns.length} columnas</span>
              </div>
            </>
          )}
        </div>

        {/* Bottom bar (fixed): add / delete and save are always within reach */}
        <div className="shrink-0 px-6 py-3 border-t border-ink-100 bg-white">
          {canEdit && !loading && (
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <button className="btn-secondary h-8 text-xs" onClick={addColumn}><Plus size={13} /> Columna</button>
              <button className="btn-secondary h-8 text-xs" onClick={addRow}><Plus size={13} /> Fila</button>
              <div className="ml-auto flex items-center gap-2">
                <button
                  className="h-8 px-3 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
                  onClick={deleteSelectedColumns}
                  disabled={!selection}
                  title={selection ? 'Borrar la(s) columna(s) seleccionada(s)' : 'Selecciona primero una celda de la columna'}
                >
                  <Trash2 size={13} /> Borrar columna
                </button>
                <button
                  className="h-8 px-3 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
                  onClick={deleteSelectedRows}
                  disabled={!selection || selection.r2 < 0}
                  title={selection ? 'Borrar la(s) fila(s) seleccionada(s)' : 'Selecciona primero una celda de la fila'}
                >
                  <Trash2 size={13} /> Borrar fila
                </button>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={onClose}>{canEdit ? 'Cancelar' : 'Cerrar'}</button>
            {canEdit && <button className="btn-primary flex-1" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>}
          </div>
          <ActivityPanel docId={doc.id} />
        </div>
      </div>

      {shareOpen && <ShareModal docId={doc.id} onClose={() => setShareOpen(false)} />}
    </div>
  );
}

function ShareModal({ docId, onClose }: { docId: string; onClose: () => void }) {
  const [people, setPeople] = useState<any[]>([]);
  const [shares, setShares] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: ppl }, { data: shr }] = await Promise.all([
      supabase.rpc('get_shareable_users'),
      supabase.from('shared_document_users').select('*').eq('document_id', docId),
    ]);
    setPeople(ppl ?? []);
    setShares(shr ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [docId]);

  const shareMap = new Map(shares.map((s: any) => [s.user_id, s]));

  const setPermission = async (userId: string, permission: 'view' | 'edit' | null) => {
    setSavingId(userId);
    if (permission === null) {
      await supabase.from('shared_document_users').delete().eq('document_id', docId).eq('user_id', userId);
    } else {
      await supabase.from('shared_document_users').upsert({ document_id: docId, user_id: userId, permission }, { onConflict: 'document_id,user_id' });
    }
    await load();
    setSavingId(null);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-ink-900/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-ink-900">Compartir y acceso</h3>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700"><X size={18} /></button>
        </div>
        {loading ? (
          <div className="py-6 text-center text-sm text-ink-500">Cargando…</div>
        ) : (
          <div className="divide-y divide-ink-50">
            {people.map((p) => {
              const current = shareMap.get(p.id);
              return (
                <div key={p.id} className="flex items-center gap-3 py-2.5">
                  <Avatar initials={p.initials} color={p.avatar_color} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink-900 truncate">{p.full_name}</div>
                    <div className="text-xs text-ink-500 capitalize">{p.role}</div>
                  </div>
                  <select
                    className="input h-8 text-xs w-28"
                    value={current?.permission ?? 'none'}
                    disabled={savingId === p.id}
                    onChange={(e) => setPermission(p.id, e.target.value === 'none' ? null : (e.target.value as 'view' | 'edit'))}
                  >
                    <option value="none">Sin acceso</option>
                    <option value="view">Ver</option>
                    <option value="edit">Editar</option>
                  </select>
                </div>
              );
            })}
            {people.length === 0 && <div className="py-6 text-center text-sm text-ink-400">No hay técnicos ni supervisores disponibles.</div>}
          </div>
        )}
        <button className="btn-secondary w-full mt-5" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
