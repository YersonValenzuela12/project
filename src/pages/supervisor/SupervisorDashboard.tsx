import {
  ClipboardList, Clock, CheckCircle2, AlertTriangle, FilePlus2, UserPlus, FolderOpen, CalendarClock,
  ChevronRight, MapPin, ArrowRight,
} from 'lucide-react';
import { PageHeader, StatCard } from '@/components/PageHeader';
import { Card, SectionHeader, Avatar, Badge, ProgressBar } from '@/components/ui';
import { BarChart } from '@/components/charts';
import { cn } from '@/lib/utils';
import {
  workOrders, users, type WorkOrder, statusColor, statusLabel, priorityColor, serviceColor,
} from '@/data/mockData';

export function SupervisorDashboard({ onSelect, setPage }: { onSelect: (w: WorkOrder) => void; setPage: (p: string) => void }) {
  const today = workOrders.filter((w) => w.scheduledDate === '2026-08-07');
  const todayJobs = today.length;
  const pending = workOrders.filter((w) => w.status === 'open' || w.status === 'scheduled').length;
  const completed = workOrders.filter((w) => w.status === 'completed').length;
  const urgent = workOrders.filter((w) => w.priority === 'urgent' && w.status !== 'completed').length;

  const myTechs = users.filter((u) => u.role === 'technician');
  const upcoming = workOrders.filter((w) => w.status === 'scheduled' || w.status === 'open').slice(0, 5);

  return (
    <div>
      <PageHeader
        title="Supervisor Dashboard"
        subtitle="North Bay District · Friday, August 7, 2026"
        breadcrumbs={['Home', 'Supervisor', 'Dashboard']}
        actions={
          <>
            <button className="btn-secondary"><CalendarClock size={15} /> Reschedule</button>
            <button className="btn-primary" onClick={() => setPage('workorders')}><FilePlus2 size={15} /> Create Work Order</button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Today's Jobs" value={todayJobs} icon={ClipboardList} iconColor="bg-primary-50 text-primary-600" />
        <StatCard label="Pending Jobs" value={pending} icon={Clock} iconColor="bg-amber-50 text-amber-600" />
        <StatCard label="Completed Jobs" value={completed} icon={CheckCircle2} iconColor="bg-emerald-50 text-emerald-600" />
        <StatCard label="Urgent Jobs" value={urgent} icon={AlertTriangle} iconColor="bg-red-50 text-red-600" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <QuickAction icon={FilePlus2} label="Create Work Order" onClick={() => setPage('workorders')} />
        <QuickAction icon={UserPlus} label="Assign Technician" onClick={() => setPage('workorders')} />
        <QuickAction icon={FolderOpen} label="Upload Documents" onClick={() => setPage('documents')} />
        <QuickAction icon={CalendarClock} label="Reschedule" onClick={() => setPage('calendar')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Today's schedule */}
        <Card className="lg:col-span-2" pad={false}>
          <div className="p-5 pb-3"><SectionHeader title="Today's Schedule" subtitle={`${todayJobs} jobs scheduled for Aug 7`} action={<button className="text-sm font-medium text-primary-600" onClick={() => setPage('calendar')}>Open calendar</button>} /></div>
          <div className="divide-y divide-ink-50">
            {today.map((w) => {
              const tech = users.find((u) => u.id === w.technicianId);
              return (
                <button key={w.id} onClick={() => onSelect(w)} className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-ink-50/40 text-left transition">
                  <div className="text-center w-14 shrink-0">
                    <div className="text-sm font-bold text-ink-900">{w.scheduledTime}</div>
                    <div className="text-[11px] text-ink-400">{w.durationHrs}h</div>
                  </div>
                  <div className={cn('h-12 w-1 rounded-full shrink-0', w.priority === 'urgent' ? 'bg-red-500' : w.priority === 'high' ? 'bg-orange-500' : 'bg-primary-400')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-primary-700">{w.code}</span>
                      <Badge className={serviceColor(w.serviceType)}>{w.serviceType}</Badge>
                      <Badge className={statusColor(w.status)}>{statusLabel(w.status)}</Badge>
                    </div>
                    <div className="text-sm font-medium text-ink-900 mt-0.5 truncate">{w.client} — {w.site}</div>
                    <div className="text-xs text-ink-500 flex items-center gap-1 mt-0.5"><MapPin size={10} /> {w.address}</div>
                  </div>
                  {tech && <Avatar initials={tech.initials} color={tech.avatarColor} size="sm" />}
                  <ChevronRight size={16} className="text-ink-300" />
                </button>
              );
            })}
          </div>
        </Card>

        {/* Technician assignment panel */}
        <Card pad={false}>
          <div className="p-5 pb-3"><SectionHeader title="Technicians" subtitle="Availability today" /></div>
          <div className="divide-y divide-ink-50">
            {myTechs.slice(0, 6).map((t) => {
              const assigned = workOrders.filter((w) => w.technicianId === t.id && w.scheduledDate === '2026-08-07');
              return (
                <div key={t.id} className="px-5 py-3.5 hover:bg-ink-50/40">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar initials={t.initials} color={t.avatarColor} size="sm" />
                      <span className={cn('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white', t.status === 'active' ? 'bg-emerald-500' : 'bg-ink-300')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink-900 truncate">{t.name}</div>
                      <div className="text-xs text-ink-500 truncate">{t.title}</div>
                    </div>
                    <Badge className={assigned.length > 0 ? 'bg-primary-50 text-primary-700' : 'bg-emerald-50 text-emerald-700'}>
                      {assigned.length > 0 ? `${assigned.length} jobs` : 'Free'}
                    </Badge>
                  </div>
                  {assigned.length > 0 && (
                    <div className="mt-2.5"><ProgressBar value={(assigned.length / 4) * 100} barClass="bg-primary-500" /></div>
                  )}
                </div>
              );
            })}
          </div>
          <button onClick={() => setPage('technicians')} className="w-full py-2.5 text-sm font-medium text-primary-600 hover:bg-primary-50 border-t border-ink-100 flex items-center justify-center gap-1">View all technicians <ArrowRight size={14} /></button>
        </Card>
      </div>

      {/* Upcoming + weekly load */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <SectionHeader title="Upcoming Maintenance" subtitle="Next 7 days" />
          <div className="space-y-1">
            {upcoming.map((w) => (
              <button key={w.id} onClick={() => onSelect(w)} className="w-full flex items-center gap-3 py-2.5 border-b border-ink-50 last:border-0 hover:bg-ink-50/40 rounded-lg px-2 text-left">
                <Badge className={priorityColor(w.priority)}>{w.priority}</Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink-900 truncate">{w.client}</div>
                  <div className="text-xs text-ink-500">{w.serviceType} · {w.scheduledDate} at {w.scheduledTime}</div>
                </div>
                <ChevronRight size={15} className="text-ink-300" />
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <SectionHeader title="Weekly Workload" subtitle="Jobs scheduled per day" />
          <BarChart
            data={[
              { label: 'Mon', value: 4 }, { label: 'Tue', value: 6 }, { label: 'Wed', value: 5 },
              { label: 'Thu', value: 7 }, { label: 'Fri', value: 5 }, { label: 'Sat', value: 2 }, { label: 'Sun', value: 0 },
            ]}
            height={200}
          />
        </Card>
      </div>
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
