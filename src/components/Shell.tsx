import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, ShieldCheck, Calendar, FileText, BarChart3, Settings,
  Bell, Search, ChevronDown, LogOut, UserCircle, HelpCircle, Building2,
  ClipboardList, History, FolderOpen, FormInput, Wrench, MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/Logo';
import { Avatar } from '@/components/ui';
import type { Role } from '@/data/mockData';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';

type NavConfig = { label: string; icon: typeof LayoutDashboard; page: string };

const navByRole: Record<Role, { group: string; items: NavConfig[] }[]> = {
  admin: [
    { group: 'Mi Area de Trabajo', items: [
      { label: 'Panel de Control', icon: LayoutDashboard, page: 'dashboard' },
    ]},
    { group: 'Administración', items: [
      { label: 'Usuarios', icon: Users, page: 'users' },
      { label: 'Roles & Permisos', icon: ShieldCheck, page: 'permissions' },
      { label: 'Supervisores', icon: Building2, page: 'supervisors' },
      { label: 'Tecnicos', icon: Wrench, page: 'technicians' },
    ]},
    { group: 'Operationes', items: [
      { label: 'Ordenes de Trabajo', icon: ClipboardList, page: 'workorders' },
      { label: 'Calendario', icon: Calendar, page: 'calendar' },
      { label: 'Documentos', icon: FolderOpen, page: 'documents' },
      { label: 'Reportes', icon: BarChart3, page: 'reports' },
      { label: 'Solicitudes', icon: FormInput, page: 'form_requests' },
    ]},
    { group: 'Sistema', items: [
      { label: 'Auditar Logeos', icon: History, page: 'audit' },
    
    ]},
  ],
  
  supervisor: [
    { group: 'Mi Area de Trabajo', items: [
      { label: 'Panel de Control', icon: LayoutDashboard, page: 'dashboard' },
    ]},
    { group: 'Planes', items: [
      { label: 'Calendario', icon: Calendar, page: 'calendar' },
      { label: 'Ordenes de trabajo', icon: ClipboardList, page: 'workorders' },
    ]},
    { group: 'Team', items: [
      { label: 'Tecnicos', icon: Wrench, page: 'technicians' },
    ]},
    { group: 'Recursos', items: [
      { label: 'Documentos', icon: FolderOpen, page: 'documents' },
      { label: 'Formularis', icon: FormInput, page: 'forms' },
      { label: 'Reports', icon: BarChart3, page: 'reports' },
    ]},
  ],
  technician: [
    { group: 'Mi Area de Trabajo', items: [
      { label: 'Panel de Control', icon: LayoutDashboard, page: 'dashboard' },
      { label: "trabajos de hoy", icon: ClipboardList, page: 'today' },
      { label: 'Calendario', icon: Calendar, page: 'calendar' },
    ]},
    { group: 'Recurcursos', items: [
      { label: 'Documentos', icon: FolderOpen, page: 'documents' },
      { label: 'Formularios', icon: FormInput, page: 'forms' },
    ]},
    { group: 'Seguridad', items: [
      { label: 'History', icon: History, page: 'history' },
      { label: 'Profile', icon: UserCircle, page: 'profile' },
    ]},
  ],
  coordinador: [
    { group: 'Mi Area de Trabajo', items: [
      { label: 'Panel de Control', icon: LayoutDashboard, page: 'dashboard' },
    ]},
    { group: 'Planificasión', items: [
       { label: 'Requerimientos', icon: FileText, page: 'history' },
      { label: 'Calendario', icon: Calendar, page: 'calendar' },
     { label: 'Ordenes de trabajo', icon: ClipboardList, page: 'workorders' },
    ]},
     { group: 'Grupos', items: [
      { label: 'Supervisores', icon: Building2, page: 'supervisors' },
      { label: 'Tecnicos', icon: Wrench, page: 'technicians' },
    ]},
      { group: 'Atención al equipo', items: [
      { label: 'atención', icon: Building2, page: 'supervisors' },
    ]},   
    { group: 'Recurcursos', items: [
      { label: 'Documentos', icon: FolderOpen, page: 'documents' },
      { label: 'Formularios', icon: FormInput, page: 'forms' },
      { label: 'Reports', icon: BarChart3, page: 'reports' },
    ]},

  ],
};

 {/* estaba mas arriba  administrador- grupo de sistema} { label: 'configurar Sistema', icon: Settings, page: 'settings' }, */}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? '' : 's'} ago`;
}

interface ShellProps {
  role: Role;
  page: string;
  setPage: (p: string) => void;
  onSwitchRole: (r: Role) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export function Shell({ role, page, setPage, onSwitchRole, onLogout, children }: ShellProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);
  const { profile } = useAuth();
  const userName = profile?.full_name ?? 'User';
  const userEmail = profile?.email ?? '';
  const userTitle = profile?.title ?? '';
  const userInitials = profile?.initials ?? 'U';
  const userAvatarColor = profile?.avatar_color ?? 'bg-primary-600';
  const nav = navByRole[role];

  useEffect(() => {
    if (!profile) return;
    fetchNotifs();
  }, [profile?.id]);

  // Close the mobile drawer whenever the page changes (e.g. after clicking a nav item)
  useEffect(() => { setMobileOpen(false); }, [page]);

  const fetchNotifs = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(8);
    if (data) setNotifs(data);
  };

  const unread = notifs.filter((n) => n.unread).length;

  const openNotification = async (n: any) => {
    if (n.unread) {
      await supabase.from('notifications').update({ unread: false }).eq('id', n.id);
      setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, unread: false } : x)));
    }
    setNotifOpen(false);
    if (n.related_work_order_id) setPage('workorders');
    else setPage('notifications');
  };

  const roleLabel: Record<Role, string> = {
    admin: 'Administrator', supervisor: 'Supervisor', technician: 'Technician', coordinador: 'Coordinador',
  };

  return (
    <div className="flex h-screen bg-ink-100 overflow-hidden">
      {/* Mobile backdrop — tap to close the drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col bg-white border-r border-ink-200 transition-all duration-200 shrink-0 z-50',
          'fixed inset-y-0 left-0 w-60 md:static',
          collapsed ? 'md:w-16' : 'md:w-60',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <div className={cn('h-16 flex items-center border-b border-ink-100 shrink-0', collapsed ? 'md:justify-center md:px-2 px-4' : 'px-4')}>
          {collapsed ? <><span className="md:hidden"><Logo /></span><span className="hidden md:block"><Logo showText={false} /></span></> : <Logo />}
        </div>
        <nav className="flex-1 overflow-y-auto py-3 no-scrollbar">
          {collapsed ? (
            <div className="px-2 space-y-1">
              {nav.flatMap((g) => g.items).map((item) => (
                <button
                  key={item.page}
                  onClick={() => setPage(item.page)}
                  className={cn('nav-item md:justify-center', page === item.page && 'nav-item-active')}
                  title={item.label}
                >
                  <item.icon size={18} />
                  <span className="md:hidden truncate">{item.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-3 space-y-5">
              {nav.map((group) => (
                <div key={group.group}>
                  <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">{group.group}</div>
                  <div className="space-y-0.5">
                    {group.items.map((item) => (
                      <button
                        key={item.page}
                        onClick={() => setPage(item.page)}
                        className={cn('nav-item w-full', page === item.page && 'nav-item-active')}
                      >
                        <item.icon size={18} className="shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </nav>
        <div className={cn('border-t border-ink-100 p-3 space-y-1', collapsed && 'md:px-2')}>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="nav-item w-full justify-center text-ink-400 hover:text-ink-700 hidden md:flex"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <span className="text-base">{collapsed ? '›' : '‹ Sidebar'}</span>
          </button>
          <button
            onClick={onLogout}
            className={cn('nav-item w-full text-red-600 hover:bg-red-50', collapsed && 'md:justify-center')}
            title="Sign out"
          >
            <LogOut size={18} className="shrink-0" />
            <span className={cn(collapsed && 'md:hidden')}>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-ink-200 flex items-center justify-between px-4 sm:px-6 shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden h-9 w-9 rounded-lg flex items-center justify-center hover:bg-ink-100 shrink-0"
              title="Open menu"
            >
              <Logo showText={false} />
            </button>
            <div className="hidden sm:flex items-center gap-4 flex-1 max-w-md">
              <div className="relative w-full">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  placeholder="Busca ordenes de trabajo, clientes, tecnicos…"
                  className="w-full h-9 pl-9 pr-4 rounded-lg bg-ink-100 border border-transparent text-sm placeholder:text-ink-400 focus:outline-none focus:bg-white focus:border-primary-300 focus:ring-2 focus:ring-primary-500/20 transition"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink-50 border border-ink-200">
              <span className={cn('h-2 w-2 rounded-full', role === 'admin' ? 'bg-primary-500' : role === 'supervisor' ? 'bg-emerald-500' : 'bg-amber-500')} />
              <span className="text-xs font-semibold text-ink-600">{roleLabel[role]} view</span>
            </div>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => { setNotifOpen((o) => !o); setProfileOpen(false); }}
                className="relative h-9 w-9 rounded-lg flex items-center justify-center text-ink-500 hover:bg-ink-100 hover:text-ink-800 transition"
              >
                <Bell size={18} />
                {unread > 0 && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />}
              </button>
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                  <div
                    className={cn(
                      'z-40 bg-white rounded-xl shadow-pop border border-ink-200 animate-fade-in overflow-hidden',
                      'fixed left-3 right-3 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80 sm:fixed-none',
                    )}
                  >
                    <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
                      <span className="font-semibold text-sm text-ink-900">Notifications</span>
                      <span className="chip bg-primary-50 text-primary-700">{unread} new</span>
                    </div>
                    <div className="max-h-[60vh] sm:max-h-80 overflow-y-auto">
                      {notifs.length === 0 && (
                        <div className="px-4 py-8 text-center text-sm text-ink-400">No notifications yet.</div>
                      )}
                      {notifs.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => openNotification(n)}
                          className={cn('px-4 py-3 border-b border-ink-50 hover:bg-ink-50 cursor-pointer flex gap-3', n.unread && 'bg-primary-50/30')}
                        >
                          <span className={cn('h-2 w-2 rounded-full mt-1.5 shrink-0', n.color ?? 'bg-primary-500')} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink-900 truncate">{n.title}</p>
                            {n.body && <p className="text-xs text-ink-500 mt-0.5 line-clamp-2">{n.body}</p>}
                            <p className="text-[11px] text-ink-400 mt-1">{timeAgo(n.created_at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => { setPage('notifications'); setNotifOpen(false); }}
                      className="w-full py-2.5 text-sm font-medium text-primary-600 hover:bg-primary-50"
                    >
                      View all notifications
                    </button>
                  </div>
                </>
              )}
            </div>

            <button className="hidden sm:flex h-9 w-9 rounded-lg items-center justify-center text-ink-500 hover:bg-ink-100 hover:text-ink-800 transition" title="Help">
              <HelpCircle size={18} />
            </button>

            {/* Profile */}
            <div className="relative">
              <button
                onClick={() => { setProfileOpen((o) => !o); setNotifOpen(false); }}
                className="flex items-center gap-2.5 pl-1.5 pr-2 py-1.5 rounded-lg hover:bg-ink-100 transition"
              >
                <Avatar initials={userInitials} color={userAvatarColor} size="sm" />
                <div className="hidden sm:block text-left leading-tight">
                  <div className="text-sm font-semibold text-ink-900">{userName}</div>
                  <div className="text-[11px] text-ink-500">{userTitle}</div>
                </div>
                <ChevronDown size={15} className="text-ink-400 hidden sm:block" />
              </button>
              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setProfileOpen(false)} />
                  <div className="fixed left-3 right-3 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-64 bg-white rounded-xl shadow-pop border border-ink-200 z-40 animate-fade-in overflow-hidden">
                    {/*}
                    <div className="px-4 py-3 border-b border-ink-100">
                      <div className="flex items-center gap-3">
                        <Avatar initials={userInitials} color={userAvatarColor} size="md" />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-ink-900 truncate">{userName}</div>
                          <div className="text-xs text-ink-500 truncate">{userEmail}</div>
                        </div>
                      </div>
                    </div>
                    */}

                    <div className="py-1.5">
                      <MenuItem icon={UserCircle} label="Mi Perfil" onClick={() => { setPage('profile'); setProfileOpen(false); }} />
                      <MenuItem icon={Calendar} label="Calendario" onClick={() => { setPage('calendar'); setProfileOpen(false); }} />  
                      <MenuItem icon={FolderOpen} label="Documentos" onClick={() => { setPage('documents'); setProfileOpen(false); }} /> 
                      <div className="my-1.5 border-t border-ink-100" />
                      {/*}
                       <MenuItem icon={Settings} label="Configuración" onClick={() => { setPage('settings'); setProfileOpen(false); }} />
                      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">Switch role (demo)</div>
                      <MenuItem icon={ShieldCheck} label="Administrator" active={role === 'admin'} onClick={() => { onSwitchRole('admin'); setProfileOpen(false); }} />
                      <MenuItem icon={Building2} label="Supervisor" active={role === 'supervisor'} onClick={() => { onSwitchRole('supervisor'); setProfileOpen(false); }} />
                      <MenuItem icon={Wrench} label="Technician" active={role === 'technician'} onClick={() => { onSwitchRole('technician'); setProfileOpen(false); }} />  
                      */}
                      <div className="my-1.5 border-t border-ink-100" />
                      <MenuItem icon={LogOut} label="Salir" onClick={onLogout} danger />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 max-w-[1600px] mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, active, danger }: { icon: typeof LayoutDashboard; label: string; onClick: () => void; active?: boolean; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors',
        danger ? 'text-red-600 hover:bg-red-50' : active ? 'text-primary-700 bg-primary-50' : 'text-ink-700 hover:bg-ink-100',
      )}
    >
      <Icon size={16} />
      {label}
      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary-500" />}
    </button>
  );
}