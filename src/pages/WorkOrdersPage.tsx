import { useState, useEffect } from 'react';
import {
  Search, Filter, FilePlus2, MapPin, Clock, ChevronRight, Users as UsersIcon, Wrench, Navigation, Check,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, Avatar, Badge, ProgressBar } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  type WOStatus, statusColor, statusLabel, priorityColor, serviceColor,
} from '@/data/mockData';
import { supabase } from '@/lib/supabase';
import { WorkOrderFormModal } from '@/components/WorkOrderFormModal';

type View = 'table' | 'kanban';
type DateFilter = 'today' | 'tomorrow' | 'week' | 'all';

const COLUMNS: { key: WOStatus; label: string; color: string }[] = [
  { key: 'open', label: 'Open', color: 'border-t-ink-300' },
  { key: 'scheduled', label: 'Scheduled', color: 'border-t-primary-400' },
  { key: 'in_progress', label: 'In Progress', color: 'border-t-blue-400' },
  { key: 'paused', label: 'Paused', color: 'border-t-amber-400' },
  { key: 'completed', label: 'Completed', color: 'border-t-emerald-400' },
];

const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'week', label: 'This week' },
  { key: 'all', label: 'All' },
];

function isoToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString().slice(0, 10); }
function isoTomorrow() { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }
function weekRange() {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d); monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  return { mondayIso: monday.toISOString().slice(0, 10), sundayIso: sunday.toISOString().slice(0, 10) };
}

