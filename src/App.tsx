import { useState, useEffect } from 'react';
import type { Role } from '@/data/mockData';
import { Shell } from '@/components/Shell';
import { Login } from '@/pages/Login';
import { ResetPassword } from '@/pages/ResetPassword';
import { useAuth } from '@/lib/auth';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { UsersPage } from '@/pages/admin/UsersPage';
import { PermissionsPage } from '@/pages/admin/PermissionsPage';
import { ReportsPage } from '@/pages/admin/ReportsPage';
import { AuditPage, SettingsPage } from '@/pages/admin/AuditSettings';
import { SupervisorDashboard } from '@/pages/supervisor/SupervisorDashboard';
import { CalendarPage } from '@/pages/supervisor/CalendarPage';
import { TechnicianDashboard } from '@/pages/technician/TechnicianDashboard';
import { FormsPage, HistoryPage, AdminFormsPage } from '@/pages/technician/FormsHistory';
import { WorkOrdersPage } from '@/pages/WorkOrdersPage';
import { WorkOrderDetail } from '@/pages/WorkOrderDetail';
import { TechniciansPage } from '@/pages/common/TechniciansPage';
import { DocumentsPage, ProfilePage } from '@/pages/common/CommonPages';
import { NotificationsPage, HelpPage } from '@/pages/common/NotificationsHelp';
import { FullPageLoader } from '@/components/ui';

function App() {
  const { session, profile, loading, signOut } = useAuth();
  const [page, setPage] = useState('dashboard');
  const [switchRole, setSwitchRole] = useState<Role | null>(null);

  useEffect(() => {
    setPage('dashboard');
    setSwitchRole(null);
  }, [session?.user?.id]);

  // Intercept the password-recovery link BEFORE any session/login logic.
  // Supabase creates a temporary session when the user lands here from the
  // reset email, and we don't want that to fall through to the dashboard.
  if (window.location.pathname === '/reset-password') {
    return <ResetPassword />;
  }

  if (loading) return <FullPageLoader label="Loading your workspace…" />;

  if (!session || !profile) {
    return <Login onLogin={() => {}} />;
  }

  const role: Role = switchRole ?? profile.role;

  const goPage = (p: string) => {
    setSwitchRole(null);
    setPage(p);
  };

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        if (role === 'admin') return <AdminDashboard setPage={goPage} onAction={() => goPage('workorders')} />;
        if (role === 'supervisor') return <SupervisorDashboard onSelect={() => setPage('workorders')} setPage={goPage} />;
        return <TechnicianDashboard onSelect={() => setPage('workorders')} setPage={goPage} />;
      case 'today':
        return <WorkOrdersPage title="Today's Jobs" breadcrumbs={['Home', 'Technician', "Today's Jobs"]} onSelect={() => setPage('workorders')} showAssign={false} />;
      case 'users':
        return <UsersPage />;
      case 'permissions':
        return <PermissionsPage />;
      case 'supervisors':
        return <TechniciansPage adminView roleFilter="supervisor" />;
      case 'technicians':
        return <TechniciansPage adminView={role === 'admin'} roleFilter="technician" />;
      case 'workorders':
        return <WorkOrdersPage breadcrumbs={['Home', role === 'admin' ? 'Administrator' : 'Supervisor', 'Work Orders']} onSelect={() => {}} role={role} />;
      case 'calendar':
        return <CalendarPage onSelect={() => setPage('workorders')} role={role} />;
      case 'documents':
        return <DocumentsPage />;
      case 'reports':
        return <ReportsPage />;
      case 'audit':
        return <AuditPage />;
      case 'settings':
        return <SettingsPage />;
      case 'forms':
        return <FormsPage />;
      case 'form_requests':
        return <AdminFormsPage />;
      case 'history':
        return <HistoryPage />;
      case 'profile':
        return <ProfilePage />;
      case 'notifications':
        return <NotificationsPage />;
      case 'help':
        return <HelpPage />;
      default:
        return <AdminDashboard setPage={goPage} onAction={() => goPage('workorders')} />;
    }
  };

  return (
    <Shell
      role={role}
      page={page}
      setPage={goPage}
      onSwitchRole={(r) => { setSwitchRole(r); setPage('dashboard'); }}
      onLogout={() => { void signOut(); }}
    >
      {renderPage()}
    </Shell>
  );
}

export default App;
