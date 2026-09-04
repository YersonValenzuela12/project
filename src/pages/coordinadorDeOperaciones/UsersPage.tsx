import { useState, useEffect } from 'react';
import {
  Search, Filter, UserPlus, MoreVertical, Mail, Pencil, Trash2, ShieldCheck, KeyRound,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, Avatar, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { Role } from '@/data/mockData';
import { UserFormModal, type ProfileRow } from '@/components/UserFormModal';

const roleBadge: Record<Role, string> = {
  admin: 'bg-primary-50 text-primary-700',
  supervisor: 'bg-emerald-50 text-emerald-700',
  technician: 'bg-amber-50 text-amber-700',
  coordinador: 'bg-violet-50 text-violet-700',
};

export function UsersPage() {
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<ProfileRow | null>(null);
  const [resetPwUser, setResetPwUser] = useState<ProfileRow | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('*').order('full_name');
    if (!error && data) setRows(data as ProfileRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const filtered = rows.filter((u) =>
    (filterRole === 'all' || u.role === filterRole) &&
    (u.full_name?.toLowerCase().includes(q.toLowerCase()) || u.email?.toLowerCase().includes(q.toLowerCase())),
  );

  const openCreate = () => { setEditUser(null); setModalOpen(true); };
  const openEdit = (u: ProfileRow) => { setEditUser(u); setMenuId(null); setModalOpen(true); };
  const handleSaved = () => { setModalOpen(false); fetchUsers(); };

  const toggleSuspend = async (u: ProfileRow) => {
    setMenuId(null);
    const newStatus = u.status === 'active' ? 'suspended' : 'active';
    const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', u.id);
    if (!error) fetchUsers();
  };

  return (
    <div onClick={() => setMenuId(null)}>
      <PageHeader
        title="Administracion de usuarios"
        subtitle="administra todos los usuarios, roles y accesos a través de la plataforma"
        breadcrumbs={['Home', 'Administrator', 'Users']}
        actions={<button className="btn-primary" onClick={openCreate}><UserPlus size={15} /> Crear Usuario</button>}
      />

      <Card pad={false} className="overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-ink-100 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o email…" className="input pl-9 h-9" />
          </div>
          <div className="flex items-center gap-1.5 bg-ink-50 rounded-lg p-1">
            {['all', 'admin', 'supervisor','coordinador', 'technician'].map((r) => (
              <button
                key={r}
                onClick={() => setFilterRole(r)}
                className={cn('px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition', filterRole === r ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800')}
              >{r}</button>
            ))}
          </div>
          <button className="btn-secondary h-9"><Filter size={14} /> Filters</button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead className="bg-ink-50/50 border-b border-ink-100">
              <tr>
                <th className="th">Usuario</th><th className="th">Rol</th><th className="th">Titulo</th>
                <th className="th">Distrito</th><th className="th">Estado</th><th className="th w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {loading ? (
                <tr><td colSpan={7} className="td text-center text-ink-500 py-8">Loading users…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="td text-center text-ink-500 py-8">No users found.</td></tr>
              ) : filtered.map((u) => (
                <tr key={u.id} className="hover:bg-ink-50/40">
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <Avatar initials={u.initials} color={u.avatar_color} size="sm" />
                      <div>
                        <div className="font-medium text-ink-900">{u.full_name}</div>
                        <div className="text-xs text-ink-400">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="td"><Badge className={roleBadge[u.role]}><ShieldCheck size={11} /> {u.role}</Badge></td>
                  <td className="td text-ink-600">{u.title}</td>
                  <td className="td text-ink-600">{u.region}</td>
                 {/*} <td className="td text-ink-500">{u.last_login ?? '—'}</td>*/}
                  <td className="td"><Badge className={u.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-100 text-ink-500'}>{u.status}</Badge></td>
                  <td className="td relative">
                    <button onClick={(e) => { e.stopPropagation(); setMenuId(menuId === u.id ? null : u.id); }} className="h-8 w-8 rounded-md hover:bg-ink-100 flex items-center justify-center text-ink-400">
                      <MoreVertical size={16} />
                    </button>
                    {menuId === u.id && (
                      <div className="absolute right-4 top-10 z-20 w-36 bg-white rounded-lg shadow-pop border border-ink-200 py-1 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => openEdit(u)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"><Pencil size={14} /> Edit</button>
                        <button onClick={() => { setResetPwUser(u); setMenuId(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"><KeyRound size={14} /> Reset password</button>
                        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"><Mail size={14} /> Email</button>
                        <button onClick={() => toggleSuspend(u)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                          <Trash2 size={14} /> {u.status === 'active' ? 'Suspend' : 'Reactivate'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-ink-100 flex items-center justify-between text-sm text-ink-500">
          <span>Showing {filtered.length} of {rows.length} users</span>
          <div className="flex gap-1">
            <button className="btn-secondary h-8 px-2.5 text-xs" disabled>Previous</button>
            <button className="btn-secondary h-8 px-2.5 text-xs" disabled>Next</button>
          </div>
        </div>
      </Card>

      {modalOpen && <UserFormModal user={editUser} onClose={() => setModalOpen(false)} onSaved={handleSaved} />}
      {resetPwUser && <ResetPasswordModal user={resetPwUser} onClose={() => setResetPwUser(null)} />}
    </div>
  );
}

{/*  <th className="th">Last login</th>   la acabezera que se retiro  dentro de usurio- rol -titulo - estado */}

function ResetPasswordModal({ user, onClose }: { user: ProfileRow; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError(null);
    if (!password || password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ user_id: user.id, new_password: password }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error || 'Unable to reset password.'); return; }
    setDone(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-ink-900/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        {done ? (
          <div className="text-center py-2">
            <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <KeyRound size={22} className="text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-ink-900">Password updated</h3>
            <p className="text-sm text-ink-500 mt-2">{user.full_name} can now sign in with the new password.</p>
            <button onClick={onClose} className="btn-primary w-full py-2.5 text-sm mt-6">Done</button>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-bold text-ink-900">Reset password</h3>
            <p className="text-sm text-ink-500 mt-1.5 mb-5">Set a new password for <span className="font-medium text-ink-700">{user.full_name}</span> ({user.email}).</p>
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3.5 py-3 text-sm text-red-700">{error}</div>
            )}
            <label className="label">New password</label>
            <input
              type="text"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              autoFocus
            />
            <div className="flex gap-2 mt-5">
              <button className="btn-secondary flex-1" onClick={onClose} disabled={saving}>Cancel</button>
              <button className="btn-primary flex-1" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Set password'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
