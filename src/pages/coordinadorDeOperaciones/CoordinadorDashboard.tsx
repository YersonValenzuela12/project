import { useEffect, useState } from 'react';
import {
  Users, Wrench, ClipboardList, FolderOpen, CheckCircle2, AlertTriangle,
  UserPlus, FilePlus2, Building2, Database, Download, ChevronRight, Clock,
} from 'lucide-react';
import { PageHeader, StatCard } from '@/components/PageHeader';
import { Card, SectionHeader, Avatar, Badge } from '@/components/ui';
import { BarChart, DonutChart, HorizontalBars } from '@/components/charts';
import { supabase } from '@/lib/supabase';

const SERVICE_TYPE_COLORS: Record<string, string> = {
  CCTV: '#2563eb',
  'Access Control': '#059669',
  'Fire Alarm': '#dc2626',
  BMS: '#d97706',
};

const ACTIVITY_COLORS: Record<string, string> = {
  work_order: 'bg-blue-500',
  form_submission: 'bg-amber-500',
  document: 'bg-teal-500',
  user: 'bg-primary-500',
};

function serviceColor(category: string) {
  const map: Record<string, string> = {
    CCTV: 'bg-blue-50 text-blue-700',
    'Access Control': 'bg-emerald-50 text-emerald-700',
    'Fire Alarm': 'bg-red-50 text-red-700',
    BMS: 'bg-amber-50 text-amber-700',
  };
  return map[category] ?? 'bg-ink-100 text-ink-600';
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return '—';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

type DashboardData = {
  stats: {
    totalUsers: number;
    activeTechs: number;
    todayWOs: number;
    pendingDocs: number;
    completed: number;
    openIncidents: number;
  };
  monthlyWO: { month: string; value: number }[];
  woByType: { type: string; value: number; color: string }[];
  totalWOsThisQuarter: number;
  techPerformance: { name: string; completed: number; color: string }[];
  activities: { id: string; actor: string; action: string; detail: string; color: string; time: string }[];
  latestDocs: { id: string; name: string; category: string; size: string; by: string }[];
  recentLogins: {
    id: string; name: string; email: string; role: string; status: string;
    lastLogin: string; initials: string; avatarColor: string;
  }[];
};

export function CoordinadorDashboard({ setPage, onAction }: { setPage: (p: string) => void; onAction: (a: string) => void }) {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const sevenMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);

      const [
        totalUsersRes, activeTechsRes, todayWOsRes, pendingDocsRes, completedRes, openIncidentsRes,
        monthlyRawRes, quarterRawRes, completedWOsRawRes, activitiesRes, latestDocsRawRes, recentLoginsRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'technician').eq('status', 'active'),
        supabase.from('work_orders').select('*', { count: 'exact', head: true }).eq('scheduled_date', todayStr),
        supabase.from('documents').select('*', { count: 'exact', head: true }),
        supabase.from('work_orders').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('work_orders').select('*', { count: 'exact', head: true }).eq('priority', 'urgent').neq('status', 'completed'),
        supabase.from('work_orders').select('created_at').gte('created_at', sevenMonthsAgo.toISOString()),
        supabase.from('work_orders').select('service_type').gte('created_at', quarterStart.toISOString()),
        supabase.from('work_orders').select('technician_id').eq('status', 'completed'),
        supabase.from('audit_logs').select('id, actor_name, action, target, detail, created_at').order('created_at', { ascending: false }).limit(8),
        supabase.from('documents').select('id, name, category, size, uploaded_by').order('created_at', { ascending: false }).limit(5),
        supabase.from('profiles').select('id, full_name, email, role, status, last_login, avatar_color, initials').not('last_login', 'is', null).order('last_login', { ascending: false }).limit(6),
      ]);

      // Segunda pasada: buscar los nombres de perfiles referenciados por técnicos y por quien subió documentos
      const techIds = Array.from(new Set((completedWOsRawRes.data ?? []).map((w: any) => w.technician_id).filter(Boolean)));
      const uploaderIds = Array.from(new Set((latestDocsRawRes.data ?? []).map((d: any) => d.uploaded_by).filter(Boolean)));
      const allProfileIds = Array.from(new Set([...techIds, ...uploaderIds]));

      let profileMap = new Map<string, { full_name: string; avatar_color: string }>();
      if (allProfileIds.length > 0) {
        const { data: relatedProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_color')
          .in('id', allProfileIds);
        profileMap = new Map((relatedProfiles ?? []).map((p: any) => [p.id, p]));
      }

      // Monthly work orders (last 7 months)
      const monthlyMap: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthlyMap[d.toLocaleString('en-US', { month: 'short' })] = 0;
      }
      (monthlyRawRes.data ?? []).forEach((w: { created_at: string }) => {
        const key = new Date(w.created_at).toLocaleString('en-US', { month: 'short' });
        if (key in monthlyMap) monthlyMap[key]++;
      });
      const monthlyWO = Object.entries(monthlyMap).map(([month, value]) => ({ month, value }));

      // By service type (this quarter)
      const typeMap: Record<string, number> = {};
      (quarterRawRes.data ?? []).forEach((w: { service_type: string }) => {
        typeMap[w.service_type] = (typeMap[w.service_type] ?? 0) + 1;
      });
      const woByType = Object.entries(typeMap).map(([type, value]) => ({
        type, value, color: SERVICE_TYPE_COLORS[type] ?? '#6b7280',
      }));

      // Technician performance
      const techMap: Record<string, { name: string; completed: number; color: string }> = {};
      (completedWOsRawRes.data ?? []).forEach((w: any) => {
        if (!w.technician_id) return;
        if (!techMap[w.technician_id]) {
          const profile = profileMap.get(w.technician_id);
          techMap[w.technician_id] = {
            name: profile?.full_name ?? 'Unknown',
            completed: 0,
            color: profile?.avatar_color ?? '#2563eb',
          };
        }
        techMap[w.technician_id].completed++;
      });
      const techPerformance = Object.values(techMap).sort((a, b) => b.completed - a.completed).slice(0, 6);

      // Recent activities
      const activities = (activitiesRes.data ?? []).map((a: any) => ({
        id: a.id,
        actor: a.actor_name,
        action: a.action,
        detail: a.detail ?? '',
        color: ACTIVITY_COLORS[a.target ?? ''] ?? 'bg-ink-400',
        time: timeAgo(a.created_at),
      }));

      // Latest documents
      const latestDocs = (latestDocsRawRes.data ?? []).map((d: any) => ({
        id: d.id, name: d.name, category: d.category, size: d.size,
        by: profileMap.get(d.uploaded_by)?.full_name ?? '—',
      }));

      // Recent logins
      const recentLogins = (recentLoginsRes.data ?? []).map((u: any) => ({
        id: u.id, name: u.full_name, email: u.email, role: u.role, status: u.status,
        lastLogin: timeAgo(u.last_login), initials: u.initials, avatarColor: u.avatar_color,
      }));

      if (!cancelled) {
        setData({
          stats: {
            totalUsers: totalUsersRes.count ?? 0,
            activeTechs: activeTechsRes.count ?? 0,
            todayWOs: todayWOsRes.count ?? 0,
            pendingDocs: pendingDocsRes.count ?? 0,
            completed: completedRes.count ?? 0,
            openIncidents: openIncidentsRes.count ?? 0,
          },
          monthlyWO,
          woByType,
          totalWOsThisQuarter: quarterRawRes.data?.length ?? 0,
          techPerformance,
          activities,
          latestDocs,
          recentLogins,
        });
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (!data) {
    return <div className="p-8 text-center text-ink-400 text-sm">Loading dashboard…</div>;
  }

  const { stats, monthlyWO, woByType, totalWOsThisQuarter, techPerformance, activities, latestDocs, recentLogins } = data;

  return (
    <div>
      <PageHeader
        title="Coordinador Dashboard"
        subtitle="System-wide overview of users, operations, and compliance"
        breadcrumbs={['Home', 'Coordinador', 'Dashboard']}
        actions={
          <>
           {/*} <button className="btn-secondary"><Download size={15} /> Export</button>*/}
            <button className="btn-primary" onClick={() => onAction('create-wo')}><FilePlus2 size={15} /> Crear Ordenes de Trabajo</button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <StatCard label="Usuarios Registrados" value={stats.totalUsers} icon={Users} iconColor="bg-primary-50 text-primary-600" />
        <StatCard label="Tecnicos Activos" value={stats.activeTechs} icon={Wrench} iconColor="bg-emerald-50 text-emerald-600" />
        <StatCard label="Ordenes de Trabajo de Hoy" value={stats.todayWOs} icon={ClipboardList} iconColor="bg-blue-50 text-blue-600" />
        <StatCard label="Documentos Totales" value={stats.pendingDocs} icon={FolderOpen} iconColor="bg-amber-50 text-amber-600" />
        <StatCard label="Trabajos Completados" value={stats.completed} icon={CheckCircle2} iconColor="bg-teal-50 text-teal-600" />
        <StatCard label="Incidentes Abiertos" value={stats.openIncidents} icon={AlertTriangle} iconColor="bg-red-50 text-red-600" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <QuickAction icon={UserPlus} label="Crear Usuarios" desc="Agrega nuevos usuarios al sistema" onClick={() => setPage('users')} />
        <QuickAction icon={FilePlus2} label="Crear Orden de Trabajo" desc="Crea una nueva orden de trabajo" onClick={() => setPage('workorders')} />
        <QuickAction icon={Building2} label="Asignar Supervisor" desc="Gestiona un supervisor" onClick={() => setPage('supervisors')} />
        <QuickAction icon={Database} label="Backup del Sistema" desc="Proximamente" onClick={() => onAction('backup')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <SectionHeader
            title="Ordenes de Trabajo del Mes"
            subtitle="Ultimos 7 meses · todos los tipos de servicio"
            action={<Badge className="bg-primary-50 text-primary-700">{monthlyWO[monthlyWO.length - 1]?.month}: {monthlyWO[monthlyWO.length - 1]?.value}</Badge>}
          />
          <BarChart data={monthlyWO.map((m) => ({ label: m.month, value: m.value }))} height={220} />
        </Card>
        <Card>
          <SectionHeader title="Tipos de Servicio" subtitle="Estadistica" />
          <DonutChart
            data={woByType.map((d) => ({ label: d.type, value: d.value, color: d.color }))}
            centerLabel={String(totalWOsThisQuarter)} centerSub="Total"
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <SectionHeader title="Rendimiento de Técnicos" subtitle="Trabajos completados" />
          <HorizontalBars
            data={techPerformance.map((t) => ({ label: t.name, value: t.completed, sub: '', color: t.color }))}
          />
        </Card>

        <Card className="lg:col-span-2">
          <SectionHeader title="Actividades Recientes" subtitle="Resumen de todo el equipo" action={<button className="text-sm font-medium text-primary-600 hover:text-primary-700" onClick={() => setPage('audit')}> vista</button>} />
          <div className="space-y-1">
            {activities.length === 0 && <p className="text-sm text-ink-400 py-4 text-center">No hay actividades recientes</p>}
            {activities.map((a) => (
              <div key={a.id} className="flex items-start gap-3 py-2.5 border-b border-ink-50 last:border-0">
                <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${a.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink-900"><span className="font-semibold">{a.actor}</span> · {a.action}</p>
                  <p className="text-sm text-ink-500 truncate">{a.detail}</p>
                </div>
                <span className="text-xs text-ink-400 shrink-0 whitespace-nowrap">{a.time}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card pad={false}>
          <div className="p-5 pb-3"><SectionHeader title="Documentos Más Recientes" /></div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-y border-ink-100 bg-ink-50/50">
                <tr><th className="th">Documentos</th><th className="th">Categoria</th><th className="th">Tamaño</th><th className="th">Por</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {latestDocs.map((d) => (
                  <tr key={d.id} className="hover:bg-ink-50/50">
                    <td className="td"><div className="flex items-center gap-2.5"><FolderOpen size={15} className="text-ink-400" /><span className="font-medium text-ink-800 truncate max-w-[200px]">{d.name}</span></div></td>
                    <td className="td"><Badge className={serviceColor(d.category)}>{d.category}</Badge></td>
                    <td className="td text-ink-500">{d.size}</td>
                    <td className="td text-ink-500">{d.by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card pad={false}>
          
          <div className="p-5 pb-3"><SectionHeader title="Reciente Usuarios Logeados" /><Badge className="bg-amber-50 text-amber-700">Próximamente</Badge></div>
       
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-y border-ink-100 bg-ink-50/50">
                <tr><th className="th">Usuario</th><th className="th">Roles</th><th className="th">Last login</th><th className="th">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {recentLogins.map((u) => (
                  <tr key={u.id} className="hover:bg-ink-50/50">
                    <td className="td"><div className="flex items-center gap-2.5"><Avatar initials={u.initials} color={u.avatarColor} size="sm" /><div><div className="font-medium text-ink-800">{u.name}</div><div className="text-xs text-ink-400">{u.email}</div></div></div></td>
                    <td className="td capitalize">{u.role}</td>
                    <td className="td text-ink-500"><span className="flex items-center gap-1.5"><Clock size={13} className="text-ink-400" />{u.lastLogin}</span></td>
                    <td className="td"><Badge className={u.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-100 text-ink-500'}>{u.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, desc, onClick }: { icon: typeof Users; label: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="card-pad text-left group hover:shadow-card-md hover:border-primary-200 transition-all">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center group-hover:bg-primary-600 group-hover:text-white transition-colors">
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-ink-900">{label}</div>
          <div className="text-xs text-ink-500">{desc}</div>
        </div>
        <ChevronRight size={16} className="text-ink-300 group-hover:text-primary-500 transition" />
      </div>
    </button>
  );
}

