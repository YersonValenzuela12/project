import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Filter, Lock } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, Badge, Avatar } from '@/components/ui';
import { cn } from '@/lib/utils';
import { priorityColor } from '@/data/mockData';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { WorkOrderFormModal } from '@/components/WorkOrderFormModal';

const HOURS = ['08', '09', '10', '11', '12', '13', '14', '15', '16', '17'];
const hourHeight = 56;

function getWeekDays(offset: number) {
  const now = new Date();
  const day = now.getDay(); // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday + offset * 7);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push({
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dateLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      iso: d.toISOString().slice(0, 10),
    });
  }
  return days;
}

function weekRangeLabel(days: { iso: string }[]) {
  const first = new Date(days[0].iso);
  const last = new Date(days[days.length - 1].iso);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${fmt(last)}`;
}

function useSelectedDay(weekOffset: number, days: { iso: string }[]) {
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  useEffect(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const idx = days.findIndex((d) => d.iso === todayIso);
    setSelectedDayIdx(idx >= 0 ? idx : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset]);
  return [selectedDayIdx, setSelectedDayIdx] as const;
}

function DayChips({
  days, selectedDayIdx, setSelectedDayIdx, ordersByDay,
}: {
  days: { iso: string; label: string; dateLabel: string }[];
  selectedDayIdx: number;
  setSelectedDayIdx: (i: number) => void;
  ordersByDay: (iso: string) => any[];
}) {
  const todayIso = new Date().toISOString().slice(0, 10);
  return (
    <div className="flex md:hidden gap-1.5 mb-4">
      {days.map((d, i) => {
        const count = ordersByDay(d.iso).length;
        const isToday = d.iso === todayIso;
        const active = selectedDayIdx === i;
        return (
          <button
            key={d.iso}
            onClick={() => setSelectedDayIdx(i)}
            className={cn(
              'flex-1 rounded-lg px-1 py-2 text-center border transition',
              active ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-ink-200 text-ink-700',
            )}
          >
            <div className={cn('text-[10px] font-medium', active ? 'text-white/80' : 'text-ink-400')}>{d.label}</div>
            <div className={cn('text-sm font-bold', isToday && !active && 'text-primary-600')}>{d.dateLabel.split(' ')[1]}</div>
            <div className={cn('h-1 w-1 rounded-full mx-auto mt-1', count > 0 ? (active ? 'bg-white' : 'bg-primary-500') : 'bg-transparent')} />
          </button>
        );
      })}
    </div>
  );
}

function AgendaList({ orders, onSelect, techMap }: { orders: any[]; onSelect: (w: any) => void; techMap?: Map<string, any> }) {
  const sorted = [...orders].sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''));
  if (sorted.length === 0) {
    return <div className="md:hidden p-8 text-center text-sm text-ink-400 bg-white rounded-xl border border-ink-100">No jobs scheduled this day.</div>;
  }
  return (
    <div className="md:hidden space-y-2">
      {sorted.map((w) => {
        const tech = techMap && w.technician_id ? techMap.get(w.technician_id) : null;
        return (
          <button
            key={w.id}
            onClick={() => onSelect(w)}
            className="w-full text-left bg-white border border-ink-100 rounded-xl p-3 flex gap-3 hover:border-primary-300 transition"
          >
            <span className={cn('w-1.5 rounded-full shrink-0', serviceBg(w.service_type))} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-ink-900">{w.scheduled_time}</span>
                <Badge className={cn('text-[10px]', priorityColor(w.priority))}>{w.priority}</Badge>
              </div>
              <div className="text-sm font-medium text-ink-800 truncate mt-0.5">{w.client}</div>
              <div className="text-xs text-ink-500 truncate">
                {w.service_type}{tech ? ` · ${tech.full_name}` : techMap ? ' · Unassigned' : ''}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function CalendarPage({
  onSelect,
  role = 'technician',
}: {
  onSelect: (w: any) => void;
  role?: 'admin' | 'supervisor' | 'technician';
}) {
  const canEdit = role === 'admin' || role === 'supervisor';
  return canEdit
    ? <TeamCalendar onSelect={onSelect} role={role} />
    : <MyCalendar onSelect={onSelect} />;
}

// ============================================================
// Simplified single-user view (technicians) — Google Calendar-style.
// ============================================================
function MyCalendar({ onSelect }: { onSelect: (w: any) => void }) {
  const { profile } = useAuth();
  const [weekOffset, setWeekOffset] = useState(0);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const days = getWeekDays(weekOffset);
  const [selectedDayIdx, setSelectedDayIdx] = useSelectedDay(weekOffset, days);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const { data: primary } = await supabase.from('work_orders').select('*').eq('technician_id', profile.id);
      const { data: assigneeRows } = await supabase.from('work_order_assignees').select('work_order_id').eq('user_id', profile.id);
      const assignedIds = (assigneeRows ?? []).map((r: any) => r.work_order_id);
      const { data: viaAssignment } = assignedIds.length > 0
        ? await supabase.from('work_orders').select('*').in('id', assignedIds)
        : { data: [] as any[] };
      const merged = [...(primary ?? [])];
      for (const w of viaAssignment ?? []) {
        if (!merged.find((m) => m.id === w.id)) merged.push(w);
      }
      setOrders(merged);
      setLoading(false);
    })();
  }, [profile?.id]);

  return (
    <div>
      <PageHeader
        title="My Calendar"
        subtitle={`${weekRangeLabel(days)} · view only`}
        breadcrumbs={['Home', 'Technician', 'Calendar']}
        actions={
          <div className="flex items-center bg-white border border-ink-200 rounded-lg">
            <button onClick={() => setWeekOffset((w) => w - 1)} className="h-9 w-9 flex items-center justify-center text-ink-500 hover:bg-ink-50 rounded-l-lg"><ChevronLeft size={16} /></button>
            <button onClick={() => setWeekOffset(0)} className="px-3 text-sm font-semibold text-ink-800 hover:bg-ink-50">{weekOffset === 0 ? 'This week' : 'Back to today'}</button>
            <button onClick={() => setWeekOffset((w) => w + 1)} className="h-9 w-9 flex items-center justify-center text-ink-500 hover:bg-ink-50 rounded-r-lg"><ChevronRight size={16} /></button>
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-2 text-xs text-ink-500 bg-ink-50 border border-ink-200 rounded-lg px-3 py-2">
        <Lock size={13} /> You're viewing your calendar in read-only mode. Only admins and supervisors can reassign or reschedule jobs.
      </div>

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-ink-500">Loading calendar…</div></Card>
      ) : (
        <>
          <DayChips
            days={days}
            selectedDayIdx={selectedDayIdx}
            setSelectedDayIdx={setSelectedDayIdx}
            ordersByDay={(iso) => orders.filter((w) => w.scheduled_date === iso)}
          />
          <div className="mb-4">
            <AgendaList orders={orders.filter((w) => w.scheduled_date === days[selectedDayIdx].iso)} onSelect={onSelect} />
          </div>

          <Card pad={false} className="overflow-hidden hidden md:block">
            <div className="grid border-b border-ink-100 bg-ink-50/40" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
              <div className="border-r border-ink-100" />
              {days.map((d) => (
                <div key={d.iso} className="px-4 py-3 text-center border-r border-ink-100 last:border-r-0">
                  <div className="text-xs font-medium text-ink-500">{d.label}</div>
                  <div className="text-sm font-bold text-ink-900">{d.dateLabel}</div>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[980px] grid" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
                <div className="border-r border-ink-100 relative" style={{ height: hourHeight * HOURS.length }}>
                  {HOURS.map((h) => (
                    <div key={h} className="border-b border-ink-50 flex items-start justify-end pr-1.5 pt-0.5" style={{ height: hourHeight }}>
                      <span className="text-[10px] text-ink-400">{h}:00</span>
                    </div>
                  ))}
                </div>

                {days.map((d) => {
                  const dayOrders = orders.filter((w) => w.scheduled_date === d.iso);
                  return (
                    <div key={d.iso} className="border-r border-ink-100 last:border-r-0 relative">
                      <div className="relative" style={{ height: hourHeight * HOURS.length }}>
                        {HOURS.map((h) => (
                          <div key={h} className="border-b border-ink-50" style={{ height: hourHeight }} />
                        ))}
                        {dayOrders.map((w) => {
                          const hourIdx = HOURS.indexOf((w.scheduled_time ?? '09:00').split(':')[0]);
                          if (hourIdx < 0) return null;
                          const top = hourIdx * hourHeight;
                          const height = (w.duration_hrs ?? 1) * hourHeight - 4;
                          return (
                            <button
                              key={w.id}
                              onClick={() => onSelect(w)}
                              className={cn('absolute left-1 right-1 rounded-md px-2 py-1 text-left text-white text-xs shadow-sm hover:shadow-md hover:opacity-90 transition overflow-hidden cursor-pointer', serviceBg(w.service_type))}
                              style={{ top: top + 2, height: Math.max(height, 32) }}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-[10px]">{w.scheduled_time}</span>
                                <Badge className={cn('text-[9px] py-0 px-1', priorityColor(w.priority))}>{w.priority}</Badge>
                              </div>
                              <div className="font-medium text-[11px] truncate mt-0.5">{w.client}</div>
                              <div className="text-[10px] opacity-90 truncate">{w.service_type}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </>
      )}

      <Legend />
    </div>
  );
}

// ============================================================
// Team view (admin / supervisor) — no per-technician rows (scales to
// any number of technicians). Filter by technician, click a job to edit.
// ============================================================
function TeamCalendar({ onSelect, role }: { onSelect: (w: any) => void; role: 'admin' | 'supervisor' }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [orders, setOrders] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [filterTech, setFilterTech] = useState('all');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const days = getWeekDays(weekOffset);
  const [selectedDayIdx, setSelectedDayIdx] = useSelectedDay(weekOffset, days);

  const fetchData = async () => {
    setLoading(true);
    const [ordersRes, techRes] = await Promise.all([
      supabase.from('work_orders').select('*').order('scheduled_date'),
      supabase.from('profiles').select('id, full_name, initials, avatar_color').eq('role', 'technician').order('full_name'),
    ]);
    if (ordersRes.data) setOrders(ordersRes.data);
    if (techRes.data) setTechnicians(techRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSaved = () => { setCreateOpen(false); fetchData(); };

  const techMap = new Map(technicians.map((t) => [t.id, t]));
  const visibleOrders = filterTech === 'all' ? orders : orders.filter((w) => w.technician_id === filterTech);

  return (
    <div>
      <PageHeader
        title="Weekly Calendar"
        subtitle={`${weekRangeLabel(days)} · click a job to edit, reassign, or reschedule`}
        breadcrumbs={['Home', role === 'admin' ? 'Administrator' : 'Supervisor', 'Calendar']}
        actions={
          <>
            <div className="flex items-center bg-white border border-ink-200 rounded-lg">
              <button onClick={() => setWeekOffset((w) => w - 1)} className="h-9 w-9 flex items-center justify-center text-ink-500 hover:bg-ink-50 rounded-l-lg"><ChevronLeft size={16} /></button>
              <button onClick={() => setWeekOffset(0)} className="px-3 text-sm font-semibold text-ink-800 hover:bg-ink-50">{weekOffset === 0 ? 'This week' : 'Back to today'}</button>
              <button onClick={() => setWeekOffset((w) => w + 1)} className="h-9 w-9 flex items-center justify-center text-ink-500 hover:bg-ink-50 rounded-r-lg"><ChevronRight size={16} /></button>
            </div>
            <button className="btn-primary" onClick={() => setCreateOpen(true)}><Plus size={15} /> New Job</button>
          </>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Filter size={14} className="text-ink-400" />
        <select value={filterTech} onChange={(e) => setFilterTech(e.target.value)} className="input h-9 w-auto">
          <option value="all">All technicians ({technicians.length})</option>
          {technicians.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
        </select>
      </div>

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-ink-500">Loading calendar…</div></Card>
      ) : (
        <>
          <DayChips
            days={days}
            selectedDayIdx={selectedDayIdx}
            setSelectedDayIdx={setSelectedDayIdx}
            ordersByDay={(iso) => visibleOrders.filter((w) => w.scheduled_date === iso)}
          />
          <div className="mb-4">
            <AgendaList orders={visibleOrders.filter((w) => w.scheduled_date === days[selectedDayIdx].iso)} onSelect={onSelect} techMap={techMap} />
          </div>

          <Card pad={false} className="overflow-hidden hidden md:block">
            <div className="grid border-b border-ink-100 bg-ink-50/40" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
              <div className="border-r border-ink-100" />
              {days.map((d) => (
                <div key={d.iso} className="px-4 py-3 text-center border-r border-ink-100 last:border-r-0">
                  <div className="text-xs font-medium text-ink-500">{d.label}</div>
                  <div className="text-sm font-bold text-ink-900">{d.dateLabel}</div>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[980px] grid" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
                <div className="border-r border-ink-100 relative" style={{ height: hourHeight * HOURS.length }}>
                  {HOURS.map((h) => (
                    <div key={h} className="border-b border-ink-50 flex items-start justify-end pr-1.5 pt-0.5" style={{ height: hourHeight }}>
                      <span className="text-[10px] text-ink-400">{h}:00</span>
                    </div>
                  ))}
                </div>

                {days.map((d) => {
                  const dayOrders = visibleOrders.filter((w) => w.scheduled_date === d.iso);
                  return (
                    <div key={d.iso} className="border-r border-ink-100 last:border-r-0 relative">
                      <div className="relative" style={{ height: hourHeight * HOURS.length }}>
                        {HOURS.map((h) => (
                          <div key={h} className="border-b border-ink-50" style={{ height: hourHeight }} />
                        ))}
                        {dayOrders.map((w, idx) => {
                          const hourIdx = HOURS.indexOf((w.scheduled_time ?? '09:00').split(':')[0]);
                          if (hourIdx < 0) return null;
                          const top = hourIdx * hourHeight;
                          const height = (w.duration_hrs ?? 1) * hourHeight - 4;
                          const tech = w.technician_id ? techMap.get(w.technician_id) : null;
                          const overlapOffset = dayOrders.slice(0, idx).filter((o) => o.scheduled_time === w.scheduled_time).length * 6;
                          return (
                            <button
                              key={w.id}
                              onClick={() => onSelect(w)}
                              className={cn('absolute rounded-md px-2 py-1 text-left text-white text-xs shadow-sm hover:shadow-md hover:opacity-95 hover:z-20 transition overflow-hidden cursor-pointer', serviceBg(w.service_type))}
                              style={{ top: top + 2 + overlapOffset, left: 4 + overlapOffset, right: 4, height: Math.max(height, 32) }}
                            >
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="font-semibold text-[10px]">{w.scheduled_time}</span>
                                {tech && <Avatar initials={tech.initials} color="bg-white/25" size="xs" />}
                              </div>
                              <div className="font-medium text-[11px] truncate mt-0.5">{w.client}</div>
                              <div className="text-[10px] opacity-90 truncate">{tech ? tech.full_name : 'Unassigned'}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </>
      )}

      <Legend editable />

      {createOpen && <WorkOrderFormModal onClose={() => setCreateOpen(false)} onSaved={handleSaved} />}
    </div>
  );
}

function Legend({ editable = false }: { editable?: boolean }) {
  return (
    <div className="mt-4 flex items-center gap-4 flex-wrap text-xs text-ink-600">
      <span className="font-semibold text-ink-700">Service types:</span>
      {(['CCTV', 'Access Control', 'Fire Alarm', 'Fire Water', 'BMS', 'Electronic Security'] as const).map((s) => (
        <span key={s} className="flex items-center gap-1.5"><span className={cn('h-3 w-3 rounded', serviceBg(s))} />{s}</span>
      ))}
      {editable && <span className="ml-auto text-ink-400">Tip: click a job to reassign, reschedule, or change its status.</span>}
    </div>
  );
}

function serviceBg(t: string): string {
  switch (t) {
    case 'CCTV': return 'bg-primary-600';
    case 'Access Control': return 'bg-cyan-600';
    case 'Fire Alarm': return 'bg-red-600';
    case 'Fire Water': return 'bg-orange-600';
    case 'BMS': return 'bg-violet-600';
    case 'Electronic Security': return 'bg-emerald-600';
  }
  return 'bg-ink-500';
}