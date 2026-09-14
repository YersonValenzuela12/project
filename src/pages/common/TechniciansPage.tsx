import { useState, useEffect } from 'react';
import { Mail, Phone, MapPin, MoreVertical, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, Avatar, ProgressBar } from '@/components/ui';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { workOrders } from '@/data/mockData';
import { UserFormModal, type ProfileRow } from '@/components/UserFormModal';

const ROLE_BREADCRUMB: Record<string, string> = {
  admin: 'Administrator',
  supervisor: 'Supervisor',
  coordinador: 'Coordinador',
  technician: 'Technician',
};

export function TechniciansPage({
  adminView = false,
  roleFilter = 'technician',
  role = 'admin',
  externalQuery = '',
}: {
  adminView?: boolean;
  roleFilter?: 'technician' | 'supervisor' | 'coordinador';
  role?: 'admin' | 'supervisor' | 'coordinador' | 'technician';
  externalQuery?: string;
}) {
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchPeople = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', roleFilter)
      .order('full_name');
    if (!error && data) setRows(data as ProfileRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchPeople(); }, [roleFilter]);

  const q = externalQuery;
  const list = rows.filter((u) =>
    u.full_name?.toLowerCase().includes(q.toLowerCase()) || u.title?.toLowerCase().includes(q.toLowerCase()),
  );

  const handleSaved = () => { setModalOpen(false); fetchPeople(); };

  const label = roleFilter === 'supervisor' ? 'Supervisors' : roleFilter === 'coordinador' ? 'Coordinadores' : 'Technicians';
  const noun = roleFilter === 'supervisor' ? 'supervisors' : roleFilter === 'coordinador' ? 'coordinadores' : ' technicians';
  const addLabel = roleFilter === 'supervisor' ? 'Add Supervisor' : roleFilter === 'coordinador' ? 'Add Coordinador' : 'Add Technician';

  return (
    <div>
      <PageHeader
        title={adminView ? label : `My ${label}`}
        subtitle={`${list.length} ${noun} se encontro`}
        breadcrumbs={['Home', ROLE_BREADCRUMB[role] ?? 'Administrator', label]}
        actions={adminView ? <button className="btn-primary" onClick={() => setModalOpen(true)}><Wrench size={15} /> {addLabel}</button> : undefined}
      />

      {loading ? (
        <div className="text-center text-sm text-ink-500 py-12">Loading {noun}…</div>
      ) : list.length === 0 ? (
        <div className="text-center text-sm text-ink-500 py-12">No {noun} yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map((t) => {
            // Job counts still come from mock work orders until that table is migrated.
            const assigned = workOrders.filter((w) => w.technicianId === t.id);
            const active = assigned.filter((w) => w.status === 'in_progress' || w.status === 'scheduled');
            const completed = assigned.filter((w) => w.status === 'completed').length;
            const jobsCompleted = assigned.filter((w) => w.technicianId === t.id).length;
            return (
              <Card key={t.id} className="hover:shadow-card-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <Avatar initials={t.initials} color={t.avatar_color} size="lg" />
                    <span className={cn('absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white', t.status === 'active' ? 'bg-emerald-500' : 'bg-ink-300')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink-900 truncate">{t.full_name}</div>
                    <div className="text-sm text-ink-500 truncate">{t.title}</div>
                    <div className="flex items-center gap-1.5 text-xs text-ink-500 mt-1"><MapPin size={11} /> {t.region}</div>
                  </div>
                  {adminView && <button className="h-8 w-8 rounded-md hover:bg-ink-100 flex items-center justify-center text-ink-400"><MoreVertical size={16} /></button>}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-ink-100 text-center">
                  <div><div className="text-base font-bold text-ink-900">{active.length}</div><div className="text-[11px] text-ink-500">Active</div></div>
                  <div><div className="text-base font-bold text-ink-900">{completed}</div><div className="text-[11px] text-ink-500">Done</div></div>
                  <div><div className="text-base font-bold text-ink-900">{jobsCompleted}</div><div className="text-[11px] text-ink-500">Trabajos hechos</div></div>
                </div>
                <div className="mt-3"><ProgressBar value={Math.min(100, active.length * 30)} barClass="bg-primary-500" /></div>
                <div className="flex items-center gap-2 mt-4">
                  <button className="btn-secondary flex-1 h-8 text-xs"><Mail size={13} /> Correo</button>
                  <button className="btn-secondary flex-1 h-8 text-xs"><Phone size={13} /> Numero</button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <UserFormModal user={null} defaultRole={roleFilter} onClose={() => setModalOpen(false)} onSaved={handleSaved} />
      )}
    </div>
  );
}
