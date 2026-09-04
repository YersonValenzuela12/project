import { useState, useEffect, useRef } from 'react';
import { Modal, Avatar, Badge } from '@/components/ui';
import { supabase } from '@/lib/supabase';

interface PersonOption {
  id: string;
  full_name: string;
  role: string;
  initials: string;
  avatar_color: string;
}

interface SiteOption {
  id: string;
  client: string;
  site_name: string;
  address: string | null;
  image_url: string | null;
}

const SERVICE_TYPES = ['CCTV', 'Access Control', 'Fire Alarm', 'Fire Water', 'BMS', 'Electronic Security'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const STATUSES = ['open', 'scheduled', 'in_progress', 'paused', 'completed'];

const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024; // 20 MB hard cap before we even try to compress
const COMPRESS_MAX_WIDTH = 1200;
const COMPRESS_QUALITY = 0.8;

async function compressImage(file: File): Promise<Blob> {
  const img = document.createElement('img');
  const objectUrl = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not read image.'));
      img.src = objectUrl;
    });
    const scale = Math.min(1, COMPRESS_MAX_WIDTH / img.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', COMPRESS_QUALITY));
    if (!blob) throw new Error('Could not compress image.');
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

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
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(order?.site_id ?? null);
  const [selectedSiteImage, setSelectedSiteImage] = useState<string | null>(null);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [siteQuery, setSiteQuery] = useState('');
  const [showAddSite, setShowAddSite] = useState(false);
  const [newClient, setNewClient] = useState('');
  const [newSiteName, setNewSiteName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newSiteImageFile, setNewSiteImageFile] = useState<File | null>(null);
  const [newSiteImagePreview, setNewSiteImagePreview] = useState<string | null>(null);
  const [savingSite, setSavingSite] = useState(false);
  const [uploadingExistingPhoto, setUploadingExistingPhoto] = useState(false);
  const newSiteImageInputRef = useRef<HTMLInputElement>(null);
  const existingSiteImageInputRef = useRef<HTMLInputElement>(null);
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

      const { data: siteRows } = await supabase
        .from('sites')
        .select('id, client, site_name, address, image_url')
        .order('client');
      if (siteRows) {
        setSites(siteRows as SiteOption[]);
        if (isEdit && order?.site_id) {
          const match = (siteRows as SiteOption[]).find((s) => s.id === order.site_id);
          if (match) setSelectedSiteImage(match.image_url ?? null);
        }
      }

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

  const pickSite = (s: SiteOption) => {
    setSelectedSiteId(s.id);
    setClient(s.client);
    setSite(s.site_name);
    setAddress(s.address ?? '');
    setSelectedSiteImage(s.image_url ?? null);
    setSiteQuery('');
  };

  const changeSite = () => {
    setSelectedSiteId(null);
    setClient('');
    setSite('');
    setAddress('');
    setSelectedSiteImage(null);
  };

  const handleNewSiteImagePick = (file: File | null) => {
    if (!file) { setNewSiteImageFile(null); setNewSiteImagePreview(null); return; }
    if (file.size > MAX_ORIGINAL_BYTES) { setError('Photo is too large (max 20 MB).'); return; }
    setError(null);
    setNewSiteImageFile(file);
    setNewSiteImagePreview(URL.createObjectURL(file));
  };

  const uploadSiteImage = async (file: File): Promise<string | null> => {
    try {
      const compressed = await compressImage(file);
      const path = `sites/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('Documents').upload(path, compressed, { contentType: 'image/jpeg' });
      if (uploadError) { setError(`Photo upload failed: ${uploadError.message}`); return null; }
      const { data } = supabase.storage.from('Documents').getPublicUrl(path);
      return data.publicUrl;
    } catch (e: any) {
      setError(`Photo upload failed: ${e.message ?? 'unknown error'}`);
      return null;
    }
  };

  const createSite = async () => {
    if (!newClient || !newSiteName) { setError('Client and site name are required to add a new site.'); return; }
    setError(null);
    setSavingSite(true);

    let imageUrl: string | null = null;
    if (newSiteImageFile) {
      imageUrl = await uploadSiteImage(newSiteImageFile);
      if (imageUrl === null && newSiteImageFile) { setSavingSite(false); return; } // upload error already set
    }

    const { data: created, error: siteError } = await supabase
      .from('sites')
      .insert({ client: newClient, site_name: newSiteName, address: newAddress || null, image_url: imageUrl })
      .select()
      .single();
    setSavingSite(false);
    if (siteError || !created) { setError(siteError?.message || 'Unable to create site.'); return; }
    const newSite: SiteOption = created;
    setSites((prev) => [...prev, newSite].sort((a, b) => a.client.localeCompare(b.client)));
    pickSite(newSite);
    setShowAddSite(false);
    setNewClient(''); setNewSiteName(''); setNewAddress(''); setNewSiteImageFile(null); setNewSiteImagePreview(null);
  };

  const handleAddPhotoToExistingSite = async (file: File | null) => {
    if (!file || !selectedSiteId) return;
    if (file.size > MAX_ORIGINAL_BYTES) { setError('Photo is too large (max 20 MB).'); return; }
    setError(null);
    setUploadingExistingPhoto(true);
    const url = await uploadSiteImage(file);
    if (url) {
      await supabase.from('sites').update({ image_url: url }).eq('id', selectedSiteId);
      setSelectedSiteImage(url);
      setSites((prev) => prev.map((s) => (s.id === selectedSiteId ? { ...s, image_url: url } : s)));
    }
    setUploadingExistingPhoto(false);
  };

  const filteredSites = sites.filter((s) =>
    !siteQuery ||
    s.client.toLowerCase().includes(siteQuery.toLowerCase()) ||
    s.site_name.toLowerCase().includes(siteQuery.toLowerCase()),
  );
  const groupedSites = filteredSites.reduce((acc: Record<string, SiteOption[]>, s) => {
    (acc[s.client] ??= []).push(s);
    return acc;
  }, {});

  const submit = async () => {
    setError(null);
    if (!client || !site || !scheduledDate) { setError('Client, site, and scheduled date are required.'); return; }
    setSaving(true);

    const primaryTechnician = people.find((p) => selectedIds.includes(p.id) && p.role === 'technician');

    const payload = {
      client,
      site,
      address,
      site_id: selectedSiteId,
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
        <div className="col-span-2">
          <label className="label">Client / Site</label>

          {client && site && !showAddSite ? (
            <div className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2.5">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-md overflow-hidden bg-ink-200 shrink-0 flex items-center justify-center">
                  {selectedSiteImage ? (
                    <img src={selectedSiteImage} alt={site} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[9px] text-ink-400 text-center px-1">No photo</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink-900">{client}</div>
                  <div className="text-xs text-ink-500">{site}</div>
                </div>
                <button type="button" onClick={changeSite} className="text-xs font-semibold text-primary-600 hover:text-primary-700 shrink-0">Change</button>
              </div>
              <input className="input h-9 mb-2" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address / reference (floor, suite…)" />
              <input ref={existingSiteImageInputRef} type="file" accept="image/*" hidden onChange={(e) => handleAddPhotoToExistingSite(e.target.files?.[0] ?? null)} />
              <button type="button" onClick={() => existingSiteImageInputRef.current?.click()} disabled={uploadingExistingPhoto} className="text-xs font-semibold text-primary-600 hover:text-primary-700">
                {uploadingExistingPhoto ? 'Uploading…' : selectedSiteImage ? 'Change photo' : 'Add photo'}
              </button>
            </div>
          ) : showAddSite ? (
            <div className="rounded-lg border border-ink-200 p-3 space-y-2">
              <input className="input" value={newClient} onChange={(e) => setNewClient(e.target.value)} placeholder="Client" />
              <input className="input" value={newSiteName} onChange={(e) => setNewSiteName(e.target.value)} placeholder="Site / building name" />
              <input className="input" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="Full address" />

              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-md overflow-hidden bg-ink-100 border border-ink-200 shrink-0 flex items-center justify-center">
                  {newSiteImagePreview ? (
                    <img src={newSiteImagePreview} alt="Preview" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[9px] text-ink-400 text-center px-1">No photo</span>
                  )}
                </div>
                <input ref={newSiteImageInputRef} type="file" accept="image/*" hidden onChange={(e) => handleNewSiteImagePick(e.target.files?.[0] ?? null)} />
                <button type="button" className="btn-secondary h-8 text-xs" onClick={() => newSiteImageInputRef.current?.click()}>
                  {newSiteImagePreview ? 'Change photo' : 'Add photo (optional)'}
                </button>
                <span className="text-[11px] text-ink-400">Max 20 MB · auto-compressed</span>
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" className="btn-secondary flex-1 h-9 text-xs" onClick={() => { setShowAddSite(false); setNewSiteImageFile(null); setNewSiteImagePreview(null); }} disabled={savingSite}>Cancel</button>
                <button type="button" className="btn-primary flex-1 h-9 text-xs" onClick={createSite} disabled={savingSite}>{savingSite ? 'Saving…' : 'Save and use'}</button>
              </div>
            </div>
          ) : (
            <>
              <input className="input mb-2" value={siteQuery} onChange={(e) => setSiteQuery(e.target.value)} placeholder="Search client or building…" />
              <div className="border border-ink-200 rounded-lg max-h-48 overflow-y-auto">
                {Object.entries(groupedSites).map(([clientName, group]) => (
                  <div key={clientName}>
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400 bg-ink-50/70">{clientName}</div>
                    {group.map((s) => (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => pickSite(s)}
                        className="w-full text-left px-3 py-2 hover:bg-ink-50 flex items-center gap-2.5 border-b border-ink-50 last:border-0"
                      >
                        <div className="h-8 w-8 rounded overflow-hidden bg-ink-100 shrink-0 flex items-center justify-center">
                          {s.image_url ? <img src={s.image_url} alt={s.site_name} className="h-full w-full object-cover" /> : <span className="text-[8px] text-ink-400">—</span>}
                        </div>
                        <div>
                          <div className="text-sm text-ink-800">{s.site_name}</div>
                          {s.address && <div className="text-xs text-ink-500">{s.address}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
                {filteredSites.length === 0 && <div className="px-3 py-4 text-sm text-ink-400 text-center">No sites found.</div>}
              </div>
              <button type="button" className="btn-secondary w-full mt-2 h-9 text-xs" onClick={() => setShowAddSite(true)}>+ Add new site</button>
            </>
          )}
        </div>

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
