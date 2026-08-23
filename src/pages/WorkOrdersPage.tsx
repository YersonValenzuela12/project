import { useState, useEffect } from 'react';
import {
  Search, Filter, FilePlus2, MapPin, Clock, ChevronRight, Users as UsersIcon,
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
  role?: 'admin' | 'supervisor' | 'technician';
}) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [view, setView] = useState<View>('table');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const canManage = role === 'admin' || role === 'supervisor';

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('work_orders')
      .select(`
        *,
        technician:profiles!work_orders_technician_id_fkey(full_name, initials, avatar_color),
        work_order_assignees(user_id, role_on_order, profiles(full_name, initials, avatar_color))
      `)
      .order('scheduled_date', { ascending: true });
    if (!error && data) setRows(data);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleSaved = () => { setCreateOpen(false); fetchOrders(); };

  const filtered = rows.filter((w) =>
    (status === 'all' || w.status === status) &&
    (w.client.toLowerCase().includes(q.toLowerCase()) || w.code.toLowerCase().includes(q.toLowerCase()) || w.service_type.toLowerCase().includes(q.toLowerCase())),
  );

  const columns: { key: WOStatus; label: string; color: string }[] = [
    { key: 'open', label: 'Open', color: 'border-t-ink-300' },
    { key: 'scheduled', label: 'Scheduled', color: 'border-t-primary-400' },
    { key: 'in_progress', label: 'In Progress', color: 'border-t-blue-400' },
    { key: 'paused', label: 'Paused', color: 'border-t-amber-400' },
    { key: 'completed', label: 'Completed', color: 'border-t-emerald-400' },
  ];

  const extraAssignees = (w: any) => (w.work_order_assignees ?? []).filter((a: any) => a.user_id !== w.technician_id);

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={`${filtered.length} work orders · updated just now`}
        breadcrumbs={breadcrumbs}
        actions={canManage ? <button className="btn-primary" onClick={() => setCreateOpen(true)}><FilePlus2 size={15} /> Create Work Order</button> : undefined}
      />

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
                    <tr key={w.id} className="hover:bg-ink-50/40 cursor-pointer" onClick={() => onSelect(w)}>
                      <td className="td"><div className="font-mono text-xs text-primary-700 font-semibold">{w.code}</div><div className="text-xs text-ink-400 mt-0.5 max-w-[260px] truncate">{w.description}</div></td>
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
              {columns.map((col) => {
                const items = filtered.filter((w) => w.status === col.key);
                return (
                  <div key={col.key} className="flex-1 min-w-[200px]">
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
                          <div key={w.id} onClick={() => onSelect(w)} className="card-pad cursor-pointer hover:shadow-card-md hover:border-primary-200 transition-all p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-mono text-[11px] font-semibold text-primary-700">{w.code}</span>
                              <Badge className={priorityColor(w.priority)}>{w.priority}</Badge>
                            </div>
                            <div className="text-sm font-medium text-ink-900 truncate">{w.client}</div>
                            <div className="text-xs text-ink-500 flex items-center gap-1 mt-1"><MapPin size={10} /> {w.site}</div>
                            <div className="mt-2.5 flex items-center justify-between">
                              <Badge className={serviceColor(w.service_type)}>{w.service_type}</Badge>
                              {tech ? <Avatar initials={tech.initials} color={tech.avatar_color} size="xs" /> : <span className="text-[10px] text-ink-400">Unassigned</span>}
                            </div>
                            {w.progress > 0 && <div className="mt-2"><ProgressBar value={w.progress} barClass={w.progress === 100 ? 'bg-emerald-500' : 'bg-primary-600'} /></div>}
                          </div>
                        );
                      })}
                      {items.length === 0 && <div className="text-center text-xs text-ink-300 py-8">No items</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {createOpen && <WorkOrderFormModal onClose={() => setCreateOpen(false)} onSaved={handleSaved} />}
    </div>
  );
}