function mapsUrl(w: any) {
  const parts = [w.address, w.site, w.client].filter(Boolean).join(' ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts)}`;
}

export function WorkOrdersPage({
  title = 'Work Orders',
  breadcrumbs,
  onSelect,
  showAssign = true,
  role = 'technician',
}: {
  title?: string;
  breadcrumbs: string[];
  onSelect: (w: any) => void;
  showAssign?: boolean;
  role?: 'admin' | 'supervisor' | 'technician'| 'coordinador';
}) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [view, setView] = useState<View>('table');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const canManage = role === 'admin' || role === 'supervisor';
  const isTechView = role === 'technician';

  const fetchOrders = async () => {
    setLoading(true);
    const { data: orders, error: ordersError } = await supabase
      .from('work_orders')
      .select('*')
      .order('scheduled_date', { ascending: true });

    if (ordersError || !orders) { setLoading(false); return; }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, initials, avatar_color');
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    const orderIds = orders.map((o: any) => o.id);
    const { data: assignees } = orderIds.length > 0
      ? await supabase.from('work_order_assignees').select('work_order_id, user_id, role_on_order').in('work_order_id', orderIds)
      : { data: [] as any[] };

    const merged = orders.map((o: any) => ({
      ...o,
      technician: o.technician_id ? profileMap.get(o.technician_id) : null,
      work_order_assignees: (assignees ?? [])
        .filter((a: any) => a.work_order_id === o.id)
        .map((a: any) => ({ ...a, profiles: profileMap.get(a.user_id) })),
    }));

    setRows(merged);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleSaved = () => { setCreateOpen(false); setEditingOrder(null); fetchOrders(); };

  const handleRowClick = (w: any) => {
    onSelect(w);
    if (canManage) setEditingOrder(w);
  };

  const handleStatusDrop = async (targetStatus: WOStatus) => {
    if (!draggedId || !canManage) { setDraggedId(null); return; }
    const id = draggedId;
    setDraggedId(null);
    setRows((prev) => prev.map((w) => (w.id === id ? { ...w, status: targetStatus, progress: targetStatus === 'completed' ? 100 : w.progress } : w)));
    await supabase.from('work_orders').update({
      status: targetStatus,
      ...(targetStatus === 'completed' ? { progress: 100 } : {}),
    }).eq('id', id);
  };

  const inDateFilter = (w: any) => {
    if (!isTechView || dateFilter === 'all') return true;
    if (!w.scheduled_date) return false;
    if (dateFilter === 'today') return w.scheduled_date === isoToday();
    if (dateFilter === 'tomorrow') return w.scheduled_date === isoTomorrow();
    const { mondayIso, sundayIso } = weekRange();
    return w.scheduled_date >= mondayIso && w.scheduled_date <= sundayIso;
  };

  const filtered = rows.filter((w) =>
    inDateFilter(w) &&
    (isTechView || status === 'all' || w.status === status) &&
    (w.client.toLowerCase().includes(q.toLowerCase()) || w.code.toLowerCase().includes(q.toLowerCase()) || w.service_type.toLowerCase().includes(q.toLowerCase())),
  );

  const extraAssignees = (w: any) => (w.work_order_assignees ?? []).filter((a: any) => a.user_id !== w.technician_id);

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={`${filtered.length} work orders · updated just now`}
        breadcrumbs={breadcrumbs}
        actions={canManage ? <button className="btn-primary" onClick={() => setCreateOpen(true)}><FilePlus2 size={15} /> Create Work Order</button> : undefined}
      />

      {isTechView ? (
        <>
          <div className="flex gap-1.5 mb-3">
            {DATE_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setDateFilter(f.key)}
                className={cn(
                  'flex-1 rounded-lg px-2 py-2 text-xs font-semibold border transition',
                  dateFilter === f.key ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-ink-200 text-ink-600 hover:bg-ink-50',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by client or code…" className="input pl-9 h-10" />
          </div>

          {loading ? (
            <Card><div className="p-8 text-center text-sm text-ink-500">Loading work orders…</div></Card>
          ) : filtered.length === 0 ? (
            <Card><div className="p-8 text-center text-sm text-ink-500">No work orders for this filter.</div></Card>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((w) => {
                const isDone = w.status === 'completed';
                return (
                  <div
                    key={w.id}
                    onClick={() => onSelect(w)}
                    className={cn('bg-white border border-ink-100 rounded-xl p-4 cursor-pointer hover:border-primary-300 transition', isDone && 'opacity-70')}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-mono text-xs font-semibold text-primary-700">{w.code}</span>
                      <Badge className={cn('ml-auto capitalize', priorityColor(w.priority))}>{w.priority}</Badge>
                    </div>
                    <div className="text-[15px] font-semibold text-ink-900">{w.client}</div>
                    <div className="text-xs text-ink-500 flex items-center gap-1 mt-0.5"><MapPin size={11} /> {w.site}</div>
                    <div className="text-sm text-ink-600 flex items-center gap-1.5 mt-2">
                      <Clock size={13} className="text-ink-400" />{w.scheduled_time} · {w.service_type}
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      {isDone ? (
                        <Badge className="bg-ink-100 text-ink-500"><Check size={11} className="inline mr-1" />Completed</Badge>
                      ) : (
                        <Badge className={statusColor(w.status)}>{statusLabel(w.status)}</Badge>
                      )}
                      {!isDone && (
                        <a
                          href={mapsUrl(w)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="ml-auto btn-secondary h-8 text-xs"
                        >
                          <Navigation size={13} /> Directions
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <Card pad={false} className="overflow-hidden">
          <div className="p-4 border-b border-ink-100 flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search work orders…" className="input pl-9 h-9" />
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="input h-9 w-auto">
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
            <button className="btn-secondary h-9"><Filter size={14} /> Filters</button>
            <div className="flex bg-ink-50 rounded-lg p-1">
              <button onClick={() => setView('table')} className={cn('px-3 py-1.5 rounded-md text-xs font-semibold', view === 'table' ? 'bg-white shadow-sm text-ink-900' : 'text-ink-500')}>Table</button>
              <button onClick={() => setView('kanban')} className={cn('px-3 py-1.5 rounded-md text-xs font-semibold', view === 'kanban' ? 'bg-white shadow-sm text-ink-900' : 'text-ink-500')}>Kanban</button>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-ink-500">Loading work orders…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-ink-500">No work orders yet.</div>
          ) : view === 'table' ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px]">
                <thead className="bg-ink-50/50 border-b border-ink-100">
                  <tr>
                    <th className="th">Work order</th><th className="th">Client / Site</th><th className="th">Service</th>
                    <th className="th">Priority</th><th className="th">Status</th>
                    {showAssign && <th className="th">Assigned</th>}
                    <th className="th">Scheduled</th><th className="th">Progress</th><th className="th w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50">
                  {filtered.map((w) => {
                    const tech = w.technician;
                    const extras = extraAssignees(w);
                    return (
                      <tr key={w.id} className="hover:bg-ink-50/40 cursor-pointer" onClick={() => handleRowClick(w)}>
                        <td className="td">
                          <div className="font-mono text-xs text-primary-700 font-semibold">{w.code}</div>
                          <div className="text-xs text-ink-400 mt-0.5 max-w-[260px] truncate">{w.description}</div>
                          {w.equipment && <div className="text-[11px] text-ink-500 mt-0.5 flex items-center gap-1"><Wrench size={10} /> {w.equipment}</div>}
                        </td>
                        <td className="td"><div className="font-medium text-ink-900">{w.client}</div><div className="text-xs text-ink-500 flex items-center gap-1 mt-0.5"><MapPin size={11} /> {w.site}</div></td>
                        <td className="td"><Badge className={serviceColor(w.service_type)}>{w.service_type}</Badge></td>
                        <td className="td"><Badge className={`${priorityColor(w.priority)} capitalize`}>{w.priority}</Badge></td>
                        <td className="td"><Badge className={statusColor(w.status)}>{statusLabel(w.status)}</Badge></td>
                        {showAssign && (
                          <td className="td">
                            {tech ? (
                              <div className="flex items-center gap-1.5">
                                <Avatar initials={tech.initials} color={tech.avatar_color} size="xs" />
                                <span className="text-sm text-ink-700">{tech.full_name.split(' ').map((p: string) => p[0]).join('. ')}</span>
                                {extras.length > 0 && <span className="chip bg-ink-100 text-ink-500 ml-1"><UsersIcon size={10} /> +{extras.length}</span>}
                              </div>
                            ) : (
                              <span className="text-xs text-ink-400 italic">Unassigned</span>
                            )}
                          </td>
                        )}
                        <td className="td text-ink-600"><div className="flex items-center gap-1.5 text-sm"><Clock size={12} className="text-ink-400" />{w.scheduled_time}</div><div className="text-xs text-ink-400">{w.scheduled_date}</div></td>
                        <td className="td w-32"><ProgressBar value={w.progress} barClass={w.progress === 100 ? 'bg-emerald-500' : 'bg-primary-600'} /><span className="text-xs text-ink-500 mt-1 block">{w.progress}%</span></td>
                        <td className="td"><ChevronRight size={16} className="text-ink-300" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 overflow-x-auto">
              <div className="flex gap-3 min-w-[1000px]">
                {COLUMNS.map((col) => {
                  const items = filtered.filter((w) => w.status === col.key);
                  return (
                    <div
                      key={col.key}
                      className="flex-1 min-w-[200px]"
                      onDragOver={(e) => canManage && e.preventDefault()}
                      onDrop={() => handleStatusDrop(col.key)}
                    >
                      <div className={cn('rounded-t-lg bg-ink-50/70 px-3 py-2 border-t-2', col.color)}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-ink-800">{col.label}</span>
                          <span className="chip bg-white text-ink-500">{items.length}</span>
                        </div>
                      </div>
                      <div className="space-y-2 pt-2 min-h-[120px]">
                        {items.map((w) => {
                          const tech = w.technician;
                          return (
                            <div
                              key={w.id}
                              draggable={canManage}
                              onDragStart={() => canManage && setDraggedId(w.id)}
                              onClick={() => handleRowClick(w)}
                              className={cn('card-pad transition-all p-3', canManage ? 'cursor-grab active:cursor-grabbing hover:shadow-card-md hover:border-primary-200' : 'cursor-pointer')}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-mono text-[11px] font-semibold text-primary-700">{w.code}</span>
                                <Badge className={priorityColor(w.priority)}>{w.priority}</Badge>
                              </div>
                              <div className="text-sm font-medium text-ink-900 truncate">{w.client}</div>
                              <div className="text-xs text-ink-500 flex items-center gap-1 mt-1"><MapPin size={10} /> {w.site}</div>
                              {w.equipment && <div className="text-[10px] text-ink-400 flex items-center gap-1 mt-1"><Wrench size={9} /> {w.equipment}</div>}
                              <div className="mt-2.5 flex items-center justify-between">
                                <Badge className={serviceColor(w.service_type)}>{w.service_type}</Badge>
                                {tech ? <Avatar initials={tech.initials} color={tech.avatar_color} size="xs" /> : <span className="text-[10px] text-ink-400">Unassigned</span>}
                              </div>
                              {w.progress > 0 && <div className="mt-2"><ProgressBar value={w.progress} barClass={w.progress === 100 ? 'bg-emerald-500' : 'bg-primary-600'} /></div>}
                            </div>
                          );
                        })}
                        {items.length === 0 && <div className="text-center text-xs text-ink-300 py-8">No items{canManage ? ' — drop here' : ''}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {canManage && <p className="text-xs text-ink-400 mt-3 px-1">Tip: drag a card to another column to change its status.</p>}
            </div>
          )}
        </Card>
      )}

      {createOpen && <WorkOrderFormModal onClose={() => setCreateOpen(false)} onSaved={handleSaved} />}
      {editingOrder && <WorkOrderFormModal order={editingOrder} onClose={() => setEditingOrder(null)} onSaved={handleSaved} />}
    </div>
  );
}
