import { useState, useEffect } from 'react';
import { Modal, Avatar, Badge } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/activityLog';

interface PersonOption {
  id: string;
  full_name: string;
  role: string;
  initials: string;
  avatar_color: string;
}

const SERVICE_TYPES = ['CCTV', 'Access Control', 'Fire Alarm', 'Fire Water', 'BMS', 'Electronic Security'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const STATUSES = ['open', 'scheduled', 'in_progress', 'paused', 'completed'];

export function WorkOrderFormModal({
  order = null,
  onClose,
  onSaved,
}: {
  order?: any | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!order;
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [client, setClient] = useState(order?.client ?? '');
  const [site, setSite] = useState(order?.site ?? '');
  const [address, setAddress] = useState(order?.address ?? '');
  const [serviceType, setServiceType] = useState(order?.service_type ?? SERVICE_TYPES[0]);
  const [priority, setPriority] = useState(order?.priority ?? 'medium');
  const [status, setStatus] = useState(order?.status ?? 'open');
  const [progress, setProgress] = useState(order?.progress ?? 0);
  const [scheduledDate, setScheduledDate] = useState(order?.scheduled_date ?? '');
  const [scheduledTime, setScheduledTime] = useState(order?.scheduled_time ?? '09:00');
  const [durationHrs, setDurationHrs] = useState(order?.duration_hrs ?? 2);
  const [description, setDescription] = useState(order?.description ?? '');
  const [equipment, setEquipment] = useState(order?.equipment ?? '');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role, initials, avatar_color')
        .in('role', ['technician', 'supervisor'])
        .order('full_name');
      if (data) setPeople(data as PersonOption[]);

      if (isEdit) {
        const preselected = new Set<string>();
        if (order.technician_id) preselected.add(order.technician_id);
        const { data: existing } = await supabase
          .from('work_order_assignees')
          .select('user_id')
          .eq('work_order_id', order.id);
        (existing ?? []).forEach((r: any) => preselected.add(r.user_id));
        setSelectedIds([...preselected]);
      }
    })();
  }, []);

  const toggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const genCode = () => `WO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const submit = async () => {
    setError(null);
    if (!client || !site || !scheduledDate) { setError('Client, site, and scheduled date are required.'); return; }
    setSaving(true);

  const { data: { user: currentUser } } = await supabase.auth.getUser();
    let actorName = 'Usuario';
    if (currentUser) {
  const { data: currentProfile } = await supabase.from('profiles').select('full_name').eq('id', currentUser.id).single();
      actorName = currentProfile?.full_name ?? currentUser.email ?? 'Usuario';
    }

    const primaryTechnician = people.find((p) => selectedIds.includes(p.id) && p.role === 'technician');

    const payload = {
      client,
      site,
      address,
      service_type: serviceType,
      priority,
      status,
      progress,
      technician_id: primaryTechnician?.id ?? null,
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime,
      duration_hrs: durationHrs,
      description,
      equipment,
    };

    let orderId = order?.id;

    if (isEdit) {
      const { error: updateError } = await supabase.from('work_orders').update(payload).eq('id', orderId);
      if (updateError) { setSaving(false); setError(updateError.message); return; }
    } else {
      const { data: created, error: insertError } = await supabase
        .from('work_orders')
        .insert({ ...payload, code: genCode() })
        .select()
        .single();
      if (insertError || !created) { setSaving(false); setError(insertError?.message || 'Unable to create work order.'); return; }
      orderId = created.id;
    }

    // Reconcile assignees: clear and re-insert (simplest, avoids diffing)
    await supabase.from('work_order_assignees').delete().eq('work_order_id', orderId);
    if (selectedIds.length > 0) {
      const rows = selectedIds.map((user_id) => ({
        work_order_id: orderId,
        user_id,
        role_on_order: people.find((p) => p.id === user_id)?.role === 'supervisor' ? 'supervisor' : 'technician',
      }));
      const { error: assignError } = await supabase.from('work_order_assignees').insert(rows);
      if (assignError) { setSaving(false); setError(`Saved, but assigning people failed: ${assignError.message}`); return; }

      // Notify each assigned person
      const { data: { user: caller } } = await supabase.auth.getUser();
      const notifRows = selectedIds.map((user_id) => ({
        user_id,
        type: 'work_order_assigned',
        title: isEdit ? `Work order updated: ${client}` : `New work order assigned: ${client}`,
        body: `${site} · ${scheduledDate} at ${scheduledTime}`,
        unread: true,
        actor_id: caller?.id ?? null,
        related_work_order_id: orderId,
      }));
      await supabase.from('notifications').insert(notifRows);
    }

    await logActivity({
      actorName,
      action: isEdit ? 'actualizó una orden de trabajo' : 'creó una orden de trabajo',
      target: 'work_order',
      detail: `${client} · ${site} · ${serviceType}`,
    });

    setSaving(false);
    onSaved();
  };

  return (
    <Modal
      open onClose={onClose}
      title={isEdit ? `Edit Work Order — ${order.code}` : 'Create Work Order'}
      size="lg"
      footer={<>
        <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create work order'}</button>
      </>}
    >
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3.5 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Client</label><input className="input" value={client} onChange={(e) => setClient(e.target.value)} placeholder="Harbor Gate Logistics" /></div>
        <div><label className="label">Site</label><input className="input" value={site} onChange={(e) => setSite(e.target.value)} placeholder="Warehouse 4 — Dock A" /></div>
        <div className="col-span-2"><label className="label">Address</label><input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="1820 Maritime Blvd, Oakland, CA" /></div>
        <div>
          <label className="label">Service type</label>
          <select className="input" value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
            {SERVICE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Priority</label>
          <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {isEdit && (
          <>
            <div>
              <label className="label">Status</label>
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Progress ({progress}%)</label>
              <input type="range" min={0} max={100} step={5} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="w-full mt-3" />
            </div>
          </>
        )}

        <div><label className="label">Scheduled date</label><input type="date" className="input" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} /></div>
        <div><label className="label">Scheduled time</label><input type="time" className="input" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} /></div>
        <div><label className="label">Duration (hrs)</label><input type="number" min={0.5} step={0.5} className="input" value={durationHrs} onChange={(e) => setDurationHrs(Number(e.target.value))} /></div>
        <div><label className="label">Equipment</label><input className="input" value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="Optional" /></div>
        <div className="col-span-2"><label className="label">Description</label><textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What needs to be done…" /></div>
      </div>

      <div className="mt-5">
        <label className="label">Assign technicians / supervisors</label>
        <div className="border border-ink-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-ink-50">
          {people.map((p) => (
            <label key={p.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-ink-50">
              <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4 rounded border-ink-300 text-primary-600 focus:ring-primary-500" />
              <Avatar initials={p.initials} color={p.avatar_color} size="xs" />
              <span className="text-sm text-ink-800 flex-1">{p.full_name}</span>
              <Badge className={p.role === 'supervisor' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}>{p.role}</Badge>
            </label>
          ))}
          {people.length === 0 && <div className="px-3 py-4 text-sm text-ink-400 text-center">No technicians or supervisors found.</div>}
        </div>
        <p className="text-xs text-ink-400 mt-1.5">The first selected technician becomes the primary assignee shown in lists and the calendar.</p>
      </div>
    </Modal>
  );
}
