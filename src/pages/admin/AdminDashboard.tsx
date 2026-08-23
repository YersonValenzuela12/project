import {
  Users, Wrench, ClipboardList, FolderOpen, CheckCircle2, AlertTriangle,
  UserPlus, FilePlus2, Building2, Database, Download, ChevronRight, Clock,
} from 'lucide-react';
import { PageHeader, StatCard } from '@/components/PageHeader';
import { Card, SectionHeader, Avatar, Badge, ProgressBar } from '@/components/ui';
import { BarChart, DonutChart, HorizontalBars } from '@/components/charts';
import {
  users, workOrders, documents, recentActivities, monthlyWO, woByType,
  techPerformance, statusColor, statusLabel, serviceColor,
} from '@/data/mockData';
import type { Role } from '@/data/mockData';

export function AdminDashboard({ setPage, onAction }: { setPage: (p: string) => void; onAction: (a: string) => void }) {
  const activeTechs = users.filter((u) => u.role === 'technician' && u.status === 'active').length;
  const todayWOs = workOrders.filter((w) => w.scheduledDate === '2026-08-07').length;
  const completed = workOrders.filter((w) => w.status === 'completed').length;
  const openIncidents = workOrders.filter((w) => w.priority === 'urgent' && w.status !== 'completed').length;

  return (
    <div>
      <PageHeader
        title="Administrator Dashboard"
        subtitle="System-wide overview of users, operations, and compliance"
        breadcrumbs={['Home', 'Administrator', 'Dashboard']}
        actions={
          <>
            <button className="btn-secondary"><Download size={15} /> Export</button>
            <button className="btn-primary" onClick={() => onAction('create-wo')}><FilePlus2 size={15} /> Create Work Order</button>
          </>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <StatCard label="Total Users" value={users.length} icon={Users} iconColor="bg-primary-50 text-primary-600" delta={{ value: '8%', up: true }} />
        <StatCard label="Active Technicians" value={activeTechs} icon={Wrench} iconColor="bg-emerald-50 text-emerald-600" delta={{ value: '2', up: true }} />
        <StatCard label="Today's Work Orders" value={todayWOs} icon={ClipboardList} iconColor="bg-blue-50 text-blue-600" />
        <StatCard label="Pending Documents" value={documents.length} icon={FolderOpen} iconColor="bg-amber-50 text-amber-600" />
        <StatCard label="Completed Jobs" value={completed} icon={CheckCircle2} iconColor="bg-teal-50 text-teal-600" delta={{ value: '12%', up: true }} />
        <StatCard label="Open Incidents" value={openIncidents} icon={AlertTriangle} iconColor="bg-red-50 text-red-600" delta={{ value: '1', up: false }} />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <QuickAction icon={UserPlus} label="Create User" desc="Add a new team member" onClick={() => setPage('users')} />
        <QuickAction icon={FilePlus2} label="Create Work Order" desc="Dispatch a new job" onClick={() => setPage('workorders')} />
        <QuickAction icon={Building2} label="Assign Supervisor" desc="Manage regions" onClick={() => setPage('supervisors')} />
        <QuickAction icon={Database} label="System Backup" desc="Snapshot & restore" onClick={() => onAction('backup')} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <SectionHeader title="Monthly Work Orders" subtitle="Last 7 months · all service types" action={<Badge className="bg-primary-50 text-primary-700">Aug: 67</Badge>} />
          <BarChart data={monthlyWO.map((m) => ({ label: m.month, value: m.value }))} height={220} />
        </Card>
        <Card>
          <SectionHeader title="By Service Type" subtitle="This quarter" />
          <DonutChart
            data={woByType.map((d) => ({ label: d.type, value: d.value, color: d.color }))}
            centerLabel="146" centerSub="Total WOs"
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <SectionHeader title="Technician Performance" subtitle="Completed jobs · SLA %" />
          <HorizontalBars
            data={techPerformance.map((t) => ({ label: t.name, value: t.completed, sub: `· ${t.sla}% SLA`, color: t.color }))}
          />
        </Card>

        {/* Recent activities */}
        <Card className="lg:col-span-2">
          <SectionHeader title="Recent Activities" subtitle="Across all teams" action={<button className="text-sm font-medium text-primary-600 hover:text-primary-700" onClick={() => setPage('audit')}>View all</button>} />
          <div className="space-y-1">
            {recentActivities.map((a) => (
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

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card pad={false}>
          <div className="p-5 pb-3"><SectionHeader title="Latest Uploaded Documents" /></div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-y border-ink-100 bg-ink-50/50">
                <tr><th className="th">Document</th><th className="th">Category</th><th className="th">Size</th><th className="th">By</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {documents.slice(0, 5).map((d) => (
                  <tr key={d.id} className="hover:bg-ink-50/50">
                    <td className="td"><div className="flex items-center gap-2.5"><FolderOpen size={15} className="text-ink-400" /><span className="font-medium text-ink-800 truncate max-w-[200px]">{d.name}</span></div></td>
                    <td className="td"><Badge className={serviceColor(d.category as never)}>{d.category}</Badge></td>
                    <td className="td text-ink-500">{d.size}</td>
                    <td className="td text-ink-500">{d.by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card pad={false}>
          <div className="p-5 pb-3"><SectionHeader title="Recent User Logins" /></div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-y border-ink-100 bg-ink-50/50">
                <tr><th className="th">User</th><th className="th">Role</th><th className="th">Last login</th><th className="th">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {users.slice(0, 6).map((u) => (
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

export const _role: Role = 'admin'; // referenced for type import in router
