import { useEffect, useState } from 'react';
import { FileText, Table as TableIcon, Plus, X, Share2, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, Avatar, Badge } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';

const TYPE_LABELS: Record<string, string> = { note: 'Bloc', table: 'Tabla' };

export function WorkspacePage() {
  const { profile } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [peopleMap, setPeopleMap] = useState<Map<string, any>>(new Map());
  const [myPermissions, setMyPermissions] = useState<Map<string, 'view' | 'edit' | 'owner'>>(new Map());
  const [openDoc, setOpenDoc] = useState<any | null>(null);
  const [creating, setCreating] = useState<'note' | 'table' | null>(null);

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
    const doc = { id: newId, title, type, created_by: profile.id, updated_by: profile.id, created_at: nowIso, updated_at: nowIso };

    if (type === 'note') {
      await supabase.from('note_contents').insert({ document_id: doc.id, content: '' });
    } else {
      const { data: col } = await supabase.from('table_columns').insert({ document_id: doc.id, name: 'Columna 1', position: 0 }).select().single();
      const { data: row } = await supabase.from('table_rows').insert({ document_id: doc.id, position: 0 }).select().single();
      if (col && row) await supabase.from('table_cells').insert({ row_id: row.id, column_id: col.id, value: '' });
    }

    await logActivity({ actorName: profile.full_name, action: 'workspace document created', target: 'document', detail: `${title} (${TYPE_LABELS[type]})` });

    setCreating(null);
    setOpenDoc(doc);
    fetchDocs();
  };

  if (!profile) return null;

  return (
    <div>
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

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-ink-500">Cargando…</div></Card>
      ) : docs.length === 0 ? (
        <Card><div className="p-8 text-center text-sm text-ink-500">Aún no hay blocs ni tablas. Crea el primero arriba.</div></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {docs.map((d) => {
            const perm = myPermissions.get(d.id);
            const updater = peopleMap.get(d.updated_by);
            return (
              <Card key={d.id}>
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${d.type === 'note' ? 'bg-amber-50 text-amber-600' : 'bg-primary-50 text-primary-600'}`}>
                    {d.type === 'note' ? <FileText size={18} /> : <TableIcon size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink-900 truncate">{d.title}</div>
                    <div className="text-xs text-ink-500">{TYPE_LABELS[d.type]}</div>
                  </div>
                  <Badge className={perm === 'owner' ? 'bg-primary-50 text-primary-700' : perm === 'edit' ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-100 text-ink-500'}>
                    {perm === 'owner' ? 'Tuyo' : perm === 'edit' ? 'Editar' : 'Ver'}
                  </Badge>
                </div>
                <div className="text-xs text-ink-500 mt-3 pt-3 border-t border-ink-100">
                  Última modificación: {new Date(d.updated_at).toLocaleString('es-PE')}
                  {updater && <div>por {updater.full_name}</div>}
                </div>
                  <div className="flex justify-end gap-2 mt-3">
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
        <NoteEditorModal doc={openDoc} myPermission={myPermissions.get(openDoc.id) ?? 'view'} onClose={() => setOpenDoc(null)} onSaved={fetchDocs} />
      )}
      {openDoc && openDoc.type === 'table' && (
        <TableEditorModal doc={openDoc} myPermission={myPermissions.get(openDoc.id) ?? 'view'} onClose={() => setOpenDoc(null)} onSaved={fetchDocs} />
      )}
    </div>
  );
}

function NoteEditorModal({ doc, myPermission, onClose, onSaved }: { doc: any; myPermission: string; onClose: () => void; onSaved: () => void }) {
  const { profile } = useAuth();
  const canEdit = myPermission === 'owner' || myPermission === 'edit';
  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('note_contents').select('content').eq('document_id', doc.id).single();
      setContent(data?.content ?? '');
      setLoading(false);
    })();
  }, [doc.id]);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    await supabase.from('shared_documents').update({ title, updated_by: profile.id, updated_at: new Date().toISOString() }).eq('id', doc.id);
    await supabase.from('note_contents').update({ content }).eq('document_id', doc.id);
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-ink-900/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4 gap-2">
          <input
            className="text-lg font-bold text-ink-900 border-none focus:outline-none flex-1 min-w-0"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!canEdit}
          />
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setShareOpen(true)} className="h-8 w-8 rounded-md hover:bg-ink-100 flex items-center justify-center text-ink-500" title="Compartir"><Share2 size={16} /></button>
            <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-ink-100 flex items-center justify-center text-ink-500"><X size={16} /></button>
          </div>
        </div>
        {loading ? (
          <div className="py-8 text-center text-sm text-ink-500">Cargando…</div>
        ) : (
          <textarea
            className="input w-full min-h-[240px] resize-y"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={!canEdit}
            placeholder="Escribe aquí…"
          />
        )}
        {!canEdit && <p className="text-xs text-ink-400 mt-2">Solo puedes ver este bloc — no tienes permiso de edición.</p>}
        <div className="flex gap-2 mt-5">
          <button className="btn-secondary flex-1" onClick={onClose}>{canEdit ? 'Cancelar' : 'Cerrar'}</button>
          {canEdit && <button className="btn-primary flex-1" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>}
        </div>
      </div>
      {shareOpen && <ShareModal docId={doc.id} onClose={() => setShareOpen(false)} />}
    </div>
  );
}

function TableEditorModal({ doc, myPermission, onClose, onSaved }: { doc: any; myPermission: string; onClose: () => void; onSaved: () => void }) {
  const { profile } = useAuth();
  const canEdit = myPermission === 'owner' || myPermission === 'edit';
  const [title, setTitle] = useState(doc.title);
  const [columns, setColumns] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [cells, setCells] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: cols }, { data: rws }] = await Promise.all([
      supabase.from('table_columns').select('*').eq('document_id', doc.id).order('position'),
      supabase.from('table_rows').select('*').eq('document_id', doc.id).order('position'),
    ]);
    setColumns(cols ?? []);
    setRows(rws ?? []);
    const rowIds = (rws ?? []).map((r: any) => r.id);
    if (rowIds.length > 0) {
      const { data: cls } = await supabase.from('table_cells').select('*').in('row_id', rowIds);
      const m = new Map<string, string>();
      (cls ?? []).forEach((c: any) => m.set(`${c.row_id}:${c.column_id}`, c.value ?? ''));
      setCells(m);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [doc.id]);

  const setCell = (rowId: string, colId: string, value: string) => {
    setCells((prev) => new Map(prev).set(`${rowId}:${colId}`, value));
  };

  const addColumn = () => {
    setColumns((prev) => [...prev, { id: `new-col-${Date.now()}`, name: `Columna ${prev.length + 1}`, position: prev.length, _new: true }]);
  };
  const addRow = () => {
    setRows((prev) => [...prev, { id: `new-row-${Date.now()}`, position: prev.length, _new: true }]);
  };
  const removeColumn = (colId: string) => setColumns((prev) => prev.filter((c) => c.id !== colId));
  const removeRow = (rowId: string) => setRows((prev) => prev.filter((r) => r.id !== rowId));
  const renameColumn = (colId: string, name: string) => setColumns((prev) => prev.map((c) => (c.id === colId ? { ...c, name } : c)));

  const save = async () => {
    if (!profile) return;
    setSaving(true);

    await supabase.from('shared_documents').update({ title, updated_by: profile.id, updated_at: new Date().toISOString() }).eq('id', doc.id);

    const { data: existingCols } = await supabase.from('table_columns').select('id').eq('document_id', doc.id);
    const originalColIds = new Set((existingCols ?? []).map((c: any) => c.id));
    const colIdMap = new Map<string, string>();
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      if (col._new) {
        const { data: created } = await supabase.from('table_columns').insert({ document_id: doc.id, name: col.name, position: i }).select().single();
        if (created) colIdMap.set(col.id, created.id);
      } else {
        await supabase.from('table_columns').update({ name: col.name, position: i }).eq('id', col.id);
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
        const value = cells.get(`${row.id}:${col.id}`) ?? '';
        cellRows.push({ row_id: realRowId, column_id: realColId, value });
      }
    }
    if (cellRows.length > 0) {
      await supabase.from('table_cells').upsert(cellRows, { onConflict: 'row_id,column_id' });
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-ink-900/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4 gap-2">
          <input
            className="text-lg font-bold text-ink-900 border-none focus:outline-none flex-1 min-w-0"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!canEdit}
          />
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setShareOpen(true)} className="h-8 w-8 rounded-md hover:bg-ink-100 flex items-center justify-center text-ink-500" title="Compartir"><Share2 size={16} /></button>
            <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-ink-100 flex items-center justify-center text-ink-500"><X size={16} /></button>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-ink-500">Cargando…</div>
        ) : (
          <>
            <div className="overflow-x-auto border border-ink-200 rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-ink-50">
                    {columns.map((col) => (
                      <th key={col.id} className="p-2 border-b border-ink-200 text-left">
                        <div className="flex items-center gap-1">
                          <input
                            className="input h-8 text-xs font-semibold flex-1 min-w-[90px]"
                            value={col.name}
                            onChange={(e) => renameColumn(col.id, e.target.value)}
                            disabled={!canEdit}
                          />
                          {canEdit && columns.length > 1 && (
                            <button onClick={() => removeColumn(col.id)} className="text-ink-400 hover:text-red-600 shrink-0"><Trash2 size={13} /></button>
                          )}
                        </div>
                      </th>
                    ))}
                    {canEdit && <th className="p-2 border-b border-ink-200 w-10"></th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-ink-50 last:border-0">
                      {columns.map((col) => (
                        <td key={col.id} className="p-1.5">
                          <input
                            className="input h-8 text-xs min-w-[110px]"
                            value={cells.get(`${row.id}:${col.id}`) ?? ''}
                            onChange={(e) => setCell(row.id, col.id, e.target.value)}
                            disabled={!canEdit}
                          />
                        </td>
                      ))}
                      {canEdit && (
                        <td className="p-1.5 text-center">
                          <button onClick={() => removeRow(row.id)} className="text-ink-400 hover:text-red-600"><Trash2 size={13} /></button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {canEdit && (
              <div className="flex gap-2 mt-3">
                <button className="btn-secondary h-8 text-xs" onClick={addColumn}><Plus size={13} /> Columna</button>
                <button className="btn-secondary h-8 text-xs" onClick={addRow}><Plus size={13} /> Fila</button>
              </div>
            )}
          </>
        )}
        {!canEdit && <p className="text-xs text-ink-400 mt-3">Solo puedes ver esta tabla — no tienes permiso de edición.</p>}

        <div className="flex gap-2 mt-5">
          <button className="btn-secondary flex-1" onClick={onClose}>{canEdit ? 'Cancelar' : 'Cerrar'}</button>
          {canEdit && <button className="btn-primary flex-1" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>}
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
