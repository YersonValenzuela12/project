import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Car, HeartPulse, MessageSquareWarning, Receipt, FileText, Download, Upload, Paperclip, X, CheckCircle2,
  ChevronRight, Table as TableIcon, Plus,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, SectionHeader, Badge, Modal } from '@/components/ui';
import { forms } from '@/data/mockData';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';
import {
  FORM_TYPE_BY_NAME, FORM_TEXT_ES, formLabelEs, STATUS_META, FIELD_LABELS, FIELD_ORDER, REQUIRED_FIELDS,
  PDF_FIELD_KEYS, LEAVE_TYPES, CATEGORY_LABELS, normalizeProjectCode, isValidProjectCode, isAllowedFile,
  MAX_FILE_BYTES, uploadFormFile, removeFormFile, openFormFile,
  type FormType, type StoredFile,
} from '@/lib/formsConfig';
import { takeSnapshot, SnapshotList, MAX_ATTACHMENTS, type AttachmentSnapshot } from '@/lib/workspaceSnapshot';
import { loadTemplate, buildMedicalLeaveValues, generateTemplatePdf, pdfFileName } from '@/lib/formPdf';

const ICONS: Record<string, typeof Car> = { Car, HeartPulse, MessageSquareWarning, Receipt };
const ROLE_LABEL: Record<string, string> = { technician: 'Técnico', supervisor: 'Supervisor', coordinador: 'Coordinador', admin: 'Administrador' };

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export function FormsPage() {
  const { profile } = useAuth();
  const [subs, setSubs] = useState<any[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [modal, setModal] = useState<{ type: FormType; submission: any | null } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const fetchSubs = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('form_submissions')
      .select('*')
      .eq('submitted_by', profile.id)
      .order('created_at', { ascending: false })
      .limit(30);
    setSubs(data ?? []);
    setLoadingSubs(false);
  };

  useEffect(() => { fetchSubs(); }, [profile?.id]);

  if (!profile) return null;

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-[80] bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in max-w-sm">
          <CheckCircle2 size={16} className="shrink-0" /> {toast}
        </div>
      )}

      <PageHeader
        title="Formularios"
        subtitle="Envía y revisa tus formularios de campo y de personal"
        breadcrumbs={['Inicio', ROLE_LABEL[profile.role] ?? 'Técnico', 'Formularios']}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {forms.map((f: any) => {
          const type = FORM_TYPE_BY_NAME[f.name];
          if (!type) return null;
          const Icon = ICONS[f.icon] ?? FileText;
          const text = FORM_TEXT_ES[type];
          return (
            <button
              key={f.id}
              type="button"
              className="block w-full h-full text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              onClick={() => setModal({ type, submission: null })}
            >
              <Card className="h-full hover:shadow-card-md transition cursor-pointer">
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center"><Icon size={18} /></div>
                <Badge className="bg-emerald-50 text-emerald-700">Disponible</Badge>
              </div>
              <div className="mt-3 font-semibold text-ink-900">{text.name}</div>
              <div className="text-sm text-ink-500">{text.desc}</div>
              <div className="mt-3 text-sm font-medium text-primary-600 flex items-center gap-1">Iniciar formulario <ChevronRight size={14} /></div>
              </Card>
            </button>
          );
        })}
      </div>

      <Card pad={false} className="overflow-hidden mt-6">
        <div className="p-5 pb-3">
          <SectionHeader title="Envíos recientes" subtitle="Toca uno para verlo o seguir editándolo mientras Administración no responda" />
        </div>
        {loadingSubs ? (
          <div className="px-5 pb-6 text-sm text-ink-500">Cargando…</div>
        ) : subs.length === 0 ? (
          <div className="px-5 pb-6 text-sm text-ink-400">Aún no has enviado ningún formulario.</div>
        ) : (
          <div className="divide-y divide-ink-50">
            {subs.map((s) => {
              const known = s.form_type in FORM_TEXT_ES;
              const meta = STATUS_META[s.status] ?? { label: s.status, className: 'bg-ink-100 text-ink-600' };
              return (
                <button
                  key={s.id}
                  disabled={!known}
                  onClick={() => setModal({ type: s.form_type as FormType, submission: s })}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-ink-50/50 text-left disabled:cursor-default"
                >
                  <div className="h-9 w-9 rounded-lg bg-ink-100 text-ink-500 flex items-center justify-center shrink-0"><FileText size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink-900">{formLabelEs(s.form_type)}</div>
                    <div className="text-xs text-ink-500">Enviado el {new Date(s.created_at).toLocaleDateString('es-PE')}</div>
                  </div>
                  <Badge className={meta.className}>{meta.label}</Badge>
                  {known && <ChevronRight size={15} className="text-ink-300 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {modal && (
        <FormModal
          type={modal.type}
          submission={modal.submission}
          onClose={() => setModal(null)}
          onSaved={fetchSubs}
          notify={notify}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------
function Field({ label, required, hint, className, children }: { label: string; required?: boolean; hint?: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label className="label">{label}{required ? ' *' : ''}</label>
      {children}
      {hint && <p className="text-[11px] text-ink-400 mt-1">{hint}</p>}
    </div>
  );
}

function FilePick({
  stored, pending, disabled, onPick, onRemovePending, onRemoveStored,
}: {
  stored: StoredFile | null;
  pending: File | null;
  disabled?: boolean;
  onPick: (f: File) => void;
  onRemovePending: () => void;
  onRemoveStored?: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);

  const handle = (f: File | null) => {
    if (!f) return;
    if (!isAllowedFile(f)) { setErr('Solo se aceptan archivos PDF o imágenes.'); return; }
    if (f.size > MAX_FILE_BYTES) { setErr('El archivo supera los 20 MB.'); return; }
    setErr(null);
    onPick(f);
  };

  const row = (name: string, actions: ReactNode) => (
    <div className="flex items-center gap-2 border border-ink-200 rounded-lg px-3 py-2 mb-2 bg-white">
      <Paperclip size={14} className="text-ink-400 shrink-0" />
      <span className="text-sm text-ink-800 truncate flex-1">{name}</span>
      {actions}
    </div>
  );

  return (
    <div>
      <input
        ref={ref}
        type="file"
        accept="application/pdf,image/*"
        hidden
        onChange={(e) => { handle(e.target.files?.[0] ?? null); e.target.value = ''; }}
      />
      {stored && !pending && row(stored.name, (
        <>
          <button type="button" className="text-xs text-primary-600 hover:underline" onClick={() => openFormFile(stored)}>Ver</button>
          {!disabled && onRemoveStored && <button type="button" className="text-xs text-red-600 hover:underline" onClick={onRemoveStored}>Quitar</button>}
        </>
      ))}
      {pending && row(`${pending.name} (se subirá al guardar)`, (
        <button type="button" className="text-ink-400 hover:text-red-600" onClick={onRemovePending}><X size={14} /></button>
      ))}
      {!disabled && (
        <button type="button" className="btn-secondary h-9 text-xs" onClick={() => ref.current?.click()}>
          <Upload size={14} /> {stored || pending ? 'Reemplazar archivo' : 'Elegir archivo (PDF o imagen)'}
        </button>
      )}
      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
    </div>
  );
}

// Lets the worker attach notes/tables from their Workspace (own or shared with them). A frozen copy is stored.
function AttachmentPicker({ value, onChange, disabled }: { value: AttachmentSnapshot[]; onChange: (v: AttachmentSnapshot[]) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<any[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const openPanel = async () => {
    setOpen(true);
    setErr(null);
    if (docs) return;
    const { data, error } = await supabase.from('shared_documents').select('id, title, type, status, updated_at').order('updated_at', { ascending: false });
    if (error) { setErr('No se pudo cargar tu Espacio de Trabajo.'); setDocs([]); return; }
    setDocs((data ?? []).filter((d: any) => (d.status ?? 'active') !== 'archived'));
  };

  const attached = new Set(value.map((v) => v.id));
  const available = (docs ?? []).filter((d) => !attached.has(d.id));

  const toggle = (id: string) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const addPicked = async () => {
    if (picked.size === 0) return;
    if (value.length + picked.size > MAX_ATTACHMENTS) { setErr(`Puedes adjuntar como máximo ${MAX_ATTACHMENTS} documentos.`); return; }
    setAdding(true);
    setErr(null);
    try {
      const snaps: AttachmentSnapshot[] = [];
      for (const d of available.filter((x) => picked.has(x.id))) snaps.push(await takeSnapshot(d.id, d.title, d.type));
      onChange([...value, ...snaps]);
      setPicked(new Set());
      setOpen(false);
    } catch {
      setErr('No se pudo copiar uno de los documentos. Inténtalo de nuevo.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div>
      <SnapshotList items={value} onRemove={disabled ? undefined : (id) => onChange(value.filter((v) => v.id !== id))} />

      {!disabled && !open && (
        <button type="button" className="btn-secondary h-9 text-xs mt-2" onClick={openPanel} disabled={value.length >= MAX_ATTACHMENTS}>
          <Plus size={14} /> Adjuntar bloc o tabla del Espacio de Trabajo
        </button>
      )}

      {!disabled && open && (
        <div className="border border-ink-200 rounded-lg mt-2 bg-ink-50/50">
          <div className="px-3 py-2 text-xs text-ink-500 border-b border-ink-100">
            Se adjunta una <b>copia de hoy</b>: si luego editas el documento, la copia enviada no cambia.
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-ink-100">
            {docs === null ? (
              <div className="p-3 text-xs text-ink-500">Cargando…</div>
            ) : available.length === 0 ? (
              <div className="p-3 text-xs text-ink-400">No tienes más blocs o tablas disponibles para adjuntar.</div>
            ) : (
              available.map((d) => (
                <label key={d.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-white">
                  <input type="checkbox" checked={picked.has(d.id)} onChange={() => toggle(d.id)} />
                  <div className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${d.type === 'note' ? 'bg-amber-50 text-amber-600' : 'bg-primary-50 text-primary-600'}`}>
                    {d.type === 'note' ? <FileText size={13} /> : <TableIcon size={13} />}
                  </div>
                  <span className="text-sm text-ink-800 truncate flex-1">{d.title}</span>
                  <span className="text-[11px] text-ink-400">{d.type === 'note' ? 'Bloc' : 'Tabla'}</span>
                </label>
              ))
            )}
          </div>
          <div className="flex gap-2 p-2 border-t border-ink-100">
            <button type="button" className="btn-secondary h-8 text-xs flex-1" onClick={() => { setOpen(false); setPicked(new Set()); }}>Cancelar</button>
            <button type="button" className="btn-primary h-8 text-xs flex-1" onClick={addPicked} disabled={adding || picked.size === 0}>
              {adding ? 'Copiando…' : `Adjuntar${picked.size ? ` (${picked.size})` : ''}`}
            </button>
          </div>
        </div>
      )}
      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The form itself (new submission, or an existing one that can still be edited)
// ---------------------------------------------------------------------------
function FormModal({
  type, submission, onClose, onSaved, notify,
}: {
  type: FormType;
  submission: any | null;
  onClose: () => void;
  onSaved: () => void;
  notify: (msg: string) => void;
}) {
  const { profile } = useAuth();
  const submissionId = useRef<string>(submission?.id ?? crypto.randomUUID()).current; // folder + reference code
  const dbIdRef = useRef<string>(submission?.id ?? submissionId); // the id the database actually uses
  const initial = submission?.data ?? {};

  const [fields, setFields] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    FIELD_ORDER[type].forEach((k) => { if (initial[k] != null) out[k] = String(initial[k]); });
    return out;
  });
  const [status, setStatus] = useState<string | null>(submission?.status ?? null);
  const [exists, setExists] = useState(!!submission);
  const [receipt, setReceipt] = useState<StoredFile | null>(initial.receipt ?? null);
  const [newReceipt, setNewReceipt] = useState<File | null>(null);
  const [signed, setSigned] = useState<StoredFile | null>(initial.signed_file ?? null);
  const [newSigned, setNewSigned] = useState<File | null>(null);
  const [removedPaths, setRemovedPaths] = useState<string[]>([]);
  const [pdfHash, setPdfHash] = useState<string | null>(initial.pdf_fields_hash ?? null);
  const [pdfAt, setPdfAt] = useState<string | null>(initial.pdf_generated_at ?? null);
  const [attachments, setAttachments] = useState<AttachmentSnapshot[]>(initial.attachments ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  // The form is long and the buttons are at the bottom: bring any message into view so it is never missed.
  useEffect(() => {
    if (error || info) messageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [error, info]);

  const isMedical = type === 'medical_leave';
  const hasAttachments = type === 'complaint' || type === 'expense_claim';
  const readOnly = status === 'approved' || status === 'rejected';
  const label = formLabelEs(type);
  const hash = JSON.stringify(PDF_FIELD_KEYS.map((k) => (fields[k] ?? '').trim()));
  const pdfFresh = !!pdfHash && pdfHash === hash;

  const requester = {
    name: profile?.full_name ?? '',
    email: profile?.email ?? '',
    title: profile?.title ?? '',
    region: profile?.region ?? '',
    phone: profile?.phone ?? '',
  };

  const set = (key: string, value: string) => {
    setFields((f) => ({ ...f, [key]: value }));
    setError(null);
  };
  const val = (key: string) => fields[key] ?? '';

  const validate = (): string | null => {
    for (const k of REQUIRED_FIELDS[type]) {
      if (!val(k).trim()) return `Completa el campo «${FIELD_LABELS[k]}».`;
    }
    if (type === 'mobility') {
      if (!isValidProjectCode(val('project_code'))) return 'El código de proyecto debe tener entre 4 y 8 letras o números.';
      if (val('reimbursement_amount') && !(Number(val('reimbursement_amount')) >= 0)) return 'El monto a reembolsar no es válido.';
    }
    if (type === 'expense_claim' && !(Number(val('amount')) > 0)) return 'El costo debe ser un número mayor a 0.';
    if (isMedical) {
      if (!(Number(val('days')) >= 1)) return 'Los días de recuperación deben ser 1 o más.';
      if (val('to_date') < val('from_date')) return 'La fecha de salida no puede ser anterior a la de inicio.';
    }
    return null;
  };

  // Saves the submission (creating it the first time) with the given status.
  const persist = async (
    targetStatus: 'draft' | 'pending',
    overrides: { pdfHash?: string | null; pdfAt?: string | null; clearSigned?: boolean } = {},
  ): Promise<boolean> => {
    if (!profile) return false;
    setSaving(true);
    setError(null);
    try {
      let receiptFile = receipt;
      if (newReceipt) receiptFile = await uploadFormFile(profile.id, submissionId, 'receipt', newReceipt);

      let signedFile = overrides.clearSigned ? null : signed;
      if (!overrides.clearSigned && newSigned) signedFile = await uploadFormFile(profile.id, submissionId, 'signed', newSigned);

      const finalHash = overrides.pdfHash !== undefined ? overrides.pdfHash : pdfHash;
      const finalAt = overrides.pdfAt !== undefined ? overrides.pdfAt : pdfAt;

      const data: Record<string, any> = { ...fields, requester };
      if (type === 'mobility') data.receipt = receiptFile ?? null;
      if (isMedical) {
        data.signed_file = signedFile ?? null;
        data.pdf_fields_hash = finalHash ?? null;
        data.pdf_generated_at = finalAt ?? null;
      }
      if (hasAttachments) data.attachments = attachments;

      if (exists) {
        const { data: updated, error: upErr } = await supabase
          .from('form_submissions')
          .update({ data, status: targetStatus })
          .eq('id', dbIdRef.current)
          .select('id');
        if (upErr) throw upErr;
        // An update that matches no rows means the database refused it (e.g. it was already answered).
        if (!updated || updated.length === 0) throw new Error('esta solicitud ya no se puede editar (puede que Administración ya la haya respondido).');
      } else {
        const row = { form_type: type, submitted_by: profile.id, data, status: targetStatus };
        const ins = await supabase.from('form_submissions').insert({ id: submissionId, ...row });
        if (ins.error && (ins.error.code === '22P02' || /invalid input syntax/i.test(ins.error.message))) {
          // This table does not use uuid ids: let the database choose it.
          const retry = await supabase.from('form_submissions').insert(row).select('id').single();
          if (retry.error) throw retry.error;
          dbIdRef.current = retry.data.id;
        } else if (ins.error) {
          throw ins.error;
        }
      }

      // Clean up files that were replaced or removed (best effort).
      if (receipt && newReceipt) removeFormFile(receipt.path);
      if (signed && (newSigned || overrides.clearSigned)) removeFormFile(signed.path);
      removedPaths.forEach(removeFormFile);

      setRemovedPaths([]);
      setReceipt(receiptFile);
      setNewReceipt(null);
      setSigned(signedFile);
      setNewSigned(null);
      setPdfHash(finalHash ?? null);
      setPdfAt(finalAt ?? null);
      setStatus(targetStatus);
      setExists(true);
      return true;
    } catch (e: any) {
      console.error('Error al guardar el formulario:', e);
      setError(e?.message ? `No se pudo guardar: ${e.message}` : 'No se pudo guardar. Inténtalo nuevamente.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Log + notify the administrators that something was sent or updated.
  const afterSend = async (updated: boolean) => {
    if (!profile) return;
    try {
    await logActivity({
      actorName: profile.full_name,
      action: updated ? 'actualizó un formulario' : 'envió un formulario',
      target: 'form_submission',
      detail: label,
    });
    const { data: adminIds, error: rpcErr } = await supabase.rpc('get_admin_ids');
    if (rpcErr) { console.error('No se pudo obtener a los administradores:', rpcErr); return; }
    if (adminIds && adminIds.length > 0) {
      await supabase.from('notifications').insert(
        adminIds.map((id: string) => ({
          user_id: id,
          type: 'form_submitted',
          title: `${label} ${updated ? 'actualizado' : 'enviado'}`,
          body: `por ${profile.full_name}`,
          color: 'bg-violet-500',
          unread: true,
          actor_id: profile.id,
        })),
      );
    }
    } catch (e) {
      console.error('El formulario se guardó, pero no se pudo avisar a los administradores:', e);
    }
  };

  // ---- simple forms: mobility, complaint, expense ----
  const submitSimple = async () => {
    const v = validate();
    if (v) { setError(v); return; }
    const wasExisting = exists;
    const ok = await persist('pending');
    if (!ok) return;
    await afterSend(wasExisting);
    notify(wasExisting ? 'Cambios guardados.' : 'Formulario enviado.');
    onSaved();
    onClose();
  };

  // ---- medical leave: generate the PDF, sign it, upload it, send ----
  const generatePdf = async () => {
    setInfo(null);
    const v = validate();
    if (v) { setError(v); return; }

    const newCycle = !(exists && pdfFresh); // first time, or the data changed since the last PDF
    if (newCycle && exists && status === 'pending' && signed) {
      const go = confirm('Al cambiar los datos, el documento firmado ya no corresponde. La solicitud volverá a «Pendiente de firma» y tendrás que firmar el PDF nuevo. ¿Continuar?');
      if (!go) return;
    }

    try {
      const template = await loadTemplate('medical_leave');
      const values = buildMedicalLeaveValues(requester, fields, submissionId);
      generateTemplatePdf(template, values, pdfFileName(requester.name));
    } catch (e: any) {
      console.error('Error al generar el PDF:', e);
      setError(`No se pudo generar el PDF: ${e?.message ?? 'error desconocido'}`);
      return;
    }

    if (!newCycle) { setInfo('PDF descargado de nuevo.'); return; }

    const ok = await persist('draft', { pdfHash: hash, pdfAt: new Date().toISOString(), clearSigned: true });
    if (ok) {
      setInfo('PDF descargado. Tu solicitud quedó como «Pendiente de firma»: ya puedes cerrar esta ventana. Ábrela otra vez desde «Envíos recientes» cuando tengas el documento firmado.');
      onSaved();
    }
  };

  const sendSigned = async () => {
    const v = validate();
    if (v) { setError(v); return; }
    if (!pdfFresh) { setError('Los datos cambiaron después de generar el PDF. Genera el PDF de nuevo y fírmalo.'); return; }
    if (!signed && !newSigned) { setError('Sube primero el documento firmado.'); return; }
    const wasSent = status === 'pending';
    const ok = await persist('pending');
    if (!ok) return;
    await afterSend(wasSent);
    notify(wasSent ? 'Documento firmado actualizado.' : 'Solicitud enviada.');
    onSaved();
    onClose();
  };

  // ---------------------------------------------------------------------------
  const banner =
    status === 'draft' ? { cls: 'bg-amber-50 border-amber-200 text-amber-800', text: 'Pendiente de firma: sube el documento firmado y envía la solicitud. Puedes cerrar y volver cuando quieras.' }
    : status === 'pending' ? { cls: 'bg-primary-50 border-primary-100 text-primary-800', text: 'Enviado. Puedes editarlo hasta que Administración lo apruebe o rechace.' }
    : status === 'approved' ? { cls: 'bg-emerald-50 border-emerald-200 text-emerald-800', text: 'Aprobado por Administración. Ya no se puede editar.' }
    : status === 'rejected' ? { cls: 'bg-red-50 border-red-200 text-red-800', text: 'Rechazado por Administración. Ya no se puede editar.' }
    : null;

  const closeBtn = (
    <button className="btn-secondary" onClick={onClose} disabled={saving}>{exists || readOnly ? 'Cerrar' : 'Cancelar'}</button>
  );

  let footer: ReactNode;
  if (readOnly) {
    footer = closeBtn;
  } else if (isMedical) {
    if (!exists) {
      footer = (<>{closeBtn}<button className="btn-primary" onClick={generatePdf} disabled={saving}><Download size={15} /> {saving ? 'Generando…' : 'Generar PDF y guardar'}</button></>);
    } else if (status === 'draft') {
      footer = (
        <>
          {closeBtn}
          {!pdfFresh && <button className="btn-secondary" onClick={generatePdf} disabled={saving}><Download size={15} /> Generar PDF nuevamente</button>}
          <button className="btn-primary" onClick={sendSigned} disabled={saving || !pdfFresh || !(signed || newSigned)}>{saving ? 'Enviando…' : 'Enviar solicitud'}</button>
        </>
      );
    } else {
      footer = (
        <>
          {closeBtn}
          {!pdfFresh
            ? <button className="btn-secondary" onClick={generatePdf} disabled={saving}><Download size={15} /> Generar PDF nuevamente</button>
            : newSigned ? <button className="btn-primary" onClick={sendSigned} disabled={saving}>{saving ? 'Guardando…' : 'Guardar documento firmado'}</button> : null}
        </>
      );
    }
  } else {
    footer = (<>{closeBtn}<button className="btn-primary" onClick={submitSimple} disabled={saving}>{saving ? 'Enviando…' : exists ? 'Guardar cambios' : 'Enviar'}</button></>);
  }

  const dis = readOnly;

  return (
    <Modal open onClose={onClose} title={label} size="lg" footer={footer}>
      <div ref={messageRef}>
        {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3.5 py-3 text-sm text-red-700">{error}</div>}
        {info && <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-3.5 py-3 text-sm text-emerald-800">{info}</div>}
      </div>

      <div className="mb-4 rounded-lg bg-primary-50/60 border border-primary-100 px-3.5 py-3 text-sm text-primary-900">
        <b>{label}</b> — los campos marcados con * son obligatorios.
      </div>
      {banner && <div className={`mb-4 rounded-lg border px-3.5 py-3 text-sm ${banner.cls}`}>{banner.text}</div>}

      <div className="mb-4 rounded-lg bg-ink-50 border border-ink-200 px-3.5 py-3 text-xs text-ink-600">
        <div className="font-semibold text-ink-800 mb-1.5">Datos del solicitante</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
          <span>Nombre: <b className="text-ink-800">{requester.name || '—'}</b></span>
          <span>Cargo: <b className="text-ink-800">{requester.title || '—'}</b></span>
          <span>Distrito: <b className="text-ink-800">{requester.region || '—'}</b></span>
          <span>Teléfono: <b className="text-ink-800">{requester.phone || '—'}</b></span>
          <span className="sm:col-span-2">Correo: <b className="text-ink-800">{requester.email || '—'}</b></span>
        </div>
        <div className="mt-1.5 text-[11px] text-ink-400">Estos datos salen de tu perfil. Si hay algo mal, corrígelo en «Mi Perfil».</div>
      </div>

      {type === 'mobility' && (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tipo de movilidad" required>
            <input className="input" value={val('vehicle')} onChange={(e) => set('vehicle', e.target.value)} placeholder="uber, propio, colectivo" disabled={dis} />
          </Field>
          <Field label="Tiempo" required>
            <input className="input" value={val('period')} onChange={(e) => set('period', e.target.value)} placeholder="2 hr" disabled={dis} />
          </Field>
          <Field label="Inicio" required>
            <input className="input" value={val('start_mileage')} onChange={(e) => set('start_mileage', e.target.value)} placeholder="San Isidro" disabled={dis} />
          </Field>
          <Field label="Llegada" required>
            <input className="input" value={val('end_mileage')} onChange={(e) => set('end_mileage', e.target.value)} placeholder="Surco" disabled={dis} />
          </Field>
          <Field label="Tipo de viaje" className="col-span-2">
            <textarea className="input" rows={3} value={val('routes')} onChange={(e) => set('routes', e.target.value)} placeholder="Detalla si se llevó herramientas…" disabled={dis} />
          </Field>
          <Field label="Código de proyecto" required hint="4 a 8 letras o números">
            <input
              className="input font-mono uppercase"
              value={val('project_code')}
              onChange={(e) => set('project_code', normalizeProjectCode(e.target.value))}
              placeholder="AB1234"
              maxLength={8}
              disabled={dis}
            />
          </Field>
          <Field label="Monto a reembolsar (S/.)" hint="Opcional">
            <input className="input" type="number" min="0" step="0.01" value={val('reimbursement_amount')} onChange={(e) => set('reimbursement_amount', e.target.value)} placeholder="0.00" disabled={dis} />
          </Field>
          <Field label="Comprobante (opcional)" className="col-span-2" hint="PDF o imagen, hasta 20 MB">
            <FilePick
              stored={receipt}
              pending={newReceipt}
              disabled={dis}
              onPick={setNewReceipt}
              onRemovePending={() => setNewReceipt(null)}
              onRemoveStored={() => {
                if (receipt) setRemovedPaths((p) => [...p, receipt.path]);
                setReceipt(null);
              }}
            />
          </Field>
        </div>
      )}

      {isMedical && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo de baja" required>
              <select className="input" value={val('leave_type')} onChange={(e) => set('leave_type', e.target.value)} disabled={dis}>
                <option value="">Tipo de baja</option>
                {val('leave_type') && !LEAVE_TYPES.includes(val('leave_type')) && <option value={val('leave_type')}>{val('leave_type')}</option>}
                {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Días de recuperación" required>
              <input className="input" type="number" min="1" value={val('days')} onChange={(e) => set('days', e.target.value)} placeholder="3" disabled={dis} />
            </Field>
            <Field label="Inicio" required>
              <input className="input" type="date" value={val('from_date')} onChange={(e) => set('from_date', e.target.value)} disabled={dis} />
            </Field>
            <Field label="Salida" required>
              <input className="input" type="date" value={val('to_date')} onChange={(e) => set('to_date', e.target.value)} disabled={dis} />
            </Field>
            <Field label="Razón / notas" className="col-span-2">
              <textarea className="input" rows={3} value={val('notes')} onChange={(e) => set('notes', e.target.value)} placeholder="Breve descripción…" disabled={dis} />
            </Field>
          </div>

          <div className="mt-5 border border-ink-200 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-ink-900 mb-1 flex items-center gap-2"><FileText size={15} /> Documento para firmar</h4>
            {!pdfAt ? (
              <p className="text-xs text-ink-500">
                Completa los datos y genera el PDF. Descárgalo, fírmalo y vuelve a abrir esta solicitud para subirlo firmado.
                Mientras tanto quedará como «Pendiente de firma».
              </p>
            ) : (
              <>
                <p className="text-xs text-ink-500">
                  PDF generado el {new Date(pdfAt).toLocaleString('es-PE')}.{' '}
                  {!pdfFresh && !readOnly && <b className="text-amber-700">Cambiaste datos después de generarlo: genera el PDF de nuevo y fírmalo otra vez.</b>}
                </p>
                {!readOnly && pdfFresh && (
                  <button type="button" className="btn-secondary h-8 text-xs mt-2" onClick={generatePdf} disabled={saving}>
                    <Download size={13} /> Descargar el PDF otra vez
                  </button>
                )}
                <div className="mt-3">
                  <label className="label">Documento firmado (PDF o imagen)</label>
                  <FilePick
                    stored={signed}
                    pending={newSigned}
                    disabled={readOnly || !pdfFresh}
                    onPick={setNewSigned}
                    onRemovePending={() => setNewSigned(null)}
                  />
                  {!pdfFresh && !readOnly && <p className="text-[11px] text-ink-400 mt-1">Podrás subir el documento firmado cuando generes el PDF con los datos actuales.</p>}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {type === 'complaint' && (
        <div className="grid grid-cols-1 gap-4">
          <Field label="Tema" required>
            <input className="input" value={val('subject')} onChange={(e) => set('subject', e.target.value)} placeholder="Asunto breve" disabled={dis} />
          </Field>
          <Field label="Fecha" required>
            <input className="input" type="date" value={val('date')} onChange={(e) => set('date', e.target.value)} disabled={dis} />
          </Field>
          <Field label="Detalles" required>
            <textarea className="input" rows={5} value={val('details')} onChange={(e) => set('details', e.target.value)} placeholder="Detalles de la queja…" disabled={dis} />
          </Field>
          <Field label="Documentos adjuntos (opcional)" hint="Blocs o tablas de tu Espacio de Trabajo, tuyos o compartidos contigo">
            <AttachmentPicker value={attachments} onChange={setAttachments} disabled={dis} />
          </Field>
        </div>
      )}

      {type === 'expense_claim' && (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tema" required className="col-span-2">
            <input className="input" value={val('subject')} onChange={(e) => set('subject', e.target.value)} placeholder="Asunto breve" disabled={dis} />
          </Field>
          <Field label="Fecha" required className="col-span-2">
            <input className="input" type="date" value={val('date')} onChange={(e) => set('date', e.target.value)} disabled={dis} />
          </Field>
          <Field label="Detalles" required className="col-span-2">
            <textarea className="input" rows={4} value={val('details')} onChange={(e) => set('details', e.target.value)} placeholder="Detalle del gasto…" disabled={dis} />
          </Field>
          <Field label="Costo (S/.)" required>
            <input className="input" type="number" min="0" step="0.01" value={val('amount')} onChange={(e) => set('amount', e.target.value)} placeholder="0.00" disabled={dis} />
          </Field>
          <Field label="Categoría" required>
            <select className="input" value={val('category')} onChange={(e) => set('category', e.target.value)} disabled={dis}>
              <option value="">Elige una categoría</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Documentos adjuntos (opcional)" className="col-span-2" hint="Blocs o tablas de tu Espacio de Trabajo, tuyos o compartidos contigo">
            <AttachmentPicker value={attachments} onChange={setAttachments} disabled={dis} />
          </Field>
        </div>
      )}

      {submission && <p className="text-[11px] text-ink-400 mt-4">Enviado el {new Date(submission.created_at).toLocaleString('es-PE')}</p>}
    </Modal>
  );
}
