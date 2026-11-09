import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, X, Tags, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, Badge } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';
import { cn } from '@/lib/utils';
import { parseDriveUrl, driveUrlProblem, thumbnailUrl } from '@/lib/drive';
import {
  categoryIcon, TYPE_LABEL, LEVEL_LABEL, STATUS_LABEL, STATUS_BADGE, fmtDuration,
  type TrainingCategory, type TrainingContent, type ContentType, type Level, type Status,
} from '@/lib/trainingConfig';
import { TrainingViewer } from '@/components/TrainingViewer';

const byOrder = (a: TrainingContent, b: TrainingContent) =>
  a.display_order - b.display_order || a.created_at.localeCompare(b.created_at);

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export function TrainingAdminPage() {
  const { profile } = useAuth();
  const [cats, setCats] = useState<TrainingCategory[]>([]);
  const [items, setItems] = useState<TrainingContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<TrainingContent | 'new' | null>(null);
  const [catsOpen, setCatsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = async () => {
    const [catRes, itemRes] = await Promise.all([
      supabase.from('training_categories').select('*').order('display_order'),
      supabase.from('training_contents').select('*').order('display_order'),
    ]);
    if (catRes.error || itemRes.error) {
      console.error('Capacitación (admin):', catRes.error ?? itemRes.error);
      setError('No se pudo cargar. ¿Ya corriste la migración SQL de Capacitación?');
    } else {
      setError(null);
      setCats(catRes.data ?? []);
      setItems(itemRes.data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const catById = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);

  // Only administrators manage this module (the database enforces it too).
  if (!profile || profile.role !== 'admin') return null;

  const list = items
    .filter((i) => catFilter === 'all' || i.category_id === catFilter)
    .filter((i) => statusFilter === 'all' || i.status === statusFilter)
    .filter((i) => !query.trim() || i.title.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => (catById.get(a.category_id)?.display_order ?? 99) - (catById.get(b.category_id)?.display_order ?? 99) || byOrder(a, b));

  const setStatus = async (item: TrainingContent, status: Status) => {
    if (status === 'PUBLISHED' && !item.drive_url) { alert('Antes de publicar, agrega el enlace de Google Drive (Editar).'); return; }
    const { data, error: err } = await supabase.from('training_contents').update({ status }).eq('id', item.id).select('id');
    if (err || !data || data.length === 0) { alert(`No se pudo cambiar el estado: ${err?.message ?? 'sin permiso'}`); return; }
    await logActivity({ actorName: profile.full_name, action: status === 'PUBLISHED' ? 'publicó un contenido de capacitación' : 'desactivó un contenido de capacitación', target: 'training', detail: item.title });
    notify(status === 'PUBLISHED' ? 'Contenido publicado.' : 'Contenido desactivado.');
    load();
  };

  const remove = async (item: TrainingContent) => {
    if (!confirm(`¿Eliminar «${item.title}»? Esta acción no se puede deshacer. (El archivo en Google Drive no se borra.)`)) return;
    const { error: err } = await supabase.from('training_contents').delete().eq('id', item.id);
    if (err) { alert(`No se pudo eliminar: ${err.message}`); return; }
    await logActivity({ actorName: profile.full_name, action: 'eliminó un contenido de capacitación', target: 'training', detail: item.title });
    notify('Contenido eliminado.');
    load();
  };

  // Moves a content up or down inside its category, renumbering the group 1..n.
  const move = async (item: TrainingContent, dir: -1 | 1) => {
    const group = items.filter((i) => i.category_id === item.category_id).sort(byOrder);
    const from = group.findIndex((g) => g.id === item.id);
    const to = from + dir;
    if (to < 0 || to >= group.length) return;
    const next = [...group];
    [next[from], next[to]] = [next[to], next[from]];
    const updates = next
      .map((g, k) => ({ id: g.id, display_order: k + 1, prev: g.display_order }))
      .filter((u) => u.display_order !== u.prev);
    const results = await Promise.all(updates.map((u) => supabase.from('training_contents').update({ display_order: u.display_order }).eq('id', u.id)));
    if (results.some((r) => r.error)) alert('No se pudo cambiar el orden.');
    load();
  };

  const isFirst = (i: TrainingContent) => items.filter((x) => x.category_id === i.category_id).sort(byOrder)[0]?.id === i.id;
  const isLast = (i: TrainingContent) => {
    const g = items.filter((x) => x.category_id === i.category_id).sort(byOrder);
    return g[g.length - 1]?.id === i.id;
  };

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-[80] bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 max-w-sm">
          <CheckCircle2 size={16} className="shrink-0" /> {toast}
        </div>
      )}

      <PageHeader
        title="Capacitación técnica"
        subtitle="Administra los contenidos que ven los técnicos. Los archivos viven en Google Drive; aquí solo se guarda la referencia."
        breadcrumbs={['Inicio', 'Administrador', 'Capacitación técnica']}
        actions={
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setCatsOpen(true)}><Tags size={15} /> Categorías</button>
            <button className="btn-primary" onClick={() => setEditing('new')} disabled={cats.length === 0}><Plus size={15} /> Nuevo contenido</button>
          </div>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <input className="input h-9 flex-1 min-w-[180px]" placeholder="Buscar por título…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="input h-9 w-auto" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
            <option value="all">Todas las categorías</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}{c.is_active ? '' : ' (oculta)'}</option>)}
          </select>
          <select className="input h-9 w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | Status)}>
            <option value="all">Todos los estados</option>
            <option value="PUBLISHED">Publicados</option>
            <option value="DRAFT">Borradores</option>
            <option value="INACTIVE">Inactivos</option>
          </select>
        </div>
      </Card>

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-ink-500">Cargando…</div></Card>
      ) : error ? (
        <Card><div className="p-8 text-center text-sm text-red-600">{error}</div></Card>
      ) : list.length === 0 ? (
        <Card><div className="p-8 text-center text-sm text-ink-400">{items.length === 0 ? 'Aún no hay contenidos. Crea el primero con «Nuevo contenido».' : 'Nada coincide con los filtros.'}</div></Card>
      ) : (
        <div className="space-y-3">
          {list.map((i) => {
            const cat = catById.get(i.category_id);
            const Icon = categoryIcon(cat?.name ?? '');
            const thumb = i.thumbnail_url ? parseDriveUrl(i.thumbnail_url) : null;
            return (
              <Card key={i.id}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="h-12 w-20 rounded-md overflow-hidden bg-gradient-to-br from-primary-50 to-ink-100 flex items-center justify-center text-primary-500 shrink-0">
                    {thumb ? (
                      <img src={thumbnailUrl(thumb, 240)} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    ) : <Icon size={20} />}
                  </div>

                  <div className="flex-1 min-w-[200px]">
                    <div className="font-semibold text-ink-900">{i.title}</div>
                    <div className="text-xs text-ink-500 mt-0.5">
                      {cat?.name ?? 'Sin categoría'} · {TYPE_LABEL[i.content_type]} · {LEVEL_LABEL[i.level]}
                      {i.content_type === 'VIDEO' && i.duration_minutes ? ` · ${fmtDuration(i.duration_minutes)}` : ''}
                      {!i.drive_url && <span className="text-amber-600"> · sin enlace</span>}
                    </div>
                  </div>

                  <Badge className={STATUS_BADGE[i.status]}>{STATUS_LABEL[i.status]}</Badge>

                  <div className="flex items-center gap-1">
                    <button className="h-8 w-8 rounded-md border border-ink-200 text-ink-500 hover:bg-ink-50 flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none" title="Subir" disabled={isFirst(i)} onClick={() => move(i, -1)}><ArrowUp size={14} /></button>
                    <button className="h-8 w-8 rounded-md border border-ink-200 text-ink-500 hover:bg-ink-50 flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none" title="Bajar" disabled={isLast(i)} onClick={() => move(i, 1)}><ArrowDown size={14} /></button>
                  </div>

                  <div className="flex items-center gap-2">
                    {i.status === 'PUBLISHED' ? (
                      <button className="btn-secondary h-8 text-xs" onClick={() => setStatus(i, 'INACTIVE')}>Desactivar</button>
                    ) : (
                      <button className="btn-primary h-8 text-xs" onClick={() => setStatus(i, 'PUBLISHED')}>Publicar</button>
                    )}
                    <button className="btn-secondary h-8 text-xs" onClick={() => setEditing(i)}><Pencil size={13} /> Editar</button>
                    <button className="h-8 px-2.5 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 flex items-center gap-1" onClick={() => remove(i)} title="Eliminar"><Trash2 size={13} /></button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <ContentForm
          item={editing === 'new' ? null : editing}
          cats={cats}
          items={items}
          onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); notify(msg); load(); }}
        />
      )}
      {catsOpen && <CategoriesModal cats={cats} items={items} onClose={() => setCatsOpen(false)} onChanged={load} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create / edit form
// ---------------------------------------------------------------------------
function ContentForm({
  item, cats, items, onClose, onSaved,
}: {
  item: TrainingContent | null;
  cats: TrainingCategory[];
  items: TrainingContent[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const { profile } = useAuth();
  const firstCat = cats.find((c) => c.is_active)?.id ?? cats[0]?.id ?? '';

  const [title, setTitle] = useState(item?.title ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [categoryId, setCategoryId] = useState(item?.category_id ?? firstCat);
  const [type, setType] = useState<ContentType>(item?.content_type ?? 'VIDEO');
  const [level, setLevel] = useState<Level>(item?.level ?? 'BASIC');
  const [duration, setDuration] = useState(item?.duration_minutes ? String(item.duration_minutes) : '');
  const [driveUrl, setDriveUrl] = useState(item?.drive_url ?? '');
  const [thumbUrl, setThumbUrl] = useState(item?.thumbnail_url ?? '');
  const [order, setOrder] = useState(String(item?.display_order ?? items.filter((i) => i.category_id === firstCat).length + 1));
  const [status, setStatus] = useState<Status>(item?.status ?? 'DRAFT');
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkProblem = driveUrl.trim() ? driveUrlProblem(driveUrl) : null;
  const parsed = driveUrl.trim() && !linkProblem ? parseDriveUrl(driveUrl) : null;
  const thumbProblem = thumbUrl.trim() ? driveUrlProblem(thumbUrl) : null;

  const save = async () => {
    setError(null);
    if (title.trim().length < 3) { setError('El título debe tener al menos 3 letras.'); return; }
    if (!categoryId) { setError('Elige una categoría.'); return; }
    if (!driveUrl.trim() && status !== 'DRAFT') { setError('Para publicar o dejar inactivo necesitas el enlace de Google Drive. Si aún no lo tienes, guárdalo como Borrador.'); return; }
    if (driveUrl.trim() && linkProblem) { setError(linkProblem); return; }
    if (thumbUrl.trim() && thumbProblem) { setError(`Portada: ${thumbProblem}`); return; }
    if (type === 'VIDEO' && duration && !(Number(duration) >= 1 && Number(duration) <= 600)) { setError('La duración debe estar entre 1 y 600 minutos.'); return; }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      category_id: categoryId,
      content_type: type,
      level,
      drive_url: driveUrl.trim() || null,
      thumbnail_url: thumbUrl.trim() || null,
      duration_minutes: type === 'VIDEO' && duration ? Number(duration) : null,
      display_order: Math.max(1, Math.round(Number(order)) || 1),
      status,
    };

    setSaving(true);
    const res = item
      ? await supabase.from('training_contents').update(payload).eq('id', item.id).select('id')
      : await supabase.from('training_contents').insert(payload).select('id');
    setSaving(false);

    if (res.error || !res.data || res.data.length === 0) {
      console.error('Capacitación: no se pudo guardar', res.error);
      setError(`No se pudo guardar: ${res.error?.message ?? 'sin permiso'}`);
      return;
    }
    if (profile) {
      await logActivity({
        actorName: profile.full_name,
        action: item ? 'editó un contenido de capacitación' : 'creó un contenido de capacitación',
        target: 'training',
        detail: payload.title,
      });
    }
    onSaved(item ? 'Cambios guardados.' : 'Contenido creado.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-3 sm:px-4">
      <div className="absolute inset-0 bg-ink-900/50" onClick={() => !saving && onClose()} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[94vh] flex flex-col overflow-hidden">
        <div className="shrink-0 flex items-center justify-between px-5 pt-4 pb-3 border-b border-ink-100">
          <h3 className="text-base font-bold text-ink-900">{item ? 'Editar contenido' : 'Nuevo contenido'}</h3>
          <button onClick={onClose} disabled={saving} className="h-8 w-8 rounded-md hover:bg-ink-100 flex items-center justify-center text-ink-500"><X size={16} /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-3 text-sm text-red-700">{error}</div>}

          <div>
            <label className="label">Título *</label>
            <input className="input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Instalación de una cámara domo" />
          </div>

          <div>
            <label className="label">Descripción breve</label>
            <textarea className="input" rows={3} maxLength={600} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Qué aprende el técnico con este contenido…" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Categoría *</label>
              <select
                className="input"
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  if (!item) setOrder(String(items.filter((i) => i.category_id === e.target.value).length + 1));
                }}
              >
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}{c.is_active ? '' : ' (oculta)'}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tipo *</label>
              <select className="input" value={type} onChange={(e) => setType(e.target.value as ContentType)}>
                {(Object.keys(TYPE_LABEL) as ContentType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Nivel *</label>
              <select className="input" value={level} onChange={(e) => setLevel(e.target.value as Level)}>
                {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Enlace del contenido en Google Drive {status === 'DRAFT' ? '' : '*'}</label>
            <input className="input" value={driveUrl} onChange={(e) => { setDriveUrl(e.target.value); setShowPreview(false); }} placeholder="https://drive.google.com/file/d/…/view" />
            {driveUrl.trim() && (
              linkProblem
                ? <p className="text-xs text-red-600 mt-1">{linkProblem}</p>
                : <p className="text-xs text-emerald-700 mt-1">✓ Enlace válido ({parsed?.kind === 'file' ? 'archivo de Drive' : 'documento de Google'}).</p>
            )}
            <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              <b>Importante:</b> en Drive abre el archivo → <b>Compartir</b> → Acceso general → <b>«Cualquier persona con el enlace»</b> → rol <b>Lector</b>.
              Si no lo haces, los técnicos verán «Necesitas acceso». No uses este módulo para documentos confidenciales.
            </div>
            {parsed && (
              <div className="mt-2">
                <button type="button" className="btn-secondary h-8 text-xs" onClick={() => setShowPreview((s) => !s)}>
                  {showPreview ? 'Ocultar vista previa' : 'Probar cómo lo verá el técnico'}
                </button>
                {showPreview && <div className="mt-3"><TrainingViewer drive={parsed} type={type} title={title || 'Vista previa'} /></div>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Imagen de portada (enlace de Drive, opcional)</label>
              <input className="input" value={thumbUrl} onChange={(e) => setThumbUrl(e.target.value)} placeholder="https://drive.google.com/file/d/…/view" />
              {thumbUrl.trim() && thumbProblem && <p className="text-xs text-red-600 mt-1">{thumbProblem}</p>}
              <p className="text-[11px] text-ink-400 mt-1">Si no carga, se muestra un bloque de color con el icono del sistema.</p>
            </div>
            {type === 'VIDEO' && (
              <div>
                <label className="label">Duración en minutos (opcional)</label>
                <input className="input" type="number" min="1" max="600" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="12" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Orden de visualización</label>
              <input className="input" type="number" min="1" value={order} onChange={(e) => setOrder(e.target.value)} />
              <p className="text-[11px] text-ink-400 mt-1">1 aparece primero dentro de su categoría. También puedes usar las flechas de la lista.</p>
            </div>
            <div>
              <label className="label">Estado</label>
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
                {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
              <p className="text-[11px] text-ink-400 mt-1">Solo «Publicado» lo ven los técnicos.</p>
            </div>
          </div>
        </div>

        <div className="shrink-0 flex gap-2 px-5 py-3 border-t border-ink-100">
          <button className="btn-secondary flex-1" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn-primary flex-1" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Categories: add, rename, show/hide, reorder (no deletion, so nothing is ever lost)
// ---------------------------------------------------------------------------
function CategoriesModal({
  cats, items, onClose, onChanged,
}: {
  cats: TrainingCategory[];
  items: TrainingContent[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [names, setNames] = useState<Record<string, string>>(() => Object.fromEntries(cats.map((c) => [c.id, c.name])));
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sorted = [...cats].sort((a, b) => a.display_order - b.display_order);
  const countOf = (id: string) => items.filter((i) => i.category_id === id).length;

  const friendly = (e: { code?: string; message: string }) =>
    e.code === '23505' ? 'Ya existe una categoría con ese nombre.' : e.message;

  const rename = async (c: TrainingCategory) => {
    const name = (names[c.id] ?? '').trim();
    if (name === c.name) return;
    if (name.length < 2) { setError('El nombre debe tener al menos 2 letras.'); setNames((n) => ({ ...n, [c.id]: c.name })); return; }
    setError(null);
    const { error: err } = await supabase.from('training_categories').update({ name }).eq('id', c.id);
    if (err) { setError(friendly(err)); setNames((n) => ({ ...n, [c.id]: c.name })); return; }
    onChanged();
  };

  const toggle = async (c: TrainingCategory) => {
    setError(null);
    const { error: err } = await supabase.from('training_categories').update({ is_active: !c.is_active }).eq('id', c.id);
    if (err) { setError(friendly(err)); return; }
    onChanged();
  };

  const move = async (c: TrainingCategory, dir: -1 | 1) => {
    const from = sorted.findIndex((x) => x.id === c.id);
    const to = from + dir;
    if (to < 0 || to >= sorted.length) return;
    const next = [...sorted];
    [next[from], next[to]] = [next[to], next[from]];
    setBusy(true);
    const results = await Promise.all(
      next.map((x, k) => (x.display_order !== k + 1 ? supabase.from('training_categories').update({ display_order: k + 1 }).eq('id', x.id) : Promise.resolve({ error: null }))),
    );
    setBusy(false);
    if (results.some((r) => r.error)) setError('No se pudo cambiar el orden.');
    onChanged();
  };

  const add = async () => {
    const name = newName.trim();
    if (name.length < 2) { setError('Escribe el nombre de la nueva categoría (mínimo 2 letras).'); return; }
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.from('training_categories').insert({ name, display_order: sorted.length + 1 });
    setBusy(false);
    if (err) { setError(friendly(err)); return; }
    setNewName('');
    onChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-3 sm:px-4">
      <div className="absolute inset-0 bg-ink-900/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="shrink-0 flex items-center justify-between px-5 pt-4 pb-3 border-b border-ink-100">
          <h3 className="text-base font-bold text-ink-900">Categorías de capacitación</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-ink-100 flex items-center justify-center text-ink-500"><X size={16} /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {error && <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
          <p className="text-xs text-ink-500 mb-3">
            Cambia el nombre, el orden o si la categoría se muestra a los técnicos. Una categoría oculta esconde también sus contenidos. No se pueden borrar para no perder contenidos.
          </p>

          <div className="space-y-2">
            {sorted.map((c, idx) => (
              <div key={c.id} className="flex items-center gap-2 border border-ink-200 rounded-lg px-2.5 py-2">
                <input
                  className="input h-9 flex-1 min-w-0"
                  value={names[c.id] ?? c.name}
                  maxLength={40}
                  onChange={(e) => setNames((n) => ({ ...n, [c.id]: e.target.value }))}
                  onBlur={() => rename(c)}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                />
                <span className="text-[11px] text-ink-400 w-16 text-center shrink-0">{countOf(c.id)} cont.</span>
                <label className={cn('flex items-center gap-1.5 text-xs shrink-0 cursor-pointer', c.is_active ? 'text-emerald-700' : 'text-ink-400')}>
                  <input type="checkbox" checked={c.is_active} onChange={() => toggle(c)} /> Visible
                </label>
                <button className="h-8 w-8 rounded-md border border-ink-200 text-ink-500 hover:bg-ink-50 flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none" disabled={idx === 0 || busy} onClick={() => move(c, -1)}><ArrowUp size={14} /></button>
                <button className="h-8 w-8 rounded-md border border-ink-200 text-ink-500 hover:bg-ink-50 flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none" disabled={idx === sorted.length - 1 || busy} onClick={() => move(c, 1)}><ArrowDown size={14} /></button>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-ink-100">
            <label className="label">Agregar categoría</label>
            <div className="flex gap-2">
              <input
                className="input h-9 flex-1"
                value={newName}
                maxLength={40}
                placeholder="Ej. Alarmas contra incendios"
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
              />
              <button className="btn-primary h-9 text-xs" onClick={add} disabled={busy}><Plus size={14} /> Agregar</button>
            </div>
          </div>
        </div>

        <div className="shrink-0 px-5 py-3 border-t border-ink-100">
          <button className="btn-secondary w-full" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
