import { useState, useEffect } from 'react';
import { Car, HeartPulse, MessageSquareWarning, Receipt, FileText, PenLine, Check, ChevronLeft, Download, FileImage } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, SectionHeader, Badge, Modal, Tabs } from '@/components/ui';
import { cn } from '@/lib/utils';
import { forms, technicianHistory, statusColor, statusLabel } from '@/data/mockData';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';

const iconMap: Record<string, typeof Car> = { Car, HeartPulse: HeartPulse, MessageSquareWarning, Receipt };

function formTypeFor(name: string) {
  if (name === 'Mobility Form') return 'mobility';
  if (name === 'Medical Leave Form') return 'medical_leave';
  if (name === 'Complaint Form') return 'complaint';
  if (name === 'Expense Claim') return 'expense_claim';
  return 'other';
}

function formLabelFor(type: string) {
  if (type === 'mobility') return 'Mobilidad Form';
  if (type === 'medical_leave') return 'Medico Leave Form';
  if (type === 'complaint') return 'Complaint Form';
  if (type === 'expense_claim') return 'Expense Claim';
  return type;
}

export function FormsPage() {
  const { profile } = useAuth();
  const [active, setActive] = useState<string | null>(null);
  const form = forms.find((f) => f.id === active);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(true);

  const fetchSubmissions = async () => {
    if (!profile) return;
    setLoadingSubs(true);
    const { data } = await supabase
      .from('form_submissions')
      .select('*')
      .eq('submitted_by', profile.id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setSubmissions(data);
    setLoadingSubs(false);
  };

  useEffect(() => { fetchSubmissions(); }, [profile?.id]);

  const openForm = (id: string) => {
    setActive(id);
    setSubmitted(false);
    setError(null);
    setFields({});
  };

  const submit = async () => {
    if (!profile || !form) return;
    setError(null);
    setSaving(true);

    const formType = formTypeFor(form.name);
    const { error: insertError } = await supabase.from('form_submissions').insert({
      form_type: formType,
      submitted_by: profile.id,
      data: fields,
      status: 'pending',
    });

    if (insertError) {
      setSaving(false);
      setError(insertError.message);
      return;
    }
    await logActivity({
      actorName: profile.full_name,
      action: 'envió un formulario',
      target: 'form_submission',
      detail: formLabelFor(formType),
    });
    // Notify all admins (usa get_admin_ids() porque RLS le impide al técnico leer otros perfiles)
    const { data: adminIds, error: adminsError } = await supabase.rpc('get_admin_ids');
    if (adminsError) {
      console.error('Could not fetch admins to notify:', adminsError.message);
    } else if (adminIds && adminIds.length > 0) {
      const rows = adminIds.map((id: string) => ({
        user_id: id,
        type: 'form_submitted',
        title: `${form.name} submitted`,
        body: `by ${profile.full_name}`,
        color: 'bg-violet-500',
        unread: true,
        actor_id: profile.id,
      }));
      const { error: notifError } = await supabase.from('notifications').insert(rows);
      if (notifError) console.error('Could not create admin notifications:', notifError.message);
    } else {
      console.warn('No admin profiles found to notify.');
    }

    setSaving(false);
    setSubmitted(true);
    fetchSubmissions();
  };

  return (
    <div>
      <PageHeader title="Forms" subtitle="Submit and track your field and HR forms" breadcrumbs={['Home', 'Technician', 'Forms']} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {forms.map((f) => {
          const Icon = iconMap[f.icon] ?? FileText;
          return (
            <button key={f.id} onClick={() => openForm(f.id)} className="card-pad text-left group hover:shadow-card-md hover:border-primary-200 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="h-11 w-11 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center group-hover:bg-primary-600 group-hover:text-white transition-colors"><Icon size={22} /></div>
                <Badge className="bg-emerald-50 text-emerald-700">Available</Badge>
              </div>
              <div className="font-semibold text-ink-900">{f.name}</div>
              <div className="text-sm text-ink-500 mt-1">{f.desc}</div>
              <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary-600 group-hover:text-primary-700">Start form <ChevronLeft size={14} className="rotate-180" /></div>
            </button>
          );
        })}
      </div>

      {/* Recent submissions */}
      <Card className="mt-6" pad={false}>
        <div className="p-5 pb-3"><SectionHeader title="Recent Submissions" /></div>
        <div className="divide-y divide-ink-50">
          {loadingSubs ? (
            <div className="px-5 py-8 text-center text-sm text-ink-500">Loading…</div>
          ) : submissions.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-ink-400">No submissions yet.</div>
          ) : submissions.map((s) => (
            <div key={s.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className="h-9 w-9 rounded-lg bg-ink-100 text-ink-600 flex items-center justify-center"><FileText size={17} /></div>
              <div className="flex-1">
                <div className="text-sm font-medium text-ink-900">{formLabelFor(s.form_type)}</div>
                <div className="text-xs text-ink-500">submitted {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              </div>
              <Badge className={s.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : s.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}>{s.status}</Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* Form modal */}
      <Modal
        open={!!form}
        onClose={() => setActive(null)}
        title={form?.name ?? ''}
        size="lg"
        footer={submitted ? (
          <button className="btn-primary" onClick={() => setActive(null)}>Done</button>
        ) : (
          <>
            <button className="btn-secondary" onClick={() => setActive(null)} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={submit} disabled={saving}><PenLine size={15} /> {saving ? 'Submitting…' : 'Sign & Submit'}</button>
          </>
        )}
      >
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3.5 py-3 text-sm text-red-700">{error}</div>
        )}
        {form && !submitted && <FormBody name={form.name} fields={fields} setFields={setFields} signerName={profile?.full_name ?? ''} />}
        {submitted && (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3"><Check size={28} strokeWidth={3} /></div>
            <div className="text-lg font-semibold text-ink-900">Form submitted</div>
            <p className="text-sm text-ink-500 mt-1">Your {form?.name ?? 'form'} has been sent for approval. You'll be notified when it's reviewed.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function FormBody({
  name,
  fields,
  setFields,
  signerName,
}: {
  name: string;
  fields: Record<string, string>;
  setFields: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  signerName: string;
}) {
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setFields((prev) => ({ ...prev, [key]: e.target.value }));
  const v = (key: string, fallback = '') => fields[key] ?? fallback;

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-primary-50/50 border border-primary-100 text-sm text-primary-800">
        <span className="font-semibold">{name}</span> — all fields marked with * are required. Your digital signature will be applied on submission.
      </div>
      {name === 'Mobility Form' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Tipo de movilidad *</label><input className="input" value={v('vehicle')} onChange={set('vehicle')} placeholder="uber-propio-colectivo" /></div>
            <div><label className="label">tiempo *</label><input className="input" value={v('period')} onChange={set('period')} placeholder="2hr, 2026" /></div>
            <div><label className="label">Inicio  *</label><input className="input" value={v('start_mileage')} onChange={set('start_mileage')} placeholder="san isidro" /></div>
            <div><label className="label">llegada *</label><input className="input" value={v('end_mileage')} onChange={set('end_mileage')} placeholder="surco" /></div>
          </div> 
          <div><label className="label">Tipo de viaje</label><textarea className="input min-h-[80px]" value={v('routes')} onChange={set('routes')} placeholder="Detalla si se llevo herramientas…" /></div>
        </>
      )}
      {name === 'Medical Leave Form' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tipo de baja *</label>
              <select className="input" value={v('leave_type', 'Sick leave')} onChange={set('leave_type')}>
                <option>Tipo de baja</option><option>Procedimiento Medico</option><option>Recupercación</option>
              </select>
            </div>
            <div><label className="label">Dias de Recuperacion*</label><input className="input" value={v('days')} onChange={set('days')} placeholder="3" /></div>
            <div><label className="label">Inicio *</label><input type="date" className="input" value={v('from_date')} onChange={set('from_date')} /></div>
            <div><label className="label">Salida *</label><input type="date" className="input" value={v('to_date')} onChange={set('to_date')} /></div>
          </div>
          <div><label className="label">Razon / Notas</label><textarea className="input min-h-[80px]" value={v('notes')} onChange={set('notes')} placeholder="Breve descripcion…" /></div>
        </>
      )}
      {(name === 'Complaint Form' || name === 'Expense Claim') && (
        <>
          <div><label className="label">Tema *</label><input className="input" value={v('subject')} onChange={set('subject')} placeholder="Brief subject" /></div>
          <div><label className="label">Fecha *</label><input type="date" className="input" value={v('date')} onChange={set('date')} /></div>
          <div><label className="label">Detalles *</label><textarea className="input min-h-[120px]" value={v('details')} onChange={set('details')} placeholder="Detalles de la queja…" /></div>
          {name === 'Expense Claim' && (
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Costo *</label><input className="input" value={v('amount')} onChange={set('amount')} placeholder="S/. 0.00" /></div>
              <div>
                <label className="label">Categoria *</label>
                <select className="input" value={v('category', 'Materials')} onChange={set('category')}>
                  <option>Materials</option><option>Travel</option><option>Equipment</option><option>Other</option>
                </select>
              </div>
            </div>
          )}
        </>
      )}

      {/* Signature */}
      <div className="pt-4 border-t border-ink-100">
        <label className="label">Digital signature</label>
        <div className="rounded-lg border-2 border-dashed border-ink-200 bg-ink-50/40 h-24 flex items-center justify-center text-ink-400">
          <div className="text-center">
            <PenLine size={20} className="mx-auto mb-1" />
            <span className="text-xs">Click to sign — {signerName || 'your name'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
const SERVICE_LABELS_ES: Record<string, string> = {
  CCTV: 'CCTV', 'Access Control': 'Control de Acceso', 'Fire Alarm': 'Alarma contra Incendio',
  'Fire Water': 'Alarma de Agua', BMS: 'BMS', 'Electronic Security': 'Seguridad Electrónica',
};

function isImageFile(name: string) {
  return /\.(png|jpe?g|gif|webp)$/i.test(name);
}

export function HistoryPage() {
  const { profile } = useAuth();
  const [completedOrders, setCompletedOrders] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);

      const { data: primary } = await supabase.from('work_orders').select('*').eq('technician_id', profile.id).eq('status', 'completed');
      const { data: assigneeRows } = await supabase.from('work_order_assignees').select('work_order_id').eq('user_id', profile.id);
      const assignedIds = (assigneeRows ?? []).map((r: any) => r.work_order_id);
      const { data: viaAssignment } = assignedIds.length > 0
        ? await supabase.from('work_orders').select('*').in('id', assignedIds).eq('status', 'completed')
        : { data: [] as any[] };
      const mergedOrders = [...(primary ?? [])];
      (viaAssignment ?? []).forEach((w: any) => { if (!mergedOrders.find((m) => m.id === w.id)) mergedOrders.push(w); });
      mergedOrders.sort((a, b) => (b.scheduled_date ?? '').localeCompare(a.scheduled_date ?? ''));
      setCompletedOrders(mergedOrders);

      const { data: docs } = await supabase
        .from('documents')
        .select('id, name, size, file_path, created_at')
        .eq('uploaded_by', profile.id)
        .order('created_at', { ascending: false });

      setReports((docs ?? []).filter((d: any) => !isImageFile(d.name)));
      setPhotos((docs ?? []).filter((d: any) => isImageFile(d.name)));

      setLoading(false);
    })();
  }, [profile?.id]);

  const publicUrlFor = (path: string) => supabase.storage.from('Documents').getPublicUrl(path).data.publicUrl;

  const handleDownload = (path: string, name: string) => {
    const a = document.createElement('a');
    a.href = publicUrlFor(path);
    a.download = name;
    a.target = '_blank';
    a.click();
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Mi Historial" subtitle="Órdenes completadas, reportes y documentos subidos" breadcrumbs={['Inicio', 'Técnico', 'Historial']} />
        <Card><div className="p-8 text-center text-sm text-ink-500">Cargando historial…</div></Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Mi Historial" subtitle="Órdenes completadas, reportes y documentos subidos" breadcrumbs={['Inicio', 'Técnico', 'Historial']} />

      <Card pad={false} className="overflow-hidden mb-6">
        <div className="p-5 pb-3"><SectionHeader title="Órdenes de Trabajo Completadas" subtitle={`${completedOrders.length} trabajo${completedOrders.length === 1 ? '' : 's'}`} /></div>
        {completedOrders.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-500">Aún no tienes órdenes completadas.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-ink-50/50 border-y border-ink-100">
                <tr><th className="th">Orden</th><th className="th">Cliente</th><th className="th">Servicio</th><th className="th">Fecha</th><th className="th">Estado</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {completedOrders.map((h) => (
                  <tr key={h.id} className="hover:bg-ink-50/40">
                    <td className="td font-mono text-xs font-semibold text-primary-700">{h.code}</td>
                    <td className="td font-medium text-ink-900">{h.client}</td>
                    <td className="td text-ink-600">{SERVICE_LABELS_ES[h.service_type] ?? h.service_type}</td>
                    <td className="td text-ink-500">{h.scheduled_date ? new Date(`${h.scheduled_date}T00:00:00`).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }) : '—'}</td>
                    <td className="td"><Badge className="bg-emerald-50 text-emerald-700">Completado</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card pad={false}>
          <div className="p-5 pb-3"><SectionHeader title="Reportes Subidos" /></div>
          {reports.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-ink-400">Aún no has subido reportes.</div>
          ) : (
            <div className="divide-y divide-ink-50">
              {reports.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50/40">
                  <div className="h-9 w-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center"><FileText size={16} /></div>
                  <div className="flex-1 min-w-0"><div className="text-sm font-medium text-ink-900 truncate">{r.name}</div><div className="text-xs text-ink-500">{r.size}</div></div>
                  <button onClick={() => handleDownload(r.file_path, r.name)} className="h-8 w-8 rounded-md hover:bg-ink-100 flex items-center justify-center text-ink-500"><Download size={15} /></button>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card pad={false}>
          <div className="p-5 pb-3"><SectionHeader title="Fotos Subidas" /></div>
          {photos.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-ink-400">Aún no has subido fotos.</div>
          ) : (
            <div className="grid grid-cols-3 gap-2 p-4">
              {photos.map((p) => (
                <a key={p.id} href={publicUrlFor(p.file_path)} target="_blank" rel="noreferrer" className="aspect-square rounded-lg overflow-hidden bg-ink-100 block">
                  <img src={publicUrlFor(p.file_path)} alt={p.name} className="h-full w-full object-cover" />
                </a>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export function AdminFormsPage({ readOnly = false }: { readOnly?: boolean } = {}) {
  const { profile } = useAuth();
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('form_submissions')
      .select('id, form_type, submitted_by, data, status, created_at')
      .order('created_at', { ascending: false });

    if (data) {
      const userIds = Array.from(new Set(data.map((d: any) => d.submitted_by)));
      let names = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
        names = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
      }
      setSubs(data.map((d: any) => ({ ...d, submitterName: names.get(d.submitted_by) ?? 'Desconocido' })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = subs.filter((s) => s.status === statusFilter);

  const resolve = async (id: string, newStatus: 'approved' | 'rejected', submitterName: string, formType: string) => {
    setActingId(id);
    const { error } = await supabase.from('form_submissions').update({ status: newStatus }).eq('id', id);
    if (!error) {
      await logActivity({
        actorName: profile?.full_name ?? 'Administrador',
        action: newStatus === 'approved' ? 'aprobó un formulario' : 'rechazó un formulario',
        target: 'form_submission',
        detail: `${formLabelFor(formType)} · ${submitterName}`,
      });
      setSubs((prev) => prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s)));
    }
    setActingId(null);
  };

  const tabLabel = { pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado' } as const;
  const tabFromLabel: Record<string, 'pending' | 'approved' | 'rejected'> = {
    Pendiente: 'pending', Aprobado: 'approved', Rechazado: 'rejected',
  };

  return (
    <div>
      <PageHeader
        title="Solicitudes de Formularios"
        subtitle="Revisa y responde los formularios enviados por los técnicos"
        breadcrumbs={['Inicio', 'Administrador', 'Solicitudes']}
      />
      <Card pad={false}>
        <div className="px-4 pt-3">
          <Tabs
            tabs={['Pendiente', 'Aprobado', 'Rechazado']}
            active={tabLabel[statusFilter]}
            onChange={(t: any) => setStatusFilter(tabFromLabel[t])}
          />
        </div>
        <div className="divide-y divide-ink-50 mt-2">
          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-ink-500">Cargando…</div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-ink-400">No hay solicitudes en este estado.</div>
          ) : filtered.map((s) => (
            <div key={s.id} className="px-5 py-4">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                <div>
                  <div className="text-sm font-semibold text-ink-900">{formLabelFor(s.form_type)}</div>
                  <div className="text-xs text-ink-500">por {s.submitterName} · {new Date(s.created_at).toLocaleDateString('es-PE')}</div>
                </div>
                <Badge className={s.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : s.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}>
                  {tabLabel[s.status as 'pending' | 'approved' | 'rejected']}
                </Badge>
              </div>
              {expandedId === s.id && (
                <div className="mt-3 pl-1">
                  <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                    {Object.entries(s.data ?? {}).map(([key, value]) => (
                      <div key={key}>
                        <div className="text-xs text-ink-400 uppercase tracking-wide">{key.replace(/_/g, ' ')}</div>
                        <div className="text-ink-800">{String(value) || '—'}</div>
                      </div>
                    ))}
                  </div>
                  {s.status === 'pending' && !readOnly && (
                    <div className="flex gap-2">
                      <button className="btn-primary" disabled={actingId === s.id} onClick={() => resolve(s.id, 'approved', s.submitterName, s.form_type)}>
                        {actingId === s.id ? 'Guardando…' : 'Aprobar'}
                      </button>
                      <button className="btn-secondary" disabled={actingId === s.id} onClick={() => resolve(s.id, 'rejected', s.submitterName, s.form_type)}>
                        Rechazar
                      </button>
                    </div>
                  )}
                  {s.status === 'pending' && readOnly && (
                    <p className="text-xs text-ink-400 italic">Pendiente de aprobación por Administración.</p>
                  )}
                  {s.status === 'pending' && readOnly && (
                    <p className="text-xs text-ink-400 italic">Pendiente de aprobación por Administración.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}


export const _cn = cn;
