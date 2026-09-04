import { useState, useEffect } from 'react';
import {
  ClipboardList, Clock, CheckCircle2, AlertTriangle, FilePlus2, UserPlus, FolderOpen, CalendarClock,
  ChevronRight, MapPin, ArrowRight,
} from 'lucide-react';
import { PageHeader, StatCard } from '@/components/PageHeader';
import { Card, SectionHeader, Avatar, Badge, ProgressBar } from '@/components/ui';
import { BarChart } from '@/components/charts';
import { cn } from '@/lib/utils';
import { statusColor, statusLabel, priorityColor, serviceColor } from '@/data/mockData';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function mondayOfThisWeek() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function SupervisorDashboard({ onSelect, setPage }: { onSelect: (w: any) => void; setPage: (p: string) => void }) {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const [ordersRes, techRes] = await Promise.all([
      supabase.from('work_orders').select('*').order('scheduled_date'),
      supabase.from('profiles').select('id, full_name, title, initials, avatar_color, status').eq('role', 'technician').order('full_name'),
    ]);
    if (ordersRes.data) setOrders(ordersRes.data);
    if (techRes.data) setTechnicians(techRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  if (!profile) return null;

  const today = orders.filter((w) => w.scheduled_date === todayISO());
  const pending = orders.filter((w) => w.status === 'open' || w.status === 'scheduled').length;
  const completed = orders.filter((w) => w.status === 'completed').length;
  const urgent = orders.filter((w) => w.priority === 'urgent' && w.status !== 'completed').length;
  const upcoming = orders.filter((w) => w.status === 'scheduled' || w.status === 'open').slice(0, 5);

  const techMap = new Map(technicians.map((t) => [t.id, t]));

  const monday = mondayOfThisWeek();
  const weekData = WEEKDAYS.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    return { label, value: orders.filter((w) => w.scheduled_date === iso).length };
  });

  return (
    <div>
      <PageHeader
        title="Panel de Supervisor"
        subtitle={`${profile.region ?? 'Selecom'} · ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`}
        breadcrumbs={['Home', 'Supervisor', 'Dashboard']}
        actions={
          <>
            <button className="btn-secondary" onClick={() => setPage('calendar')}><CalendarClock size={15} /> Calendario</button>
            <button className="btn-primary" onClick={() => setPage('workorders')}><FilePlus2 size={15} /> Crear Orden de Trabajo</button>
          </>
        }
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-ink-500">Loading dashboard…</div></Card>
      ) : (
      <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Trabajo de Hoy" value={today.length} icon={ClipboardList} iconColor="bg-primary-50 text-primary-600" />
        <StatCard label="Trabajos Pendientes" value={pending} icon={Clock} iconColor="bg-amber-50 text-amber-600" />
        <StatCard label="Trabajos Completados" value={completed} icon={CheckCircle2} iconColor="bg-emerald-50 text-emerald-600" />
        <StatCard label="Trabajos Urgentes" value={urgent} icon={AlertTriangle} iconColor="bg-red-50 text-red-600" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <QuickAction icon={FilePlus2} label="Crear Orden de Trabajo" onClick={() => setPage('workorders')} />
        <QuickAction icon={UserPlus} label="Asignar Técnico" onClick={() => setPage('workorders')} />
        <QuickAction icon={FolderOpen} label="Subir Documentos" onClick={() => setPage('documents')} />
        <QuickAction icon={CalendarClock} label="Reprogramar" onClick={() => setPage('calendar')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Today's schedule */}
        <Card className="lg:col-span-2" pad={false}>
          <div className="p-5 pb-3"><SectionHeader title="Calendario de Hoy" subtitle={`${today.length} jobs scheduled today`} action={<button className="text-sm font-medium text-primary-600" onClick={() => setPage('calendar')}>Open calendar</button>} /></div>
          <div className="divide-y divide-ink-50">
            {today.length === 0 && <div className="px-5 py-8 text-center text-sm text-ink-400">Descansando.</div>}
            {today.map((w) => {
              const tech = w.technician_id ? techMap.get(w.technician_id) : null;
              return (
                <button key={w.id} onClick={() => onSelect(w)} className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-ink-50/40 text-left transition">
                  <div className="text-center w-14 shrink-0">
                    <div className="text-sm font-bold text-ink-900">{w.scheduled_time}</div>
                    <div className="text-[11px] text-ink-400">{w.duration_hrs}h</div>
                  </div>
                  <div className={cn('h-12 w-1 rounded-full shrink-0', w.priority === 'urgent' ? 'bg-red-500' : w.priority === 'high' ? 'bg-orange-500' : 'bg-primary-400')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-primary-700">{w.code}</span>
                      <Badge className={serviceColor(w.service_type)}>{w.service_type}</Badge>
                      <Badge className={statusColor(w.status)}>{statusLabel(w.status)}</Badge>
                    </div>
                    <div className="text-sm font-medium text-ink-900 mt-0.5 truncate">{w.client} — {w.site}</div>
                    {w.address && <div className="text-xs text-ink-500 flex items-center gap-1 mt-0.5"><MapPin size={10} /> {w.address}</div>}
                  </div>
                  {tech && <Avatar initials={tech.initials} color={tech.avatar_color} size="sm" />}
                  <ChevronRight size={16} className="text-ink-300" />
                </button>
              );
            })}
          </div>
        </Card>

        {/* Technician assignment panel */}
        <Card pad={false}>
          <div className="p-5 pb-3"><SectionHeader title="Tecnicos" subtitle="actividad de hoy" /></div>
          <div className="divide-y divide-ink-50">
            {technicians.slice(0, 6).map((t) => {
              const assigned = orders.filter((w) => w.technician_id === t.id && w.scheduled_date === todayISO());
              return (
                <div key={t.id} className="px-5 py-3.5 hover:bg-ink-50/40">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar initials={t.initials} color={t.avatar_color} size="sm" />
                      <span className={cn('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white', t.status === 'active' ? 'bg-emerald-500' : 'bg-ink-300')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink-900 truncate">{t.full_name}</div>
                      <div className="text-xs text-ink-500 truncate">{t.title}</div>
                    </div>
                    <Badge className={assigned.length > 0 ? 'bg-primary-50 text-primary-700' : 'bg-emerald-50 text-emerald-700'}>
                      {assigned.length > 0 ? `${assigned.length} jobs` : 'Free'}
                    </Badge>
                  </div>
                  {assigned.length > 0 && (
                    <div className="mt-2.5"><ProgressBar value={Math.min(100, (assigned.length / 4) * 100)} barClass="bg-primary-500" /></div>
                  )}
                </div>
              );
            })}
            {technicians.length === 0 && <div className="px-5 py-8 text-center text-sm text-ink-400">No technicians found.</div>}
          </div>
          <button onClick={() => setPage('technicians')} className="w-full py-2.5 text-sm font-medium text-primary-600 hover:bg-primary-50 border-t border-ink-100 flex items-center justify-center gap-1">View all technicians <ArrowRight size={14} /></button>
        </Card>
      </div>

      {/* Upcoming + weekly load */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <SectionHeader title="Maintenimiento Programado" subtitle="Próximas órdenes programadas" />
          <div className="space-y-1">
            {upcoming.length === 0 && <div className="text-center text-sm text-ink-400 py-6">No hay nada programado.</div>}
            {upcoming.map((w) => (
              <button key={w.id} onClick={() => onSelect(w)} className="w-full flex items-center gap-3 py-2.5 border-b border-ink-50 last:border-0 hover:bg-ink-50/40 rounded-lg px-2 text-left">
                <Badge className={priorityColor(w.priority)}>{w.priority}</Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink-900 truncate">{w.client}</div>
                  <div className="text-xs text-ink-500">{w.service_type} · {w.scheduled_date} at {w.scheduled_time}</div>
                </div>
                <ChevronRight size={15} className="text-ink-300" />
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <SectionHeader title="Carga Semanal" subtitle="Órdenes programadas por día" />
          <BarChart data={weekData} height={200} />
        </Card>
      </div>
      </>
      )}
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick }: { icon: typeof FilePlus2; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="card-pad text-left group hover:shadow-card-md hover:border-primary-200 transition-all">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center group-hover:bg-primary-600 group-hover:text-white transition-colors"><Icon size={20} /></div>
        <div className="text-sm font-semibold text-ink-900">{label}</div>
      </div>
    </button>
  );
}
