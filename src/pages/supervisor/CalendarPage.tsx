import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Filter, Lock } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, Badge, Avatar } from '@/components/ui';
import { cn } from '@/lib/utils';
import { priorityColor } from '@/data/mockData';
import { supabase } from '@/lib/supabase';
import { WorkOrderFormModal } from '@/components/WorkOrderFormModal';

const HOURS = ['08', '09', '10', '11', '12', '13', '14', '15', '16', '17'];
const DAYS = ['Mon Aug 4', 'Tue Aug 5', 'Wed Aug 6', 'Thu Aug 7', 'Fri Aug 8'];

const dateMap: Record<string, string> = {
  'Mon Aug 4': '2026-08-04', 'Tue Aug 5': '2026-08-05', 'Wed Aug 6': '2026-08-06',
  'Thu Aug 7': '2026-08-07', 'Fri Aug 8': '2026-08-08',
};

export function CalendarPage({
  onSelect,
  role = 'technician',
}: {
  onSelect: (w: any) => void;
  role?: 'admin' | 'supervisor' | 'technician';
}) {
  const canEdit = role === 'admin' || role === 'supervisor';
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const hourHeight = 56;

  const fetchData = async () => {
    setLoading(true);
    const [ordersRes, techRes] = await Promise.all([
      supabase.from('work_orders').select('*').order('scheduled_date'),
      supabase.from('profiles').select('id, full_name, title, initials, avatar_color').eq('role', 'technician').order('full_name'),
    ]);
    if (ordersRes.data) setOrders(ordersRes.data);
    if (techRes.data) setTechnicians(techRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleDrop = async (techId: string, date: string, hour: string) => {
    if (!draggedId || !canEdit) return;
    const id = draggedId;
    setDraggedId(null);
    // Optimistic update
    setOrders((prev) => prev.map((w) =>
      w.id === id ? { ...w, technician_id: techId, scheduled_date: date, scheduled_time: `${hour}:00`, status: w.status === 'open' ? 'scheduled' : w.status } : w,
    ));
    const target = orders.find((w) => w.id === id);
    await supabase.from('work_orders').update({
      technician_id: techId,
      scheduled_date: date,
      scheduled_time: `${hour}:00`,
      status: target?.status === 'open' ? 'scheduled' : target?.status,
    }).eq('id', id);
  };

  const handleSaved = () => { setCreateOpen(false); fetchData(); };

  return (
    <div>
      <PageHeader
        title="Weekly Calendar"
        subtitle={canEdit ? 'Aug 4 – Aug 8, 2026 · drag work orders to assign & reschedule' : 'Aug 4 – Aug 8, 2026 · view only'}
        breadcrumbs={['Home', canEdit ? (role === 'admin' ? 'Administrator' : 'Supervisor') : 'Technician', 'Calendar']}
        actions={
          <>
            <div className="flex items-center bg-white border border-ink-200 rounded-lg">
              <button className="h-9 w-9 flex items-center justify-center text-ink-500 hover:bg-ink-50 rounded-l-lg"><ChevronLeft size={16} /></button>
              <span className="px-3 text-sm font-semibold text-ink-800">This week</span>
              <button className="h-9 w-9 flex items-center justify-center text-ink-500 hover:bg-ink-50 rounded-r-lg"><ChevronRight size={16} /></button>
            </div>
            <button className="btn-secondary"><Filter size={15} /> Filter</button>
            {canEdit && <button className="btn-primary" onClick={() => setCreateOpen(true)}><Plus size={15} /> New Job</button>}
          </>
        }
      />

      {!canEdit && (
        <div className="mb-4 flex items-center gap-2 text-xs text-ink-500 bg-ink-50 border border-ink-200 rounded-lg px-3 py-2">
          <Lock size={13} /> You're viewing the calendar in read-only mode. Only admins and supervisors can reassign or reschedule jobs.
        </div>
      )}

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-ink-500">Loading calendar…</div></Card>
      ) : (
      <Card pad={false} className="overflow-hidden">
        {/* Header row */}
        <div className="grid border-b border-ink-100 bg-ink-50/40" style={{ gridTemplateColumns: '180px repeat(5, 1fr)' }}>
          <div className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-ink-500 border-r border-ink-100">Technician</div>
          {DAYS.map((d) => (
            <div key={d} className="px-4 py-3 text-center border-r border-ink-100 last:border-r-0">
              <div className="text-xs font-medium text-ink-500">{d.split(' ')[0]}</div>
              <div className="text-sm font-bold text-ink-900">{d.split(' ')[1]} {d.split(' ')[2]}</div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            {technicians.slice(0, 6).map((tech) => (
              <div key={tech.id} className="grid border-b border-ink-50 last:border-b-0" style={{ gridTemplateColumns: '180px repeat(5, 1fr)' }}>
                {/* Technician column */}
                <div className="px-4 py-3 border-r border-ink-100 flex items-center gap-2.5 sticky left-0 bg-white z-10">
                  <Avatar initials={tech.initials} color={tech.avatar_color} size="sm" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink-900 truncate">{tech.full_name}</div>
                    <div className="text-[11px] text-ink-500 truncate">{tech.title?.split('—')[0]}</div>
                  </div>
                </div>

                {/* Day cells */}
                {DAYS.map((d) => {
                  const date = dateMap[d];
                  const dayOrders = orders.filter((w) => w.technician_id === tech.id && w.scheduled_date === date);
                  return (
                    <div
                      key={d}
                      className="border-r border-ink-100 last:border-r-0 relative"
                      onDragOver={(e) => canEdit && e.preventDefault()}
                      onDrop={() => handleDrop(tech.id, date, '09')}
                    >
                      {/* hour grid */}
                      <div className="relative" style={{ height: hourHeight * HOURS.length }}>
                        {HOURS.map((h) => (
                          <div key={h} className="border-b border-ink-50 flex" style={{ height: hourHeight }}>
                            <span className="text-[9px] text-ink-300 pl-1 pt-0.5 w-7 shrink-0">{h}</span>
                          </div>
                        ))}
                        {/* events */}
                        {dayOrders.map((w) => {
                          const hourIdx = HOURS.indexOf((w.scheduled_time ?? '09:00').split(':')[0]);
                          if (hourIdx < 0) return null;
                          const top = hourIdx * hourHeight;
                          const height = (w.duration_hrs ?? 1) * hourHeight - 4;
                          return (
                            <button
                              key={w.id}
                              draggable={canEdit}
                              onDragStart={() => canEdit && setDraggedId(w.id)}
                              onClick={(e) => { e.stopPropagation(); onSelect(w); }}
                              className={cn(
                                'absolute left-9 right-1 rounded-md px-2 py-1 text-left text-white text-xs shadow-sm hover:shadow-md hover:opacity-90 transition overflow-hidden',
                                canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                                serviceBg(w.service_type),
                              )}
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
            ))}
            {technicians.length === 0 && (
              <div className="text-center text-sm text-ink-400 py-10">No technicians found.</div>
            )}
          </div>
        </div>
      </Card>
      )}

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 flex-wrap text-xs text-ink-600">
        <span className="font-semibold text-ink-700">Service types:</span>
        {(['CCTV', 'Access Control', 'Fire Alarm', 'Fire Water', 'BMS', 'Electronic Security'] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5"><span className={cn('h-3 w-3 rounded', serviceBg(s))} />{s}</span>
        ))}
        {canEdit && <span className="ml-auto text-ink-400">Tip: drag a job onto a technician's day to reassign & reschedule.</span>}
      </div>

      {createOpen && <WorkOrderFormModal onClose={() => setCreateOpen(false)} onSaved={handleSaved} />}
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
