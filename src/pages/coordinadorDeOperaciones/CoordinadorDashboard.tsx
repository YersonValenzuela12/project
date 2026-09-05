import { useEffect, useState } from 'react';
import {
  ClipboardList, Clock, Loader2, CheckCircle2, AlertTriangle, UserX,
  FilePlus2, CalendarDays, Users, FormInput, BarChart3, ChevronRight, Wrench,
} from 'lucide-react';
import { PageHeader, StatCard } from '@/components/PageHeader';
import { Card, SectionHeader, Avatar, Badge } from '@/components/ui';
import { supabase } from '@/lib/supabase';

const SERVICE_LABELS_ES: Record<string, string> = {
  CCTV: 'CCTV', 'Access Control': 'Control de Acceso', 'Fire Alarm': 'Alarma contra Incendio',
  'Fire Water': 'Alarma de Agua', BMS: 'BMS', 'Electronic Security': 'Seguridad Electrónica',
};

type DashboardData = {
  stats: {
    today: number;
    pending: number;
    inProgress: number;
    completed: number;
    overdue: number;
    unassigned: number;
  };
  techsAvailable: number;
  techsBusy: number;
  alerts: { id: string; code: string; client: string; service_type: string; reason: 'overdue' | 'unassigned'; scheduled_date: string }[];
};

export function CoordinadorDashboard({ setPage, onAction }: { setPage: (p: string) => void; onAction: () => void }) {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    (async () => {
      const todayStr = new Date().toISOString().slice(0, 10);

      const [
        allOrdersRes, techniciansRes,
      ] = await Promise.all([
        supabase.from('work_orders').select('id, code, client, service_type, status, scheduled_date, technician_id'),
        supabase.from('profiles').select('id').eq('role', 'technician').eq('status', 'active'),
      ]);

      const orders = allOrdersRes.data ?? [];
      const totalTechs = (techniciansRes.data ?? []).length;

      const today = orders.filter((w: any) => w.scheduled_date === todayStr).length;
      const pending = orders.filter((w: any) => w.status === 'open' || w.status === 'scheduled').length;
      const inProgress = orders.filter((w: any) => w.status === 'in_progress').length;
      const completed = orders.filter((w: any) => w.status === 'completed').length;
      const overdueOrders = orders.filter((w: any) => w.status !== 'completed' && w.scheduled_date && w.scheduled_date < todayStr);
      const unassignedOrders = orders.filter((w: any) => !w.technician_id && w.status !== 'completed');

      const busyTechIds = new Set(
        orders
          .filter((w: any) => w.scheduled_date === todayStr && (w.status === 'scheduled' || w.status === 'in_progress'))
          .map((w: any) => w.technician_id)
          .filter(Boolean),
      );
      const techsBusy = busyTechIds.size;
      const techsAvailable = Math.max(0, totalTechs - techsBusy);

      const alerts = [
        ...overdueOrders.map((w: any) => ({ id: w.id, code: w.code, client: w.client, service_type: w.service_type, reason: 'overdue' as const, scheduled_date: w.scheduled_date })),
        ...unassignedOrders.map((w: any) => ({ id: `${w.id}-u`, code: w.code, client: w.client, service_type: w.service_type, reason: 'unassigned' as const, scheduled_date: w.scheduled_date })),
      ]
        .sort((a, b) => (a.scheduled_date ?? '').localeCompare(b.scheduled_date ?? ''))
        .slice(0, 6);

      setData({
        stats: { today, pending, inProgress, completed, overdue: overdueOrders.length, unassigned: unassignedOrders.length },
        techsAvailable,
        techsBusy,
        alerts,
      });
    })();
  }, []);

  if (!data) {
    return <div className="p-8 text-center text-ink-400 text-sm">Cargando panel…</div>;
  }

  const { stats, techsAvailable, techsBusy, alerts } = data;

  return (
    <div>
      <PageHeader
        title="Panel de Operaciones"
        subtitle="Vista general de la planificación y ejecución de trabajos"
        breadcrumbs={['Inicio', 'Coordinador', 'Panel']}
        actions={
          <button className="btn-primary" onClick={onAction}><FilePlus2 size={15} /> Crear Orden de Trabajo</button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <StatCard label="Programadas Hoy" value={stats.today} icon={ClipboardList} iconColor="bg-blue-50 text-blue-600" />
        <StatCard label="Pendientes" value={stats.pending} icon={Clock} iconColor="bg-ink-100 text-ink-600" />
        <StatCard label="En Proceso" value={stats.inProgress} icon={Loader2} iconColor="bg-primary-50 text-primary-600" />
        <StatCard label="Completadas" value={stats.completed} icon={CheckCircle2} iconColor="bg-emerald-50 text-emerald-600" />
        <StatCard label="Atrasadas" value={stats.overdue} icon={AlertTriangle} iconColor="bg-red-50 text-red-600" />
        <StatCard label="Sin Técnico" value={stats.unassigned} icon={UserX} iconColor="bg-amber-50 text-amber-600" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <QuickAction icon={FilePlus2} label="Crear Orden" desc="Nueva OT" onClick={onAction} />
        <QuickAction icon={CalendarDays} label="Calendario" desc="Ver programación" onClick={() => setPage('calendar')} />
        <QuickAction icon={Wrench} label="Técnicos" desc="Consultar equipo" onClick={() => setPage('technicians')} />
        <QuickAction icon={FormInput} label="Solicitudes" desc="Ver seguimiento" onClick={() => setPage('form_requests')} />
        <QuickAction icon={BarChart3} label="Reportes" desc="Generar informe" onClick={() => setPage('reports')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <SectionHeader title="Disponibilidad de Técnicos" subtitle="Hoy" />
          <div className="flex items-center justify-around py-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-600">{techsAvailable}</div>
              <div className="text-xs text-ink-500 mt-1">Disponibles</div>
            </div>
            <div className="h-12 w-px bg-ink-100" />
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-600">{techsBusy}</div>
              <div className="text-xs text-ink-500 mt-1">Ocupados</div>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <SectionHeader title="Alertas Importantes" subtitle="Órdenes atrasadas o sin técnico asignado" action={<button className="text-sm font-medium text-primary-600 hover:text-primary-700" onClick={() => setPage('workorders')}>Ver todas</button>} />
          {alerts.length === 0 ? (
            <div className="py-8 text-center text-sm text-ink-400">Sin alertas por ahora — todo en orden.</div>
          ) : (
            <div className="space-y-1">
              {alerts.map((a) => (
                <div key={a.id} className="flex items-center gap-3 py-2.5 border-b border-ink-50 last:border-0">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${a.reason === 'overdue' ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-900"><span className="font-mono font-semibold text-primary-700">{a.code}</span> · {a.client}</p>
                    <p className="text-xs text-ink-500">{SERVICE_LABELS_ES[a.service_type] ?? a.service_type}</p>
                  </div>
                  <Badge className={a.reason === 'overdue' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}>
                    {a.reason === 'overdue' ? 'Atrasada' : 'Sin técnico'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, desc, onClick }: { icon: typeof ClipboardList; label: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="card-pad text-left group hover:shadow-card-md hover:border-primary-200 transition-all">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center group-hover:bg-primary-600 group-hover:text-white transition-colors shrink-0">
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-ink-900 truncate">{label}</div>
          <div className="text-xs text-ink-500 truncate">{desc}</div>
        </div>
      </div>
    </button>
  );
}
