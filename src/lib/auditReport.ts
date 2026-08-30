import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from './supabase';

const CATEGORY_LABELS_ES: Record<string, string> = {
  Activity: 'Actividad',
  Logins: 'Inicios de Sesión',
  System: 'Sistema',
  Security: 'Seguridad',
};

const SERVICE_TYPE_LABELS_ES: Record<string, string> = {
  CCTV: 'CCTV',
  'Access Control': 'Control de Acceso',
  'Fire Alarm': 'Alarma contra Incendio',
  BMS: 'BMS',
};

function categorize(action: string): 'Activity' | 'Logins' | 'System' | 'Security' {
  const a = action.toUpperCase();
  if (a.includes('LOGIN')) return 'Logins';
  if (a.includes('BACKUP') || a.includes('SYSTEM')) return 'System';
  if (a.includes('ROLE') || a.includes('POLICY') || a.includes('PERMISSION') || a.includes('PASSWORD')) return 'Security';
  return 'Activity';
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function generateAuditPdf(range: 'week' | 'month', activeTab: string) {
  const now = new Date();
  const start = range === 'week'
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const startDateStr = toDateStr(start);
  const endDateStr = toDateStr(now);
  const rangeLabel = range === 'week' ? 'Últimos 7 días' : now.toLocaleString('es-PE', { month: 'long', year: 'numeric' });
  const categoryLabel = CATEGORY_LABELS_ES[activeTab] ?? activeTab;

  const [woRes, auditRes] = await Promise.all([
    supabase.from('work_orders')
      .select('technician_id, service_type, client, site, status, scheduled_date')
      .gte('scheduled_date', startDateStr)
      .lte('scheduled_date', endDateStr),
    supabase.from('audit_logs')
      .select('id, actor_name, action, target, detail, ip_address, created_at')
      .gte('created_at', start.toISOString())
      .order('created_at', { ascending: false }),
  ]);

  const allWorkOrders = woRes.data ?? [];
  const completedWorkOrders = allWorkOrders.filter((w: any) => w.status === 'completed');
  const auditLogs = (auditRes.data ?? []).filter((l: any) => categorize(l.action) === activeTab);

  const techIds = Array.from(new Set(completedWorkOrders.map((w: any) => w.technician_id).filter(Boolean)));
  let profileMap = new Map<string, string>();
  if (techIds.length > 0) {
    const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', techIds);
    profileMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
  }

  const techCounts = new Map<string, number>();
  completedWorkOrders.forEach((w: any) => {
    if (!w.technician_id) return;
    const name = profileMap.get(w.technician_id) ?? 'Desconocido';
    techCounts.set(name, (techCounts.get(name) ?? 0) + 1);
  });
  const techRows = Array.from(techCounts.entries()).sort((a, b) => b[1] - a[1]);

  const typeCounts = new Map<string, number>();
  allWorkOrders.forEach((w: any) => {
    typeCounts.set(w.service_type, (typeCounts.get(w.service_type) ?? 0) + 1);
  });
  const typeRows = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1]);

  const placeCounts = new Map<string, number>();
  allWorkOrders.forEach((w: any) => {
    const label = w.site ? `${w.client} — ${w.site}` : w.client;
    placeCounts.set(label, (placeCounts.get(label) ?? 0) + 1);
  });
  const placeRows = Array.from(placeCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const doc = new jsPDF();
  let y = 18;

  doc.setFontSize(16);
  doc.text('Selecom — Reporte de Operaciones', 14, y);
  y += 7;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Periodo: ${rangeLabel}  ·  Generado: ${now.toLocaleString('es-PE')}`, 14, y);
  doc.setTextColor(0);
  y += 10;

  doc.setFontSize(12);
  doc.text('Resumen', 14, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    head: [['Indicador', 'Valor']],
    body: [
      ['Órdenes de trabajo programadas en el periodo', String(allWorkOrders.length)],
      ['Completadas', String(completedWorkOrders.length)],
      [`Eventos de auditoría (${categoryLabel})`, String(auditLogs.length)],
    ],
    theme: 'striped',
    styles: { fontSize: 9 },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(12);
  doc.text('Desempeño de Técnicos (trabajos completados)', 14, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    head: [['Técnico', 'Trabajos completados']],
    body: techRows.length ? techRows.map(([name, count]) => [name, String(count)]) : [['Sin trabajos completados en este periodo', '']],
    theme: 'striped',
    styles: { fontSize: 9 },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(12);
  doc.text('Por Sistema / Tipo de Servicio', 14, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    head: [['Tipo de servicio', 'Trabajos programados']],
    body: typeRows.length ? typeRows.map(([type, count]) => [SERVICE_TYPE_LABELS_ES[type] ?? type, String(count)]) : [['Sin datos', '']],
    theme: 'striped',
    styles: { fontSize: 9 },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(12);
  doc.text('Ubicaciones / Clientes Más Recurrentes', 14, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    head: [['Cliente / Sitio', 'Trabajos programados']],
    body: placeRows.length ? placeRows.map(([place, count]) => [place, String(count)]) : [['Sin datos', '']],
    theme: 'striped',
    styles: { fontSize: 9 },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  if (y > 250) { doc.addPage(); y = 18; }
  doc.setFontSize(12);
  doc.text(`Registro de Auditoría — ${categoryLabel}`, 14, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    head: [['Actor', 'Acción', 'Objetivo', 'Detalle', 'IP', 'Fecha y hora']],
    body: auditLogs.length
      ? auditLogs.map((l: any) => [
          l.actor_name, l.action, l.target ?? '—', l.detail ?? '—', l.ip_address ?? '—',
          new Date(l.created_at).toLocaleString('es-PE'),
        ])
      : [['Sin registros', '', '', '', '', '']],
    theme: 'striped',
    styles: { fontSize: 8 },
    columnStyles: { 3: { cellWidth: 45 } },
  });

  const filename = `selecom-reporte-auditoria-${range}-${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
