import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Avatar, Modal } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import type { Role } from '@/data/mockData';

export interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  title: string;
  phone: string;
  region: string;
  status: 'active' | 'suspended';
  avatar_color: string;
  initials: string;
  last_login: string | null;
}

const AVATAR_COLORS = ['bg-primary-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600', 'bg-violet-600', 'bg-cyan-600'];

export function UserFormModal({
  user,
  defaultRole,
  onClose,
  onSaved,
}: {
  user: ProfileRow | null;
  defaultRole?: Role;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(user?.full_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(user?.role ?? defaultRole ?? 'technician');
  const [title, setTitle] = useState(user?.title ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [region, setRegion] = useState(user?.region ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '??';

  const submit = async () => {
    setError(null);
    if (!name || !email) { setError('Name and email are required.'); return; }
    if (!user && (!password || password.length < 8)) {
      setError('contraseña de 8 caracteres a más.');
      return;
    }
    setSaving(true);

    if (user) {
      // Editing an existing user: just update the profile row.
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ full_name: name, role, title, phone, region })
        .eq('id', user.id);
      setSaving(false);
      if (updateError) { setError(updateError.message); return; }
      onSaved();
      return;
    }

    // Creating a new user: call the Edge Function (needs the caller's session token).
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password, full_name: name, role, title, phone, region }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error || 'Unable to create user.'); return; }
    onSaved();
  };

  return (
    <Modal
      open onClose={onClose}
      title={user ? 'Edit User' : 'Create New User'}
      size="lg"
      footer={<>
        <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={saving}>
          {saving ? 'Saving…' : user ? 'Save changes' : 'Create user'}
        </button>
      </>}
    >
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3.5 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-4 mb-5 p-4 rounded-xl bg-ink-50">
        <Avatar initials={initials} color={user?.avatar_color ?? AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]} size="lg" />
        <div>
          <div className="font-semibold text-ink-900">{name || 'New user'}</div>
          <div className="text-sm text-ink-500">{title || 'Untitled role'}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">nombre completo</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" /></div>
        <div>
          <label className="label">correo</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@selecom.com" disabled={!!user} />
        </div>
        {!user && (
          <div className="col-span-2">
            <label className="label">correo temporal</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" />
          </div>
        )}
        <div>
          <label className="label">Rol</label>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="admin">Administrator</option>
            <option value="supervisor">Supervisor</option>
            <option value="coordinador">Coordinador</option>
            <option value="technician">Technician</option>
          </select>
        </div>
        <div><label className="label">perfil</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Field Technician" /></div>
        <div><label className="label">telefono</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+51 915 555 100" /></div>
        <div><label className="label">distrito</label><input className="input" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Distrito" /></div>
      </div>
      <div className="mt-5 p-4 rounded-xl border border-ink-200 bg-white">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-800 mb-2"><ShieldCheck size={15} className="text-primary-600" /> Role permissions preview</div>
        <p className="text-xs text-ink-500">{role === 'admin' ? 'Full system access — all modules and administrative functions.' : role === 'supervisor' ? 'Manage technicians, schedule and assign work orders, view reports.' : 'Execute assigned work orders, submit forms, view own history.'}</p>
      </div>
    </Modal>
  );
}
