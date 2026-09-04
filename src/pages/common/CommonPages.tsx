import { useState } from 'react';
import {
  Search, Filter, Upload, FileText, FileImage, FileSpreadsheet, FileCheck, Download, MoreVertical, FolderOpen,
  ChevronDown, ChevronRight, X, Trash2, Users, FileDown,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, Badge, SectionHeader, Avatar } from '@/components/ui';
import { cn } from '@/lib/utils';
import { serviceColor } from '@/data/mockData';
import { supabase } from '@/lib/supabase';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';


  function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatWoLabel(wo: any) {
  const dateStr = wo.scheduled_date
    ? new Date(`${wo.scheduled_date}T00:00:00`).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })
    : null;
  return `${wo.code}${dateStr ? ` · ${dateStr}` : ''} · ${wo.client}`;
}


function guessType(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'Manual';
  if (['doc', 'docx'].includes(ext ?? '')) return 'Form';
  if (['xls', 'xlsx'].includes(ext ?? '')) return 'Schedule';
  if (['png', 'jpg', 'jpeg'].includes(ext ?? '')) return 'Drawing';
  return 'Report';
}

export function DocumentsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [selectedWO, setSelectedWO] = useState('all');
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [expandedUploader, setExpandedUploader] = useState<string | null>(null);
  const [docWoMap, setDocWoMap] = useState<Map<string, any>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      if (profile.role === 'technician') {
        const { data: primary } = await supabase.from('work_orders').select('id, code, client, site, scheduled_date').eq('technician_id', profile.id);
        const { data: assigneeRows } = await supabase.from('work_order_assignees').select('work_order_id').eq('user_id', profile.id);
        const ids = (assigneeRows ?? []).map((r: any) => r.work_order_id);
        const { data: viaAssignment } = ids.length > 0
          ? await supabase.from('work_orders').select('id, code, client, site, scheduled_date').in('id', ids)
          : { data: [] as any[] };
        const merged = [...(primary ?? [])];
        (viaAssignment ?? []).forEach((w: any) => { if (!merged.find((m) => m.id === w.id)) merged.push(w); });
        merged.sort((a, b) => (b.scheduled_date ?? '').localeCompare(a.scheduled_date ?? ''));
        setWorkOrders(merged);
      } else {
        const { data } = await supabase.from('work_orders').select('id, code, client, site, scheduled_date').order('scheduled_date', { ascending: false }).limit(200);
        setWorkOrders(data ?? []);
      }
    })();
  }, [profile?.id]);

  const fetchDocs = async () => {
    setLoading(true);
    let query = supabase.from('documents').select('id, name, type, size, category, uploaded_by, work_order_id, file_path, created_at').order('created_at', { ascending: false });
    if (selectedWO !== 'all') query = query.eq('work_order_id', selectedWO);
    const { data } = await query;
    const rows = data ?? [];

    const uploaderIds = Array.from(new Set(rows.map((d: any) => d.uploaded_by).filter(Boolean)));
    let profileMap = new Map<string, any>();
    if (uploaderIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name, role, initials, avatar_color').in('id', uploaderIds);
      profileMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    }

    const woIds = Array.from(new Set(rows.map((d: any) => d.work_order_id).filter(Boolean)));
    if (woIds.length > 0) {
      const { data: wos } = await supabase.from('work_orders').select('id, code, client, site, scheduled_date').in('id', woIds);
      setDocWoMap(new Map((wos ?? []).map((w: any) => [w.id, w])));
    } else {
      setDocWoMap(new Map());
    }

    setDocs(rows.map((d: any) => ({ ...d, uploader: profileMap.get(d.uploaded_by) })));
    setLoading(false);
  };

  useEffect(() => { fetchDocs(); }, [selectedWO]);

  const canUpload = isAdmin || selectedWO !== 'all';

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !profile || !canUpload) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const path = `${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('Documents').upload(path, file);
      if (uploadError) { alert(`Error subiendo ${file.name}: ${uploadError.message}`); continue; }
      const { error: insertError } = await supabase.from('documents').insert({
        name: file.name,
        type: guessType(file.name),
        size: formatBytes(file.size),
        category: 'Operations',
        uploaded_by: profile.id,
        work_order_id: selectedWO !== 'all' ? selectedWO : null,
        file_path: path,
      });
      if (insertError) alert(`Error guardando metadatos de ${file.name}: ${insertError.message}`);
    }
    setUploading(false);
    fetchDocs();
  };

  const publicUrlFor = (path: string) => supabase.storage.from('Documents').getPublicUrl(path).data.publicUrl;

  const handleDownload = (path: string, name: string) => {
    const a = document.createElement('a');
    a.href = publicUrlFor(path);
    a.download = name;
    a.target = '_blank';
    a.click();
  };

  const handleDownloadGroup = (group: any[]) => {
    group.forEach((d, i) => setTimeout(() => handleDownload(d.file_path, d.name), i * 400));
  };

  const handleDelete = async (d: any) => {
    if (!confirm(`¿Eliminar "${d.name}"? Esta acción no se puede deshacer.`)) return;
    await supabase.storage.from('Documents').remove([d.file_path]);
    await supabase.from('documents').delete().eq('id', d.id);
    setPreviewDoc(null);
    fetchDocs();
  };

  const isImage = (name: string) => /\.(png|jpe?g|gif|webp)$/i.test(name);

  const iconFor = (t: string) => {
    if (t === 'Manual' || t === 'Report' || t === 'Form') return FileText;
    if (t === 'Drawing') return FileImage;
    if (t === 'Schedule') return FileSpreadsheet;
    return FileCheck;
  };

  const groupedByUploader = docs.reduce((acc: Record<string, any[]>, d) => {
    const key = d.uploaded_by ?? 'unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});
  const uploaderGroups = Object.values(groupedByUploader).sort((a: any, b: any) => b.length - a.length);

  const woMap = new Map(workOrders.map((w: any) => [w.id, w]));
  const roleLabelEs: Record<string, string> = { admin: 'administrador', supervisor: 'supervisor', technician: 'técnico' };

  return (
    <div>
      <PageHeader
        title="Gestión Documental"
        subtitle="Fotos y documentos de servicio, organizados por orden de trabajo"
        breadcrumbs={['Inicio', 'Documentos']}
        actions={
          <button className="btn-primary" onClick={() => canUpload && fileInputRef.current?.click()} disabled={uploading || !canUpload}>
            <Upload size={15} /> {uploading ? 'Subiendo…' : 'Subir documento'}
          </button>
        }
      />

      <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => handleFiles(e.target.files)} />

      <Card className="mb-5">
        <label className="label">Orden de trabajo</label>
        <div className="relative">
          <select
            value={selectedWO}
            onChange={(e) => setSelectedWO(e.target.value)}
            className="input appearance-none pr-9"
          >
            <option value="all">Todas las órdenes (biblioteca general)</option>
            {workOrders.map((w) => (
              <option key={w.id} value={w.id}>{formatWoLabel(w)}{w.site ? ` — ${w.site}` : ''}</option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
        </div>
        {!canUpload && (
          <p className="text-xs text-amber-600 mt-2">Selecciona una orden de trabajo para poder subir fotos o documentos.</p>
        )}
      </Card>

      <Card
        className={cn(
          'mb-6 border-2 border-dashed transition',
          canUpload ? 'border-primary-200 bg-primary-50/30 cursor-pointer hover:border-primary-300' : 'border-ink-200 bg-ink-50/30 opacity-60 cursor-not-allowed',
        )}
       onClick={() => { console.log('Click detectado, canUpload:', canUpload, 'input ref:', fileInputRef.current); canUpload && fileInputRef.current?.click(); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (canUpload) handleFiles(e.dataTransfer.files); }}
      >
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="h-11 w-11 rounded-full bg-white shadow-sm flex items-center justify-center text-primary-600 mb-2"><Upload size={22} /></div>
          <div className="text-sm font-medium text-ink-800">
            {uploading ? 'Subiendo…' : 'Arrastra y suelta archivos aquí, o haz clic para explorar'}
          </div>
          <div className="text-xs text-ink-500 mt-1">PDF, DOCX, XLSX, PNG, JPG · hasta 50 MB</div>
        </div>
      </Card>

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-ink-500">Cargando documentos…</div></Card>
      ) : docs.length === 0 ? (
        <Card><div className="p-8 text-center text-sm text-ink-500">Aún no hay documentos aquí.</div></Card>
      ) : isAdmin ? (
        <>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <Card><div className="text-xs text-ink-500 mb-1">Archivos totales</div><div className="text-2xl font-bold text-ink-900">{docs.length}</div></Card>
            <Card><div className="text-xs text-ink-500 mb-1">Personas</div><div className="text-2xl font-bold text-ink-900">{uploaderGroups.length}</div></Card>
          </div>
           <Card pad={false} className="overflow-hidden mb-4">
            <div className="p-5 pb-3"><SectionHeader title="Historial de subida" subtitle="Toca a una persona para ver de qué orden es cada archivo" /></div>
            <div className="divide-y divide-ink-50">
              {uploaderGroups.map((group: any[]) => {
                const u = group[0].uploader;
                const uploaderId = group[0].uploaded_by;
                const last = group.reduce((a, b) => (a.created_at > b.created_at ? a : b));
                const isOpen = expandedUploader === uploaderId;
                return (
                  <div key={uploaderId}>
                    <button
                      onClick={() => setExpandedUploader(isOpen ? null : uploaderId)}
                      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-ink-50/50 text-left"
                    >
                      {u ? <Avatar initials={u.initials} color={u.avatar_color} size="sm" /> : <span className="h-9 w-9 rounded-full bg-ink-200 flex items-center justify-center"><Users size={15} className="text-ink-500" /></span>}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-ink-900">{u?.full_name ?? 'Desconocido'} <span className="text-xs font-normal text-ink-500">· {roleLabelEs[u?.role] ?? '—'}</span></div>
                        <div className="text-xs text-ink-500">{group.length} archivo{group.length === 1 ? '' : 's'} · último {new Date(last.created_at).toLocaleDateString('es-PE')}</div>
                      </div>
                      <span onClick={(e) => { e.stopPropagation(); handleDownloadGroup(group); }} className="h-8 w-8 rounded-md hover:bg-ink-100 flex items-center justify-center text-ink-500" title="Descargar todos"><Download size={15} /></span>
                      {isOpen ? <ChevronDown size={16} className="text-ink-400" /> : <ChevronRight size={16} className="text-ink-400" />}
                    </button>
                    {isOpen && (
                      <div className="bg-ink-50/40 divide-y divide-ink-100">
                        {group.map((d: any) => {
                          const wo = d.work_order_id ? docWoMap.get(d.work_order_id) : null;
                          return (
                            <div key={d.id} className="flex items-center gap-3 pl-16 pr-5 py-2.5">
                              <div className="h-9 w-9 rounded-md overflow-hidden bg-white border border-ink-200 shrink-0 flex items-center justify-center">
                                {isImage(d.name) ? <img src={publicUrlFor(d.file_path)} alt={d.name} className="h-full w-full object-cover" /> : <FileText size={16} className="text-ink-400" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-ink-800 truncate">{d.name}</div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {wo ? (
                                    <Badge className="bg-primary-50 text-primary-700 text-[10px]">{formatWoLabel(wo)}</Badge>
                                  ) : (
                                    <Badge className="bg-ink-100 text-ink-500 text-[10px]">Sin orden asociada</Badge>
                                  )}
                                  <span className="text-[10px] text-ink-400">{new Date(d.created_at).toLocaleString('es-PE')}</span>
                                </div>
                              </div>
                              <button onClick={() => handleDownload(d.file_path, d.name)} className="h-7 w-7 rounded-md hover:bg-white flex items-center justify-center text-ink-500 shrink-0"><Download size={13} /></button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
          <button className="btn-primary w-full" onClick={() => handleDownloadGroup(docs)}>
            <FileDown size={15} /> Descargar todo para el informe
          </button>
        </>
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2">
            {docs.map((d) => (
              <button
                key={d.id}
                onClick={() => setPreviewDoc(d)}
                className="relative aspect-square rounded-lg overflow-hidden border border-ink-200 bg-ink-50 hover:border-primary-300 transition"
              >
                {isImage(d.name) ? (
                  <img src={publicUrlFor(d.file_path)} alt={d.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-ink-400"><FileText size={26} /></div>
                )}
                <span className="absolute bottom-0 left-0 right-0 bg-black/55 text-white text-[9px] text-center py-0.5">
                  {new Date(d.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-400 mb-4">Toca una foto para ver, descargar o eliminar.</p>

          {previewDoc && (
            <Card className="border-primary-200">
              <div className="flex items-start gap-3">
                <div className="h-16 w-16 rounded-lg overflow-hidden bg-ink-50 border border-ink-200 shrink-0 flex items-center justify-center">
                  {isImage(previewDoc.name)
                    ? <img src={publicUrlFor(previewDoc.file_path)} alt={previewDoc.name} className="h-full w-full object-cover" />
                    : <FileText size={26} className="text-ink-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-ink-900 truncate">{previewDoc.name}</p>
                    <button onClick={() => setPreviewDoc(null)} className="text-ink-400 hover:text-ink-700 shrink-0 ml-2"><X size={16} /></button>
                  </div>
                  <p className="text-xs text-ink-500 mb-3">{previewDoc.size} · {new Date(previewDoc.created_at).toLocaleString('es-PE')}</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleDownload(previewDoc.file_path, previewDoc.name)} className="btn-secondary h-8 text-xs"><Download size={13} /> Descargar</button>
                    {previewDoc.uploaded_by === profile?.id && (
                      <button onClick={() => handleDelete(previewDoc)} className="h-8 px-3 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 flex items-center gap-1.5"><Trash2 size={13} /> Eliminar</button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}


export function ProfilePage() {
  const { profile } = useAuth();
  if (!profile) return null;

  const user = {
    name: profile.full_name,
    email: profile.email,
    title: profile.title,
    phone: profile.phone,
    region: profile.region,
    initials: profile.initials,
    color: profile.avatar_color,
    joined: profile.last_login ?? 'N/A',
    jobsCompleted: 0,
    avgRating: 0,
    slaRate: 0,
  };
  return (
    <div>
      <PageHeader title="Mi Perfil" subtitle="Información personal, desempeño y preferencias" breadcrumbs={['Home', 'Profile']} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-1">
          <div className="flex flex-col items-center text-center py-2">
            <Avatar initials={user.initials} color={user.color} size="lg" />
            <h2 className="text-lg font-bold text-ink-900 mt-3">{user.name}</h2>
            <p className="text-sm text-ink-500">{user.title}</p>
            <Badge className="bg-emerald-50 text-emerald-700 mt-2">Active</Badge>
            <div className="grid grid-cols-3 gap-2 w-full mt-5 pt-4 border-t border-ink-100">
              <Stat label="Jobs" value={user.jobsCompleted} />
              <Stat label="Rating" value={user.avgRating} />
              <Stat label="SLA" value={`${user.slaRate}%`} />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-ink-100 space-y-2.5">
            <InfoLine label="Correo" value={user.email} />
            <InfoLine label="Telefono" value={user.phone} />
            <InfoLine label="Distrito" value={user.region} />
            <InfoLine label="Perfil" value={user.joined} />
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-5">
          <Card>
            <SectionHeader title="Información Personal" action={<button className="btn-secondary h-8 text-xs">Edit</button>} />
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Nombre completo</label><input className="input" defaultValue={user.name} /></div>
              <div><label className="label">Correo Electrónico</label><input className="input" defaultValue={user.email} /></div>
              <div><label className="label">Telefono</label><input className="input" defaultValue={user.phone} /></div>
              <div><label className="label">Distrito</label><input className="input" defaultValue={user.region} /></div>
            </div>
          </Card>
          <Card>
            <SectionHeader title="Seguridad" />
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-ink-50"><div><div className="text-sm font-medium text-ink-900">Contraseña</div><div className="text-xs text-ink-500">Last changed 41 days ago</div></div><button className="btn-secondary h-8 text-xs">Change</button></div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50/50"><div><div className="text-sm font-medium text-ink-900">doble autenticasion</div><div className="text-xs text-ink-500">Enabled via authenticator app</div></div><Badge className="bg-emerald-50 text-emerald-700">On</Badge></div>
            </div>
          </Card>
          <Card>
            <SectionHeader title="Habilidades & Certificaciones" />
            <div className="flex flex-wrap gap-2">
              {['CCTV — Level 3', 'Access Control — Level 2', 'Fire Alarm — NFPA 72', 'Fiber Splicing', 'BMS — Siemens Desigo', 'OSHA 30', 'First Aid / CPR'].map((s) => (
                <Badge key={s} className="bg-primary-50 text-primary-700">{s}</Badge>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="text-center"><div className="text-lg font-bold text-ink-900">{value}</div><div className="text-xs text-ink-500">{label}</div></div>;
}
function InfoLine({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between text-sm"><span className="text-ink-500">{label}</span><span className="font-medium text-ink-800">{value}</span></div>;
}

export const _folder = FolderOpen; export const _section = SectionHeader;
