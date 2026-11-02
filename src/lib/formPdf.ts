import { jsPDF } from 'jspdf';
import { supabase } from './supabase';
import { fmtDateEs, type Requester } from './formsConfig';

export type PdfTemplate = {
  company_name: string;
  title: string;
  body: string;
  footer: string;
  signature_label: string;
};

// Used until an administrator saves their own model.
export const DEFAULT_MEDICAL_TEMPLATE: PdfTemplate = {
  company_name: 'Electronics Selecom',
  title: 'SOLICITUD DE DESCANSO MÉDICO',
  body:
    'Yo, {{nombre}}, con cargo de {{cargo}} (distrito: {{distrito}}; correo: {{correo}}; teléfono: {{telefono}}), solicito descanso médico por motivo de: {{tipo_baja}}.\n\n' +
    'Periodo solicitado: {{dias}} día(s) de recuperación, desde el {{fecha_inicio}} hasta el {{fecha_fin}}.\n\n' +
    'Detalle / razón:\n{{razon}}\n\n' +
    'Declaro que la información consignada es veraz.',
  footer: 'Documento generado por el sistema Selecom el {{fecha_emision}}. Solo es válido con la firma del trabajador.',
  signature_label: 'Firma del trabajador',
};

// Fields the administrator can drop into the model; the worker's data fills them in automatically.
export const TEMPLATE_FIELDS: { key: string; label: string }[] = [
  { key: 'nombre', label: 'Nombre' },
  { key: 'cargo', label: 'Cargo' },
  { key: 'distrito', label: 'Distrito' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'correo', label: 'Correo' },
  { key: 'tipo_baja', label: 'Tipo de baja' },
  { key: 'dias', label: 'Días de recuperación' },
  { key: 'fecha_inicio', label: 'Fecha de inicio' },
  { key: 'fecha_fin', label: 'Fecha de salida' },
  { key: 'razon', label: 'Razón / notas' },
  { key: 'fecha_emision', label: 'Fecha de emisión' },
  { key: 'codigo_solicitud', label: 'Código de solicitud' },
];

export const SAMPLE_VALUES: Record<string, string> = {
  nombre: 'Juan Pérez',
  cargo: 'Técnico',
  distrito: 'San Isidro',
  telefono: '999 999 999',
  correo: 'juan.perez@selecom.com',
  tipo_baja: 'Procedimiento médico',
  dias: '3',
  fecha_inicio: '01/09/2026',
  fecha_fin: '03/09/2026',
  razon: 'Texto de ejemplo del motivo indicado por el trabajador.',
  fecha_emision: new Date().toLocaleDateString('es-PE'),
  codigo_solicitud: 'A1B2C3D4',
};

export const fillTemplate = (text: string, values: Record<string, string>) =>
  text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key: string) => values[key.toLowerCase()] ?? '');

export async function loadTemplate(formType: string): Promise<PdfTemplate> {
  const { data } = await supabase.from('form_templates').select('*').eq('form_type', formType).maybeSingle();
  if (!data) return DEFAULT_MEDICAL_TEMPLATE;
  return {
    company_name: data.company_name ?? '',
    title: data.title ?? '',
    body: data.body ?? '',
    footer: data.footer ?? '',
    signature_label: data.signature_label || 'Firma del trabajador',
  };
}

export function buildMedicalLeaveValues(requester: Requester, fields: Record<string, string>, submissionId: string): Record<string, string> {
  return {
    nombre: requester.name ?? '',
    cargo: requester.title ?? '',
    distrito: requester.region ?? '',
    telefono: requester.phone ?? '',
    correo: requester.email ?? '',
    tipo_baja: fields.leave_type ?? '',
    dias: fields.days ?? '',
    fecha_inicio: fmtDateEs(fields.from_date),
    fecha_fin: fmtDateEs(fields.to_date),
    razon: fields.notes?.trim() || '—',
    fecha_emision: new Date().toLocaleDateString('es-PE'),
    codigo_solicitud: submissionId.slice(0, 8).toUpperCase(),
  };
}

export const pdfFileName = (name?: string) => {
  const slug = (name ?? 'trabajador').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `Descanso-medico-${slug || 'trabajador'}-${new Date().toISOString().slice(0, 10)}.pdf`;
};

export function generateTemplatePdf(template: PdfTemplate, values: Record<string, string>, fileName: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const left = 20;
  const width = 170;
  let y = 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(fillTemplate(template.company_name, values), left, y);
  doc.setDrawColor(200);
  doc.line(left, y + 3, left + width, y + 3);
  y += 22;

  doc.setFontSize(16);
  const titleLines = doc.splitTextToSize(fillTemplate(template.title, values), width);
  doc.text(titleLines, 105, y, { align: 'center' });
  y += titleLines.length * 7 + 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const bodyLines: string[] = doc.splitTextToSize(fillTemplate(template.body, values), width);
  for (const line of bodyLines) {
    if (y > 250) { doc.addPage(); y = 22; }
    doc.text(line, left, y);
    y += 6;
  }

  // Signature block
  y += 22;
  if (y > 255) { doc.addPage(); y = 40; }
  doc.setDrawColor(60);
  doc.line(left, y, left + 75, y);
  doc.setFontSize(10);
  doc.text(fillTemplate(template.signature_label, values), left, y + 5);
  doc.text('Fecha: ____ / ____ / ________', left + 100, y);

  // Footer and reference code, so the signed copy can be matched with the request
  doc.setFontSize(8);
  doc.setTextColor(110);
  const footerLines: string[] = doc.splitTextToSize(fillTemplate(template.footer, values), width);
  doc.text(footerLines.slice(0, 3), left, 280);
  doc.text(`Ref. ${values.codigo_solicitud ?? ''}`, left + width, 290, { align: 'right' });

  doc.save(fileName);
}
