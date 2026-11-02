import { useEffect, useRef, useState } from 'react';
import { FileText, Paperclip, Check, X, Download, RotateCcw, Save } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, Avatar, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';
import {
  formLabelEs, STATUS_META, FIELD_LABELS, FIELD_ORDER, INTERNAL_KEYS, displayFieldValue, openFormFile,
  type FormType, type StoredFile,
} from '@/lib/formsConfig';
import { SnapshotList, type AttachmentSnapshot } from '@/lib/workspaceSnapshot';
import { DEFAULT_MEDICAL_TEMPLATE, TEMPLATE_FIELDS, SAMPLE_VALUES, generateTemplatePdf, type PdfTemplate } from '@/lib/formPdf';

const WIDE_FIELDS = new Set(['details', 'notes', 'routes']);

type Filter = 'pending' | 'approved' | 'rejected' | 'all';

export function AdminFormsPage({ readOnly = false }: { readOnly?: boolean } = {}) {
  const { profile } = useAuth();
  const [view, setView] = useState<'requests' | 'templates'>('requests');
  const [filter, setFilter] = useState<Filter>('pending');
  const [subs, setSubs] = useState<any[]>([]);
  const [people, setPeople] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    // Drafts ("pendiente de firma") are not sent yet, so they are not shown here.
    const { data } = await supabase
      .from('form_submissions')
      .select('*')
      .neq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(200);
    const rows = data ?? [];
    const ids = Array.from(new Set(rows.map((r: any) => r.submitted_by).filter(Boolean)));
    let pm = new Map<string, any>();
    if (ids.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name, initials, avatar_color, role').in('id', ids);
      pm = new Map((profs ?? []).map((p: any) => [p.id, p]));
    }
    setPeople(pm);
    setSubs(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resolve = async (s: any, status: 'approved' | 'rejected') => {
    if (!profile) return;
    const { error } = await supabase.from('form_submissions').update({ status }).eq('id', s.id);
    if (error) { alert(`No se pudo guardar la respuesta: ${error.message}`); return; }
    setSubs((prev) => prev.map((x) => (x.id === s.id ? { ...x, status } : x)));

    const who = people.get(s.submitted_by)?.full_name ?? s.data?.requester?.name ?? 'trabajador';
    await logActivity({
      actorName: profile.full_name,
      action: status === 'approved' ? 'aprobó un formulario' : 'rechazó un formulario',
      target: 'form_submission' as any,
      detail: `${formLabelEs(s.form_type)} de ${who}`,
    });
    // Let the worker know the answer.
    await supabase.from('notifications').insert({
      user_id: s.submitted_by,
      type: 'form_resolved',
      title: `Tu formulario fue ${status === 'approved' ? 'aprobado' : 'rechazado'}`,
      body: formLabelEs(s.form_type),
      color: status === 'approved' ? 'bg-emerald-500' : 'bg-red-500',
      unread: true,
      actor_id: profile.id,
    });
  };

  const counts = {
    pending: subs.filter((s) => s.status === 'pending').length,
    approved: subs.filter((s) => s.status === 'approved').length,
    rejected: subs.filter((s) => s.status === 'rejected').length,
    all: subs.length,
  };
  const visible = filter === 'all' ? subs : subs.filter((s) => s.status === filter);

  const tabBtn = (active: boolean) =>
    cn('px-3 py-1.5 rounded-md text-xs font-semibold transition', active ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800');

  return (
    <div>
      <PageHeader
        title="Solicitudes de Formularios"
        subtitle="Revisa, aprueba o rechaza lo que envía el equipo"
        breadcrumbs={['Inicio', readOnly ? 'Coordinador' : 'Administrador', 'Solicitudes']}
      />

      {!readOnly && (
        <div className="flex items-center gap-1.5 bg-ink-50 rounded-lg p-1 w-fit mb-4">
          <button className={tabBtn(view === 'requests')} onClick={() => setView('requests')}>Solicitudes</button>
          <button className={tabBtn(view === 'templates')} onClick={() => setView('templates')}>Modelos de documento</button>
        </div>
      )}

      {view === 'templates' && !readOnly ? (
        <TemplatesEditor />
      ) : (
        <>
          <div className="flex items-center gap-1.5 bg-ink-50 rounded-lg p-1 w-fit mb-4 flex-wrap">
            <button className={tabBtn(filter === 'pending')} onClick={() => setFilter('pending')}>Enviadas ({counts.pending})</button>
            <button className={tabBtn(filter === 'approved')} onClick={() => setFilter('approved')}>Aprobadas ({counts.approved})</button>
            <button className={tabBtn(filter === 'rejected')} onClick={() => setFilter('rejected')}>Rechazadas ({counts.rejected})</button>
            <button className={tabBtn(filter === 'all')} onClick={() => setFilter('all')}>Todas ({counts.all})</button>
          </div>

          {loading ? (
            <Card><div className="p-8 text-center text-sm text-ink-500">Cargando…</div></Card>
          ) : visible.length === 0 ? (
            <Card><div className="p-8 text-center text-sm text-ink-400">No hay solicitudes en esta categoría.</div></Card>
          ) : (
            <div className="space-y-4">
              {visible.map((s) => {
                const submitter = people.get(s.submitted_by);
                const name = submitter?.full_name ?? s.data?.requester?.name ?? 'Usuario';
                const type = s.form_type as FormType;
                const meta = STATUS_META[s.status] ?? { label: s.status, className: 'bg-ink-100 text-ink-600' };
                const data = s.data ?? {};
                const keys: string[] = FIELD_ORDER[type] ?? Object.keys(data).filter((k) => !INTERNAL_KEYS.has(k));
                const receipt: StoredFile | null = data.receipt ?? null;
                const signed: StoredFile | null = data.signed_file ?? null;
                const attachments: AttachmentSnapshot[] = data.attachments ?? [];
                const hasExtras = !!receipt || !!signed || attachments.length > 0;

                return (
                  <Card key={s.id}>
                    <div className="flex items-start gap-3">
                      {submitter ? (
                        <Avatar initials={submitter.initials} color={submitter.avatar_color} size="sm" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-ink-200 flex items-center justify-center"><FileText size={14} className="text-ink-500" /></div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-ink-900">{formLabelEs(s.form_type)}</div>
                        <div className="text-xs text-ink-500">
                          {name} · enviado el {new Date(s.created_at).toLocaleString('es-PE')}
                        </div>
                      </div>
                      <Badge className={meta.className}>{meta.label}</Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-4 pt-4 border-t border-ink-100">
                      {keys.filter((k) => data[k] != null && String(data[k]).trim() !== '').map((k) => (
                        <div key={k} className={WIDE_FIELDS.has(k) ? 'sm:col-span-2' : undefined}>
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{FIELD_LABELS[k] ?? k}</div>
                          <div className="text-sm text-ink-800" style={{ whiteSpace: 'pre-wrap' }}>{displayFieldValue(k, data[k])}</div>
                        </div>
                      ))}
                    </div>

                    {hasExtras && !readOnly && (
                      <div className="mt-4 pt-4 border-t border-ink-100 space-y-3">
                        {(receipt || signed) && (
                          <div className="flex flex-wrap gap-2">
                            {receipt && (
                              <button className="btn-secondary h-8 text-xs" onClick={() => openFormFile(receipt)}>
                                <Paperclip size={13} /> Ver comprobante
                              </button>
                            )}
                            {signed && (
                              <button className="btn-secondary h-8 text-xs" onClick={() => openFormFile(signed)}>
                                <Paperclip size={13} /> Ver documento firmado
                              </button>
                            )}
                          </div>
                        )}
                        {attachments.length > 0 && (
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400 mb-1.5">Documentos adjuntos (copia del envío)</div>
                            <SnapshotList items={attachments} />
                          </div>
                        )}
                      </div>
                    )}
                    {hasExtras && readOnly && (
                      <p className="mt-4 pt-3 border-t border-ink-100 text-xs text-ink-400 italic">Los archivos y documentos adjuntos solo los ve Administración.</p>
                    )}

                    {s.status === 'pending' && !readOnly && (
                      <div className="flex gap-2 mt-4 pt-4 border-t border-ink-100">
                        <button className="btn-primary h-9 text-sm" onClick={() => resolve(s, 'approved')}><Check size={15} /> Aprobar</button>
                        <button className="h-9 px-4 rounded-lg text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 flex items-center gap-1.5" onClick={() => resolve(s, 'rejected')}>
                          <X size={15} /> Rechazar
                        </button>
                      </div>
                    )}
                    {s.status === 'pending' && readOnly && (
                      <p className="text-xs text-ink-400 italic mt-4">Pendiente de aprobación por Administración.</p>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor of the PDF model used by the medical-leave form
// ---------------------------------------------------------------------------
function TemplatesEditor() {
  const { profile } = useAuth();
  const [tpl, setTpl] = useState<PdfTemplate>(DEFAULT_MEDICAL_TEMPLATE);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('form_templates').select('*').eq('form_type', 'medical_leave').maybeSingle();
      if (data) {
        setTpl({
          company_name: data.company_name ?? '',
          title: data.title ?? '',
          body: data.body ?? '',
          footer: data.footer ?? '',
          signature_label: data.signature_label || 'Firma del trabajador',
        });
        setUpdatedAt(data.updated_at ?? null);
      }
      setLoading(false);
    })();
  }, []);

  const change = (patch: Partial<PdfTemplate>) => { setTpl((t) => ({ ...t, ...patch })); setMsg(null); };

  const insertField = (key: string) => {
    const el = bodyRef.current;
    const token = `{{${key}}}`;
    if (!el) { change({ body: tpl.body + token }); return; }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    change({ body: el.value.slice(0, start) + token + el.value.slice(end) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const preview = () => {
    generateTemplatePdf(tpl, { ...SAMPLE_VALUES, fecha_emision: new Date().toLocaleDateString('es-PE') }, 'Vista-previa-descanso-medico.pdf');
  };

  const restoreDefault = () => {
    if (!confirm('Se cargará el modelo original en el editor. No se guarda hasta que pulses «Guardar modelo». ¿Continuar?')) return;
    setTpl(DEFAULT_MEDICAL_TEMPLATE);
    setMsg({ ok: true, text: 'Modelo original cargado. Pulsa «Guardar modelo» para aplicarlo.' });
  };

  const save = async () => {
    if (!profile) return;
    if (!tpl.title.trim() || !tpl.body.trim()) { setMsg({ ok: false, text: 'El título y el cuerpo del documento no pueden estar vacíos.' }); return; }
    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('form_templates')
      .upsert({ form_type: 'medical_leave', ...tpl, updated_by: profile.id, updated_at: now }, { onConflict: 'form_type' });
    setSaving(false);
    if (error) { setMsg({ ok: false, text: `No se pudo guardar: ${error.message}` }); return; }
    setUpdatedAt(now);
    setMsg({ ok: true, text: 'Modelo guardado. Los PDF que se generen desde ahora usarán este texto.' });
    await logActivity({ actorName: profile.full_name, action: 'actualizó un modelo de documento', target: 'form_template', detail: 'Descanso médico' });
  };

  if (loading) return <Card><div className="p-8 text-center text-sm text-ink-500">Cargando…</div></Card>;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h3 className="text-base font-bold text-ink-900">Descanso médico — modelo del PDF</h3>
          <p className="text-xs text-ink-500 mt-0.5">
            Es el documento que el trabajador descarga, firma y vuelve a subir. Escribe el texto como quieras y usa los campos automáticos para insertar sus datos.
          </p>
          {updatedAt && <p className="text-[11px] text-ink-400 mt-1">Última modificación: {new Date(updatedAt).toLocaleString('es-PE')}</p>}
        </div>
      </div>

      {msg && (
        <div className={cn('mb-4 rounded-lg border px-3.5 py-2.5 text-sm', msg.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700')}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Nombre de la empresa (encabezado)</label>
          <input className="input" value={tpl.company_name} onChange={(e) => change({ company_name: e.target.value })} />
        </div>
        <div>
          <label className="label">Título del documento</label>
          <input className="input" value={tpl.title} onChange={(e) => change({ title: e.target.value })} />
        </div>

        <div className="sm:col-span-2">
          <label className="label">Cuerpo del documento</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {TEMPLATE_FIELDS.map((f) => (
              <button
                key={f.key}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertField(f.key)}
                className="px-2 py-1 rounded-md text-[11px] font-medium bg-primary-50 text-primary-700 hover:bg-primary-100"
                title={`Inserta {{${f.key}}}`}
              >
                + {f.label}
              </button>
            ))}
          </div>
          <textarea
            ref={bodyRef}
            className="input font-mono text-[13px]"
            rows={12}
            value={tpl.body}
            onChange={(e) => change({ body: e.target.value })}
          />
          <p className="text-[11px] text-ink-400 mt-1">
            Los campos se ven así: <code>{'{{nombre}}'}</code>. Al generar el PDF se reemplazan por los datos reales del trabajador.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className="label">Pie legal</label>
          <textarea className="input" rows={3} value={tpl.footer} onChange={(e) => change({ footer: e.target.value })} />
        </div>
        <div>
          <label className="label">Texto bajo la línea de firma</label>
          <input className="input" value={tpl.signature_label} onChange={(e) => change({ signature_label: e.target.value })} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-5">
        <button className="btn-primary" onClick={save} disabled={saving}><Save size={15} /> {saving ? 'Guardando…' : 'Guardar modelo'}</button>
        <button className="btn-secondary" onClick={preview}><Download size={15} /> Vista previa (PDF de ejemplo)</button>
        <button className="btn-secondary" onClick={restoreDefault}><RotateCcw size={15} /> Restaurar modelo original</button>
      </div>
      <p className="text-[11px] text-ink-400 mt-3">
        Los cambios solo afectan a los PDF que se generen de ahora en adelante; los documentos ya firmados no se modifican.
      </p>
    </Card>
  );
}
