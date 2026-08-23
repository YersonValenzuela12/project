import { useState, useEffect } from 'react';
import {
  ClipboardList, Clock, CheckCircle2, FolderOpen, MapPin, ChevronRight, Play, Pause,
  Navigation, AlertTriangle,
} from 'lucide-react';
import { PageHeader, StatCard } from '@/components/PageHeader';
import { Card, SectionHeader, Avatar, Badge, ProgressBar } from '@/components/ui';
import { cn } from '@/lib/utils';
import { statusColor, statusLabel, priorityColor, serviceColor } from '@/data/mockData';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function mondayOfThisWeek() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function TechnicianDashboard({ onSelect, setPage }: { onSelect: (w: any) => void; setPage: (p: string) => void }) {
  const { profile } = useAuth();
  const [myJobs, setMyJobs] = useState<any[]>([]);
  const [supervisors, setSupervisors] = useState<Map<string, any>>(new Map());
  const [docCount, setDocCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);

      // Orders where I'm the primary technician
      const { data: primary } = await supabase.from('work_orders').select('*').eq('technician_id', profile.id);

      // Orders where I'm listed as an additional assignee
      const { data: assigneeRows } = await supabase.from('work_order_assignees').select('work_order_id').eq('user_id', profile.id);
      const assignedIds = (assigneeRows ?? []).map((r: any) => r.work_order_id);
      const { data: viaAssignment } = assignedIds.length > 0
        ? await supabase.from('work_orders').select('*').in('id', assignedIds)
        : { data: [] as any[] };

      const merged = [...(primary ?? [])];
      for (const w of viaAssignment ?? []) {
        if (!merged.find((m) => m.id === w.id)) merged.push(w);
      }
      setMyJobs(merged);

      // Supervisors referenced by these orders
      const supIds = [...new Set(merged.map((w: any) => w.supervisor_id).filter(Boolean))];
      if (supIds.length > 0) {
        const { data: sups } = await supabase.from('profiles').select('id, full_name, initials, avatar_color').in('id', supIds);
        setSupervisors(new Map((sups ?? []).map((s: any) => [s.id, s])));
      }

      // Total documents, as a stand-in for "unread" until read-tracking exists
      const { count } = await supabase.from('documents').select('id', { count: 'exact', head: true });
      setDocCount(count ?? 0);

      setLoading(false);
    })();
  }, [profile?.id]);

  if (!profile) return null;

  const today = myJobs.filter((w) => w.scheduled_date === todayISO());
  const pending = myJobs.filter((w) => w.status === 'scheduled' || w.status === 'open' || w.status === 'paused').length;
  const completed = myJobs.filter((w) => w.status === 'completed').length;
  const urgentOpen = myJobs.find((w) => w.priority === 'urgent' && w.status !== 'completed');
  const next = today.find((w) => w.status === 'in_progress' || w.status === 'scheduled') ?? today[0];

  const monday = mondayOfThisWeek();
  const weekCounts = WEEKDAYS.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    return myJobs.filter((w) => w.scheduled_date === iso).length;
  });
  const maxWeekCount = Math.max(1, ...weekCounts);

  const firstName = profile.full_name?.split(' ')[0] ?? profile.email;

  return (
    <div>
      <PageHeader
        title="My Dashboard"
        subtitle={`Good morning, ${firstName} — you have ${today.length} job${today.length === 1 ? '' : 's'} scheduled today`}
        breadcrumbs={['Home', 'Technician', 'My Dashboard']}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-ink-500">Loading your jobs…</div></Card>
      ) : (
      <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Today's Jobs" value={today.length} icon={ClipboardList} iconColor="bg-primary-50 text-primary-600" />
        <StatCard label="Pending Jobs" value={pending} icon={Clock} iconColor="bg-amber-50 text-amber-600" />
        <StatCard label="Completed Jobs" value={completed} icon={CheckCircle2} iconColor="bg-emerald-50 text-emerald-600" />
        <StatCard label="Documents" value={docCount} icon={FolderOpen} iconColor="bg-violet-50 text-violet-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Next work order — hero */}
        {next ? (
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
                  {next.address && <div className="flex items-center gap-1.5 text-sm text-ink-600 mt-2"><MapPin size={14} className="text-ink-400" />{next.address}</div>}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <Badge className={serviceColor(next.service_type)}>{next.service_type}</Badge>
                    <Badge className={statusColor(next.status)}>{statusLabel(next.status)}</Badge>
                    <span className="text-xs text-ink-500 flex items-center gap-1"><Clock size={12} /> {next.scheduled_time} · {next.duration_hrs}h</span>
                  </div>
                </div>
              </div>
              {next.description && <p className="text-sm text-ink-700 mt-4 leading-relaxed bg-ink-50 rounded-lg p-3">{next.description}</p>}

              <div className="flex items-center gap-2 mt-5">
                <button onClick={() => onSelect(next)} className="btn-primary"><Play size={15} /> {next.status === 'in_progress' ? 'Continue Job' : 'Start Job'}</button>
                <button onClick={() => onSelect(next)} className="btn-secondary"><Navigation size={15} /> Navigate</button>
                <button onClick={() => onSelect(next)} className="btn-ghost ml-auto">View details <ChevronRight size={15} /></button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="lg:col-span-2 flex items-center justify-center text-sm text-ink-500 py-12">
            No upcoming work orders scheduled for today.
          </Card>
        )}

        {/* Priority indicator + stats */}
        <div className="space-y-5">
          {urgentOpen ? (
            <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-red-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-11 w-11 rounded-xl bg-red-500 text-white flex items-center justify-center"><AlertTriangle size={22} /></div>
                <div><div className="text-sm font-semibold text-red-900">Urgent attention</div><div className="text-xs text-red-700/70">1 job needs action</div></div>
              </div>
              <p className="text-sm text-red-800">{urgentOpen.code} {urgentOpen.description ? `— ${urgentOpen.description}` : ''} · {urgentOpen.progress}% done.</p>
              <button onClick={() => onSelect(urgentOpen)} className="mt-3 text-sm font-semibold text-red-700 hover:text-red-900 flex items-center gap-1">Open now <ChevronRight size={14} /></button>
            </Card>
          ) : (
            <Card className="bg-emerald-50 border-emerald-100">
              <div className="text-sm font-semibold text-emerald-800">No urgent jobs right now 🎉</div>
            </Card>
          )}

          <Card>
            <SectionHeader title="This Week" subtitle="Your workload" />
            <div className="space-y-2.5">
              {WEEKDAYS.map((d, i) => (
                <div key={d} className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-ink-600 w-8">{d}</span>
                  <ProgressBar value={(weekCounts[i] / maxWeekCount) * 100} barClass="bg-primary-500" />
                  <span className="text-xs text-ink-500 w-8">{weekCounts[i]}j</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Today's schedule */}
      <Card pad={false}>
        <div className="p-5 pb-3"><SectionHeader title="Today's Schedule" subtitle={`${today.length} job${today.length === 1 ? '' : 's'} today`} action={<button className="text-sm font-medium text-primary-600" onClick={() => setPage('today')}>View all</button>} /></div>
        <div className="divide-y divide-ink-50">
          {today.length === 0 && <div className="px-5 py-8 text-center text-sm text-ink-400">Nothing scheduled for today.</div>}
          {today.map((w) => {
            const sup = w.supervisor_id ? supervisors.get(w.supervisor_id) : null;
            return (
              <button key={w.id} onClick={() => onSelect(w)} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-ink-50/40 text-left transition">
                <div className="text-center w-14 shrink-0">
                  <div className="text-base font-bold text-ink-900">{w.scheduled_time}</div>
                  <div className="text-[11px] text-ink-400">{w.duration_hrs}h</div>
                </div>
                <div className={cn('h-14 w-1.5 rounded-full shrink-0', w.priority === 'urgent' ? 'bg-red-500' : w.priority === 'high' ? 'bg-orange-500' : 'bg-primary-400')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-primary-700">{w.code}</span>
                    <Badge className={serviceColor(w.service_type)}>{w.service_type}</Badge>
                    <Badge className={statusColor(w.status)}>{statusLabel(w.status)}</Badge>
                  </div>
                  <div className="text-sm font-semibold text-ink-900 mt-1">{w.client}</div>
                  <div className="text-xs text-ink-500 flex items-center gap-1 mt-0.5"><MapPin size={10} /> {w.site}</div>
                  {w.progress > 0 && <div className="mt-2 max-w-xs"><ProgressBar value={w.progress} barClass={w.progress === 100 ? 'bg-emerald-500' : 'bg-primary-600'} /></div>}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {sup && <Avatar initials={sup.initials} color={sup.avatar_color} size="xs" />}
                  {w.status === 'in_progress' ? <Pause size={15} className="text-amber-500" /> : <ChevronRight size={16} className="text-ink-300" />}
                </div>
              </button>
            );
          })}
        </div>
      </Card>
      </>
      )}
    </div>
  );
}
