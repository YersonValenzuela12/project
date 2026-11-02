import { supabase } from './supabase';

export type FormType = 'mobility' | 'medical_leave' | 'complaint' | 'expense_claim';

// The mock "forms" list identifies each form by its English name; this maps it to the type stored in the database.
export const FORM_TYPE_BY_NAME: Record<string, FormType> = {
  'Mobility Form': 'mobility',
  'Medical Leave Form': 'medical_leave',
  'Complaint Form': 'complaint',
  'Expense Claim': 'expense_claim',
};

export const FORM_TEXT_ES: Record<FormType, { name: string; desc: string }> = {
  mobility: { name: 'Formulario de Movilidad', desc: 'Registra el uso de vehículo y el recorrido' },
  medical_leave: { name: 'Descanso Médico', desc: 'Solicita un descanso médico por ausencia' },
  complaint: { name: 'Formulario de Quejas', desc: 'Registra una queja de servicio o del centro de trabajo' },
  expense_claim: { name: 'Reembolso de Gastos', desc: 'Solicita el reembolso de gastos de campo' },
};

export const formLabelEs = (type: string) => FORM_TEXT_ES[type as FormType]?.name ?? type;

// draft = waiting for the signed document · pending = sent, waiting for the administrator.
export const STATUS_META: Record<string, { label: string; className: string }> = {
  draft: { label: 'Pendiente de firma', className: 'bg-amber-50 text-amber-700' },
  pending: { label: 'Enviado', className: 'bg-primary-50 text-primary-700' },
  approved: { label: 'Aprobado', className: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: 'Rechazado', className: 'bg-red-50 text-red-700' },
};

export const FIELD_LABELS: Record<string, string> = {
  vehicle: 'Tipo de movilidad',
  period: 'Tiempo',
  start_mileage: 'Inicio',
  end_mileage: 'Llegada',
  routes: 'Tipo de viaje',
  project_code: 'Código de proyecto',
  reimbursement_amount: 'Monto a reembolsar',
  leave_type: 'Tipo de baja',
  days: 'Días de recuperación',
  from_date: 'Inicio',
  to_date: 'Salida',
  notes: 'Razón / notas',
  subject: 'Tema',
  date: 'Fecha',
  details: 'Detalles',
  amount: 'Costo',
  category: 'Categoría',
};

export const FIELD_ORDER: Record<FormType, string[]> = {
  mobility: ['vehicle', 'period', 'start_mileage', 'end_mileage', 'routes', 'project_code', 'reimbursement_amount'],
  medical_leave: ['leave_type', 'days', 'from_date', 'to_date', 'notes'],
  complaint: ['subject', 'date', 'details'],
  expense_claim: ['subject', 'date', 'details', 'amount', 'category'],
};

export const REQUIRED_FIELDS: Record<FormType, string[]> = {
  mobility: ['vehicle', 'period', 'start_mileage', 'end_mileage', 'project_code'],
  medical_leave: ['leave_type', 'days', 'from_date', 'to_date'],
  complaint: ['subject', 'date', 'details'],
  expense_claim: ['subject', 'date', 'details', 'amount', 'category'],
};

// Fields that end up printed in the medical-leave PDF. If any of them changes, the signed document no longer matches.
export const PDF_FIELD_KEYS = ['leave_type', 'days', 'from_date', 'to_date', 'notes'];

export const LEAVE_TYPES = ['Procedimiento médico', 'Recuperación'];
export const CATEGORY_LABELS: Record<string, string> = { Materials: 'Materiales', Travel: 'Viaje', Equipment: 'Equipos', Other: 'Otro' };

// Keys inside `data` that are not form fields.
export const INTERNAL_KEYS = new Set(['requester', 'receipt', 'signed_file', 'pdf_fields_hash', 'pdf_generated_at', 'attachments']);

export const normalizeProjectCode = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
export const isValidProjectCode = (v: string) => /^[A-Z0-9]{4,8}$/.test(v);

export const fmtDateEs = (iso?: string) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso ?? '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

const DATE_FIELDS = new Set(['date', 'from_date', 'to_date']);
const MONEY_FIELDS = new Set(['amount', 'reimbursement_amount']);

export const displayFieldValue = (key: string, value: unknown): string => {
  const v = String(value ?? '').trim();
  if (!v) return '—';
  if (DATE_FIELDS.has(key)) return fmtDateEs(v);
  if (MONEY_FIELDS.has(key) && !isNaN(Number(v))) return `S/. ${Number(v).toFixed(2)}`;
  if (key === 'category') return CATEGORY_LABELS[v] ?? v;
  return v;
};

export type Requester = { name?: string; email?: string; title?: string; region?: string; phone?: string };

// ---------------------------------------------------------------------------
// Files (private bucket "FormFiles": receipts and signed documents)
// ---------------------------------------------------------------------------
export type StoredFile = { path: string; name: string; size: number; type: string };

export const FORM_BUCKET = 'FormFiles';
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const isAllowedFile = (f: File) => f.type === 'application/pdf' || f.type.startsWith('image/');

const safeName = (name: string) => name.replace(/[^\w.\-]+/g, '_').slice(-80);

export async function uploadFormFile(userId: string, submissionId: string, kind: 'receipt' | 'signed', file: File): Promise<StoredFile> {
  // The first folder is the user's id: storage policies only let each person write inside their own folder.
  const path = `${userId}/${submissionId}/${kind}-${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error } = await supabase.storage.from(FORM_BUCKET).upload(path, file, { contentType: file.type || undefined });
  if (error) throw error;
  return { path, name: file.name, size: file.size, type: file.type };
}

export async function removeFormFile(path: string) {
  try { await supabase.storage.from(FORM_BUCKET).remove([path]); } catch { /* best effort */ }
}

// The bucket is private: files are opened through a short-lived signed link.
export async function openFormFile(file: StoredFile) {
  const win = window.open('', '_blank'); // opened first so the browser does not block it after the async call
  const { data, error } = await supabase.storage.from(FORM_BUCKET).createSignedUrl(file.path, 120);
  if (error || !data?.signedUrl) {
    win?.close();
    alert('No se pudo abrir el archivo.');
    return;
  }
  if (win) win.location.href = data.signedUrl; else window.location.href = data.signedUrl;
}
