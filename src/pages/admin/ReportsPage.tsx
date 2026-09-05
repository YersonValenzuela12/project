import { useEffect, useState } from 'react';
import {
  FileDown, FileSpreadsheet, TrendingUp, Clock, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, SectionHeader, Badge, ProgressBar } from '@/components/ui';
import { LineChart, BarChart, DonutChart, HorizontalBars } from '@/components/charts';
import { supabase } from '@/lib/supabase';

const SERVICE_TYPE_COLORS: Record<string, string> = {
  CCTV: '#2563eb',
  'Access Control': '#0891b2',
  'Fire Alarm': '#dc2626',
  'Fire Water': '#ea580c',
  BMS: '#7c3aed',
  'Electronic Security': '#16a34a',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente',
};
const PRIORITY_COLORS: Record<string, string> = {
  low: '#16a34a', medium: '#d97706', high: '#ea580c', urgent: '#dc2626',
};

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function getMonday(d: Date) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday;
}

export function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ total: 0, completed: 0, completionRate: 0, urgentOpen: 0 });
  const [monthlyCreated, setMonthlyCreated] = useState<{ label: string; value: number }[]>([]);
  const [byService, setByService] = useState<{ label: string; value: number; color: string }[]>([]);
  const [byPriority, setByPriority] = useState<{ label: string; value: number; color: string }[]>([]);
  const [weeklyCompleted, setWeeklyCompleted] = useState<{ label: string; value: number }[]>([]);
  const [leaderboard, setLeaderboard] = useState<{ name: string; completed: number; share: number }[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const now = new Date();
      const sevenMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      const monday = getMonday(now);
      const mondayStr = monday.toISOString().slice(0, 10);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const sundayStr = sunday.toISOString().slice(0, 10);

      const [
        totalRes, completedRes, urgentOpenRes,
        monthlyRawRes, serviceRawRes, priorityRawRes,
        weeklyCompletedRawRes, completedTechRawRes,
      ] = await Promise.all([
        supabase.from('work_orders').select('*', { count: 'exact', head: true }),
        supabase.from('work_orders').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('work_orders').select('*', { count: 'exact', head: true }).eq('priority', 'urgent').neq('status', 'completed'),
        supabase.from('work_orders').select('created_at').gte('created_at', sevenMonthsAgo.toISOString()),
        supabase.from('work_orders').select('service_type'),
        supabase.from('work_orders').select('priority'),
        supabase.from('work_orders').select('scheduled_date').eq('status', 'completed').gte('scheduled_date', mondayStr).lte('scheduled_date', sundayStr),
        supabase.from('work_orders').select('technician_id').eq('status', 'completed'),
      ]);

      const total = totalRes.count ?? 0;
      const completed = completedRes.count ?? 0;
      setKpis({
        total, completed,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        urgentOpen: urgentOpenRes.count ?? 0,
      });

      const monthlyMap: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthlyMap[d.toLocaleString('es-PE', { month: 'short' })] = 0;
      }
      (monthlyRawRes.data ?? []).forEach((w: any) => {
        const key = new Date(w.created_at).toLocaleString('es-PE', { month: 'short' });
        if (key in monthlyMap) monthlyMap[key]++;
      });
      setMonthlyCreated(Object.entries(monthlyMap).map(([label, value]) => ({ label, value })));

      const serviceMap: Record<string, number> = {};
      (serviceRawRes.data ?? []).forEach((w: any) => { serviceMap[w.service_type] = (serviceMap[w.service_type] ?? 0) + 1; });
      setByService(Object.entries(serviceMap).map(([label, value]) => ({ label, value, color: SERVICE_TYPE_COLORS[label] ?? '#6b7280' })));

      const priorityMap: Record<string, number> = { low: 0, medium: 0, high: 0, urgent: 0 };
      (priorityRawRes.data ?? []).forEach((w: any) => { if (w.priority in priorityMap) priorityMap[w.priority]++; });
      setByPriority(Object.entries(priorityMap).map(([key, value]) => ({ label: PRIORITY_LABELS[key], value, color: PRIORITY_COLORS[key] })));

      const weeklyMap: Record<string, number> = {};
      WEEKDAY_LABELS.forEach((l) => { weeklyMap[l] = 0; });
      (weeklyCompletedRawRes.data ?? []).forEach((w: any) => {
        const d = new Date(`${w.scheduled_date}T00:00:00`);
        const idx = (d.getDay() + 6) % 7; // Monday = 0
        weeklyMap[WEEKDAY_LABELS[idx]]++;
      });
      setWeeklyCompleted(WEEKDAY_LABELS.map((label) => ({ label, value: weeklyMap[label] })));

      const techCounts: Record<string, number> = {};
      (completedTechRawRes.data ?? []).forEach((w: any) => {
        if (!w.technician_id) return;
        techCounts[w.technician_id] = (techCounts[w.technician_id] ?? 0) + 1;
      });
      const techIds = Object.keys(techCounts);
      let names = new Map<string, string>();
      if (techIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', techIds);
        names = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
      }
      const totalCompletedByTechs = Object.values(techCounts).reduce((a, b) => a + b, 0);
      const board = techIds
        .map((id) => ({
          name: names.get(id) ?? 'Desconocido',
          completed: techCounts[id],
          share: totalCompletedByTechs > 0 ? Math.round((techCounts[id] / totalCompletedByTechs) * 100) : 0,
        }))
        .sort((a, b) => b.completed - a.completed)
        .slice(0, 10);
      setLeaderboard(board);

      setLoading(false);
    })();
  }, []);

  const notReady = () => alert('La exportación estará disponible próximamente.');

  if (loading) {
    return (
      <div>
        <PageHeader title="Reportes y Analítica" subtitle="Desempeño operativo e indicadores del equipo" breadcrumbs={['Inicio', 'Administrador', 'Reportes']} />
        <Card><div className="p-8 text-center text-sm text-ink-500">Cargando reportes…</div></Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Reportes y Analítica"
        subtitle="Desempeño operativo e indicadores del equipo"
        breadcrumbs={['Inicio', 'Administrador', 'Reportes']}

      />
        {/*   estubo dentro de arriba}
        actions={
          <>
            <button className="btn-secondary" onClick={notReady}><FileSpreadsheet size={15} /> Exportar Excel</button>
            <button className="btn-primary" onClick={notReady}><FileDown size={15} /> Exportar PDF</button>
          </>
        }
   */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Órdenes Totales" value={String(kpis.total)} icon={Clock} />
        <KpiCard label="Completadas" value={String(kpis.completed)} icon={CheckCircle2} />
        <KpiCard label="Tasa de Finalización" value={`${kpis.completionRate}%`} icon={TrendingUp} />
        <KpiCard label="Urgentes sin resolver" value={String(kpis.urgentOpen)} icon={AlertTriangle} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <SectionHeader title="Tendencia de Órdenes de Trabajo" subtitle="Creadas por mes · últimos 7 meses" />
          <LineChart data={monthlyCreated} height={240} />
        </Card>
        <Card>
          <SectionHeader title="Por Tipo de Servicio" subtitle="Histórico" />
          <DonutChart data={byService} centerLabel={String(kpis.total)} centerSub="órdenes" />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <SectionHeader title="Distribución por Prioridad" subtitle="Histórico" />
          <HorizontalBars data={byPriority} />
        </Card>
        <Card>
          <SectionHeader title="Trabajos Completados — Esta Semana" subtitle="Conteo diario" />
          <BarChart data={weeklyCompleted} height={220} color="#16a34a" />
        </Card>
      </div>

      <Card pad={false} className="overflow-hidden">
        <div className="p-5 pb-3"><SectionHeader title="Ranking de Técnicos" subtitle="Por trabajos completados (histórico)" /></div>
        {leaderboard.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-500">Aún no hay trabajos completados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-ink-50/50 border-y border-ink-100">
                <tr>
                  <th className="th">#</th><th className="th">Técnico</th><th className="th">Completados</th>
                  <th className="th w-56">% del total completado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {leaderboard.map((t, i) => (
                  <tr key={t.name} className="hover:bg-ink-50/40">
                    <td className="td"><span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-ink-100 text-ink-600'}`}>{i + 1}</span></td>
                    <td className="td font-medium text-ink-900">{t.name}</td>
                    <td className="td font-semibold text-ink-900">{t.completed}</td>
                    <td className="td"><div className="flex items-center gap-2"><ProgressBar value={t.share} barClass="bg-primary-600" /><span className="text-xs text-ink-500 w-9">{t.share}%</span></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Clock }) {
  return (
    <Card>
      <div className="h-9 w-9 rounded-lg bg-ink-100 text-ink-600 flex items-center justify-center mb-2"><Icon size={18} /></div>
      <div className="text-2xl font-bold text-ink-900">{value}</div>
      <div className="text-sm text-ink-500">{label}</div>
    </Card>
  );
}