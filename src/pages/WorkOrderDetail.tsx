import { useState } from 'react';
import {
  ArrowLeft, MapPin, Clock, User, Building2, Wrench, FileText, Camera, MessageSquare,
  Play, Pause, CheckCircle2, History, Package, ChevronRight, Star, Download, FileText as DocIcon, Maximize2, Navigation,
} from 'lucide-react';
import { Card, SectionHeader, Avatar, Badge, ProgressBar, Tabs } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  type WorkOrder, users, statusColor, statusLabel, priorityColor, serviceColor,
} from '@/data/mockData';

export function WorkOrderDetail({
  order, onBack, role,
}: { order: WorkOrder; onBack: () => void; role: 'supervisor' | 'technician' }) {
  const [tab, setTab] = useState('Overview');
  const [status, setStatus] = useState(order.status);
  const [checklist, setChecklist] = useState(order.checklist ?? []);
  const tech = users.find((u) => u.id === order.technicianId);
  const sup = users.find((u) => u.id === order.supervisorId);

  const toggleCheck = (id: string) => {
    setChecklist((c) => c.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
    const done = checklist.filter((i) => i.done).length;
    setStatus('in_progress');
    void done;
  };

  const doneCount = checklist.filter((i) => i.done).length;

  return (
    <div>
      {/* Back + header */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800 mb-4">
        <ArrowLeft size={16} /> Back to work orders
      </button>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="font-mono text-sm font-bold text-primary-700">{order.code}</span>
            <Badge className={statusColor(status)}>{statusLabel(status)}</Badge>
            <Badge className={`${priorityColor(order.priority)} capitalize`}>{order.priority}</Badge>
            <Badge className={serviceColor(order.serviceType)}>{order.serviceType}</Badge>
          </div>
          <h1 className="text-2xl font-bold text-ink-900 tracking-tight">{order.client}</h1>
          <p className="text-sm text-ink-500 mt-1">{order.site} · Scheduled {order.scheduledDate} at {order.scheduledTime}</p>
        </div>

        {/* Action buttons */}
        {role === 'technician' ? (
          <div className="flex items-center gap-2">
            {status === 'in_progress' ? (
              <button onClick={() => setStatus('paused')} className="btn-secondary"><Pause size={15} /> Pause</button>
            ) : status === 'paused' ? (
              <button onClick={() => setStatus('in_progress')} className="btn-secondary"><Play size={15} /> Resume</button>
            ) : (
              <button onClick={() => setStatus('in_progress')} className="btn-primary"><Play size={15} /> Start Job</button>
            )}
            <button onClick={() => setStatus('completed')} className="btn bg-emerald-600 text-white hover:bg-emerald-700"><CheckCircle2 size={15} /> Complete Job</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button className="btn-secondary"><User size={15} /> Reassign</button>
            <button className="btn-secondary"><Clock size={15} /> Reschedule</button>
            <button className="btn-primary"><CheckCircle2 size={15} /> Approve</button>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <Card className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-ink-800">Job progress</span>
          <span className="text-sm font-bold text-primary-700">{order.progress}%</span>
        </div>
        <ProgressBar value={order.progress} barClass="bg-primary-600" />
        <div className="flex items-center justify-between mt-3 text-xs text-ink-500">
          <span>Created {order.createdAt}</span>
          <span>{doneCount}/{checklist.length} checklist items</span>
        </div>
      </Card>

      <div className="px-1 mb-4"><Tabs tabs={['Overview', 'Checklist', 'Documents', 'Comments', 'History']} active={tab} onChange={setTab} /></div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {tab === 'Overview' && <OverviewTab order={order} tech={tech} sup={sup} />}
          {tab === 'Checklist' && <ChecklistTab checklist={checklist} onToggle={toggleCheck} role={role} />}
          {tab === 'Documents' && <DocumentsTab />}
          {tab === 'Comments' && <CommentsTab order={order} />}
          {tab === 'History' && <HistoryTab order={order} />}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <Card>
            <SectionHeader title="Client Information" />
            <InfoRow icon={Building2} label="Client" value={order.client} />
            <InfoRow icon={MapPin} label="Site" value={order.site} />
            <InfoRow icon={MapPin} label="Address" value={order.address} />
            <InfoRow icon={Navigation} label="GPS" value="37.8044° N, 122.2712° W" />
          </Card>

          {/* Map preview */}
          <Card pad={false} className="overflow-hidden">
            <div className="relative h-44 bg-ink-100">
              <img
                src="https://images.pexels.com/photos/2090642/pexels-photo-2090642.jpeg?auto=compress&cs=tinysrgb&w=700"
                alt="Site location map" className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-ink-900/20" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <span className="relative flex">
                  <span className="absolute h-6 w-6 rounded-full bg-primary-500/40 animate-ping" />
                  <span className="relative h-6 w-6 rounded-full bg-primary-600 ring-4 ring-white flex items-center justify-center"><MapPin size={13} className="text-white" /></span>
                </span>
              </div>
              <button className="absolute bottom-2 right-2 h-8 w-8 rounded-lg bg-white/90 backdrop-blur flex items-center justify-center text-ink-600 hover:bg-white shadow-sm"><Maximize2 size={14} /></button>
            </div>
            <div className="p-3 flex items-center justify-between">
              <span className="text-xs text-ink-500">1.2 km from current location</span>
              <button className="text-xs font-semibold text-primary-600">Open in Maps</button>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Assignment" />
            {tech ? (
              <div className="flex items-center gap-3 mb-3">
                <Avatar initials={tech.initials} color={tech.avatarColor} size="md" />
                <div><div className="text-sm font-semibold text-ink-900">{tech.name}</div><div className="text-xs text-ink-500">{tech.title}</div></div>
              </div>
            ) : <p className="text-sm text-ink-400 italic mb-3">Unassigned</p>}
            {sup && (
              <div className="pt-3 border-t border-ink-50 flex items-center gap-3">
                <Avatar initials={sup.initials} color={sup.avatarColor} size="sm" />
                <div><div className="text-sm font-medium text-ink-800">{sup.name}</div><div className="text-xs text-ink-500">Supervisor</div></div>
              </div>
            )}
          </Card>

          <Card>
            <SectionHeader title="Equipment" />
            <div className="flex items-start gap-2.5"><Wrench size={15} className="text-ink-400 mt-0.5 shrink-0" /><p className="text-sm text-ink-700">{order.equipment}</p></div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ order, tech, sup }: { order: WorkOrder; tech?: typeof users[number]; sup?: typeof users[number] }) {
  return (
    <>
      <Card>
        <SectionHeader title="Description" />
        <p className="text-sm text-ink-700 leading-relaxed">{order.description}</p>
        <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-ink-50">
          <div><div className="text-xs text-ink-400 uppercase font-semibold">Service type</div><div className="text-sm font-medium text-ink-900 mt-1">{order.serviceType}</div></div>
          <div><div className="text-xs text-ink-400 uppercase font-semibold">Duration</div><div className="text-sm font-medium text-ink-900 mt-1">{order.durationHrs} hours</div></div>
          <div><div className="text-xs text-ink-400 uppercase font-semibold">Priority</div><div className="text-sm font-medium text-ink-900 mt-1 capitalize">{order.priority}</div></div>
        </div>
      </Card>

      {order.materials && (
        <Card>
          <SectionHeader title="Materials Required" action={<Package size={16} className="text-ink-400" />} />
          <table className="w-full">
            <thead><tr><th className="th pl-0">Item</th><th className="th">SKU</th><th className="th">Qty</th></tr></thead>
            <tbody className="divide-y divide-ink-50">
              {order.materials.map((m) => (
                <tr key={m.id}>
                  <td className="td pl-0 font-medium text-ink-800">{m.name}</td>
                  <td className="td font-mono text-xs text-ink-500">{m.sku}</td>
                  <td className="td text-ink-700">{m.qty} {m.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

function ChecklistTab({ checklist, onToggle, role }: { checklist: { id: string; label: string; done: boolean }[]; onToggle: (id: string) => void; role: string }) {
  const done = checklist.filter((i) => i.done).length;
  const canEdit = role === 'technician';
  return (
    <Card>
      <SectionHeader title="Job Checklist" subtitle={`${done} of ${checklist.length} completed`} action={<Badge className="bg-primary-50 text-primary-700">{Math.round((done / checklist.length) * 100)}%</Badge>} />
      <div className="space-y-1">
        {checklist.map((item) => (
          <label key={item.id} className={cn('flex items-center gap-3 p-3 rounded-lg cursor-pointer transition', item.done ? 'bg-emerald-50/50' : 'hover:bg-ink-50', !canEdit && 'cursor-default')}>
            <button
              onClick={() => canEdit && onToggle(item.id)}
              disabled={!canEdit}
              className={cn('h-5 w-5 rounded-md border flex items-center justify-center transition shrink-0', item.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-ink-300', canEdit && !item.done && 'hover:border-primary-400')}
            >
              {item.done && <CheckCircle2 size={13} strokeWidth={3} />}
            </button>
            <span className={cn('text-sm flex-1', item.done ? 'text-ink-500 line-through' : 'text-ink-800')}>{item.label}</span>
          </label>
        ))}
      </div>

      {canEdit && (
        <>
          <div className="mt-5 pt-4 border-t border-ink-50">
            <div className="text-sm font-semibold text-ink-800 mb-3">Photo Evidence</div>
            <div className="grid grid-cols-2 gap-3">
              <PhotoSlot label="Before" />
              <PhotoSlot label="After" />
            </div>
          </div>
          <button className="btn-secondary w-full mt-4"><Camera size={15} /> Upload Photo</button>
        </>
      )}
    </Card>
  );
}

function PhotoSlot({ label }: { label: string }) {
  return (
    <div className="aspect-video rounded-lg border-2 border-dashed border-ink-200 bg-ink-50/50 flex flex-col items-center justify-center text-ink-400">
      <Camera size={22} />
      <span className="text-xs mt-1.5 font-medium">{label} photo</span>
    </div>
  );
}

function DocumentsTab() {
  const docs = [
    { name: 'Camera Installation Manual.pdf', size: '4.2 MB', type: 'Manual' },
    { name: 'Site As-Built Drawings.pdf', size: '12.4 MB', type: 'Drawing' },
    { name: 'Safety Data Sheet.pdf', size: '820 KB', type: 'Safety' },
    { name: 'Previous Inspection Report.pdf', size: '1.1 MB', type: 'Report' },
  ];
  return (
    <Card>
      <SectionHeader title="Documents & Manuals" subtitle="Attached to this work order" action={<button className="btn-secondary h-8 text-xs"><FileText size={13} /> Upload</button>} />
      <div className="space-y-1">
        {docs.map((d) => (
          <div key={d.name} className="flex items-center gap-3 p-3 rounded-lg hover:bg-ink-50 border border-ink-100">
            <div className="h-9 w-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center"><DocIcon size={17} /></div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ink-900 truncate">{d.name}</div>
              <div className="text-xs text-ink-500">{d.type} · {d.size}</div>
            </div>
            <button className="h-8 w-8 rounded-md hover:bg-ink-100 flex items-center justify-center text-ink-500"><Download size={15} /></button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CommentsTab({ order }: { order: WorkOrder }) {
  const [text, setText] = useState('');
  const [comments, setComments] = useState(order.comments ?? []);
  const submit = () => {
    if (!text.trim()) return;
    setComments((c) => [...c, { id: `cm-${Date.now()}`, author: 'Daniel Okafor', initials: 'DO', avatarColor: 'bg-amber-600', time: 'now', text }]);
    setText('');
  };
  return (
    <Card>
      <SectionHeader title="Comments" subtitle={`${comments.length} messages`} action={<MessageSquare size={16} className="text-ink-400" />} />
      <div className="space-y-4 mb-4">
        {comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <Avatar initials={c.initials} color={c.avatarColor} size="sm" />
            <div className="flex-1">
              <div className="flex items-center gap-2"><span className="text-sm font-semibold text-ink-900">{c.author}</span><span className="text-xs text-ink-400">{c.time}</span></div>
              <p className="text-sm text-ink-700 mt-1 bg-ink-50 rounded-lg px-3 py-2">{c.text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2.5 items-start pt-3 border-t border-ink-50">
        <Avatar initials="DO" color="bg-amber-600" size="sm" />
        <div className="flex-1">
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a comment…" className="input min-h-[72px] resize-none" />
          <div className="flex justify-end mt-2"><button className="btn-primary" onClick={submit}>Post comment</button></div>
        </div>
      </div>
    </Card>
  );
}

function HistoryTab({ order }: { order: WorkOrder }) {
  const entries = order.history ?? [
    { id: 'h1', action: 'Work order created', actor: 'System', time: order.createdAt },
  ];
  return (
    <Card>
      <SectionHeader title="Work Order History" subtitle="Full audit trail" action={<History size={16} className="text-ink-400" />} />
      <div className="relative pl-6">
        <div className="absolute left-2 top-1 bottom-1 w-px bg-ink-200" />
        {entries.map((e) => (
          <div key={e.id} className="relative pb-5 last:pb-0">
            <span className="absolute -left-[18px] top-1 h-3 w-3 rounded-full bg-primary-600 ring-4 ring-white" />
            <div className="text-sm font-medium text-ink-900">{e.action}</div>
            <div className="text-xs text-ink-500 mt-0.5">{e.actor} · {e.time}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-ink-50 last:border-0">
      <Icon size={15} className="text-ink-400 mt-0.5 shrink-0" />
      <div className="min-w-0"><div className="text-xs text-ink-400 font-medium">{label}</div><div className="text-sm text-ink-800">{value}</div></div>
    </div>
  );
}

export const _star = Star; export const _chev = ChevronRight;
