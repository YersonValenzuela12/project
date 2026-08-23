import {
  ClipboardList, Clock, CheckCircle2, FolderOpen, MapPin, ChevronRight, Play, Pause,
  Navigation, AlertTriangle, Calendar,
} from 'lucide-react';
import { PageHeader, StatCard } from '@/components/PageHeader';
import { Card, SectionHeader, Avatar, Badge, ProgressBar } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  workOrders, users, documents, type WorkOrder, statusColor, statusLabel, priorityColor, serviceColor,
} from '@/data/mockData';

export function TechnicianDashboard({ onSelect, setPage }: { onSelect: (w: WorkOrder) => void; setPage: (p: string) => void }) {
  const myJobs = workOrders.filter((w) => w.technicianId === 'u-031');
  const today = myJobs.filter((w) => w.scheduledDate === '2026-08-07');
  const pending = myJobs.filter((w) => w.status === 'scheduled' || w.status === 'open' || w.status === 'paused').length;
  const completed = myJobs.filter((w) => w.status === 'completed').length;
  const unreadDocs = 4;

  const next = today.find((w) => w.status === 'in_progress' || w.status === 'scheduled') ?? today[0];

  return (
    <div>
      <PageHeader
        title="My Dashboard"
        subtitle="Good morning, Daniel — you have 3 jobs scheduled today"
        breadcrumbs={['Home', 'Technician', 'My Dashboard']}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Today's Jobs" value={today.length} icon={ClipboardList} iconColor="bg-primary-50 text-primary-600" />
        <StatCard label="Pending Jobs" value={pending} icon={Clock} iconColor="bg-amber-50 text-amber-600" />
        <StatCard label="Completed Jobs" value={completed} icon={CheckCircle2} iconColor="bg-emerald-50 text-emerald-600" />
        <StatCard label="Unread Documents" value={unreadDocs} icon={FolderOpen} iconColor="bg-violet-50 text-violet-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Next work order — hero */}
        {next && (
          <Card className="lg:col-span-2 overflow-hidden" pad={false}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-primary-600">Next work order</span>
                <Badge className={priorityColor(next.priority)}>{next.priority} priority</Badge>
              </div>
              <div className="flex items-start gap-4">
                <div className={cn('h-14 w-1.5 rounded-full shrink-0', next.priority === 'urgent' ? 'bg-red-500' : 'bg-primary-500')} />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm font-bold text-primary-700">{next.code}</div>
                  <h2 className="text-xl font-bold text-ink-900 mt-0.5">{next.client}</h2>
                  <p className="text-sm text-ink-500 mt-1">{next.site}</p>
                  <div className="flex items-center gap-1.5 text-sm text-ink-600 mt-2"><MapPin size={14} className="text-ink-400" />{next.address}</div>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <Badge className={serviceColor(next.serviceType)}>{next.serviceType}</Badge>
                    <Badge className={statusColor(next.status)}>{statusLabel(next.status)}</Badge>
                    <span className="text-xs text-ink-500 flex items-center gap-1"><Clock size={12} /> {next.scheduledTime} · {next.durationHrs}h</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-ink-700 mt-4 leading-relaxed bg-ink-50 rounded-lg p-3">{next.description}</p>

              <div className="flex items-center gap-2 mt-5">
                <button onClick={() => onSelect(next)} className="btn-primary"><Play size={15} /> {next.status === 'in_progress' ? 'Continue Job' : 'Start Job'}</button>
                <button onClick={() => onSelect(next)} className="btn-secondary"><Navigation size={15} /> Navigate</button>
                <button onClick={() => onSelect(next)} className="btn-ghost ml-auto">View details <ChevronRight size={15} /></button>
              </div>
            </div>

            {/* Mini map */}
            <div className="relative h-36 bg-ink-100 border-t border-ink-100">
              <img src="https://images.pexels.com/photos/2090642/pexels-photo-2090642.jpeg?auto=compress&cs=tinysrgb&w=800" alt="Route map" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-ink-900/15" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-primary-600 ring-4 ring-white flex items-center justify-center"><MapPin size={11} className="text-white" /></div>
              <div className="absolute bottom-2 left-3 text-white text-xs font-medium bg-ink-900/60 px-2 py-1 rounded">12 min drive · 1.2 km</div>
            </div>
          </Card>
        )}

        {/* Priority indicator + stats */}
        <div className="space-y-5">
          <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-red-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-11 w-11 rounded-xl bg-red-500 text-white flex items-center justify-center"><AlertTriangle size={22} /></div>
              <div><div className="text-sm font-semibold text-red-900">Urgent attention</div><div className="text-xs text-red-700/70">1 job needs action</div></div>
            </div>
            <p className="text-sm text-red-800">WO-2026-1001 camera PSU failure — in progress, 45% done.</p>
            <button className="mt-3 text-sm font-semibold text-red-700 hover:text-red-900 flex items-center gap-1">Open now <ChevronRight size={14} /></button>
          </Card>

          <Card>
            <SectionHeader title="This Week" subtitle="Your workload" />
            <div className="space-y-2.5">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d, i) => (
                <div key={d} className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-ink-600 w-8">{d}</span>
                  <ProgressBar value={[100, 80, 60, 75, 40][i]} barClass={[100, 100, 100].includes([100, 80, 60, 75, 40][i]) ? 'bg-emerald-500' : 'bg-primary-500'} />
                  <span className="text-xs text-ink-500 w-8">{[3, 2, 1, 2, 1][i]}j</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Today's schedule */}
      <Card pad={false}>
        <div className="p-5 pb-3"><SectionHeader title="Today's Schedule" subtitle="Friday, August 7 · 3 jobs" action={<button className="text-sm font-medium text-primary-600" onClick={() => setPage('today')}>View all</button>} /></div>
        <div className="divide-y divide-ink-50">
          {today.map((w) => {
            const sup = users.find((u) => u.id === w.supervisorId);
            return (
              <button key={w.id} onClick={() => onSelect(w)} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-ink-50/40 text-left transition">
                <div className="text-center w-14 shrink-0">
                  <div className="text-base font-bold text-ink-900">{w.scheduledTime}</div>
                  <div className="text-[11px] text-ink-400">{w.durationHrs}h</div>
                </div>
                <div className={cn('h-14 w-1.5 rounded-full shrink-0', w.priority === 'urgent' ? 'bg-red-500' : w.priority === 'high' ? 'bg-orange-500' : 'bg-primary-400')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-primary-700">{w.code}</span>
                    <Badge className={serviceColor(w.serviceType)}>{w.serviceType}</Badge>
                    <Badge className={statusColor(w.status)}>{statusLabel(w.status)}</Badge>
                  </div>
                  <div className="text-sm font-semibold text-ink-900 mt-1">{w.client}</div>
                  <div className="text-xs text-ink-500 flex items-center gap-1 mt-0.5"><MapPin size={10} /> {w.site}</div>
                  {w.progress > 0 && <div className="mt-2 max-w-xs"><ProgressBar value={w.progress} barClass={w.progress === 100 ? 'bg-emerald-500' : 'bg-primary-600'} /></div>}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {sup && <Avatar initials={sup.initials} color={sup.avatarColor} size="xs" />}
                  {w.status === 'in_progress' ? <Pause size={15} className="text-amber-500" /> : <ChevronRight size={16} className="text-ink-300" />}
                </div>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

export const _cal = Calendar; export const _docs = documents;
