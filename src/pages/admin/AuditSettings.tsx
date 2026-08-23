import { History, Shield, User, FileText, Settings, Database, Lock, Globe } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, SectionHeader, Avatar, Badge, Tabs } from '@/components/ui';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { auditLogs, users } from '@/data/mockData';

export function AuditPage() {
  const [tab, setTab] = useState('Activity');
  return (
    <div>
      <PageHeader
        title="Audit Logs"
        subtitle="Immutable record of all system actions for compliance"
        breadcrumbs={['Home', 'Administrator', 'Audit Logs']}
        actions={<button className="btn-secondary"><Database size={15} /> Export Log</button>}
      />
      <Card pad={false} className="overflow-hidden">
        <div className="px-5 pt-4"><Tabs tabs={['Activity', 'Logins', 'System', 'Security']} active={tab} onChange={setTab} /></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead className="bg-ink-50/50 border-y border-ink-100">
              <tr>
                <th className="th">Actor</th><th className="th">Action</th><th className="th">Target</th>
                <th className="th">Detail</th><th className="th">IP address</th><th className="th">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {auditLogs.map((l) => {
                const u = users.find((x) => x.name === l.actor);
                return (
                  <tr key={l.id} className="hover:bg-ink-50/40">
                    <td className="td">
                      <div className="flex items-center gap-2.5">
                        {u ? <Avatar initials={u.initials} color={u.avatarColor} size="sm" /> : <span className="h-8 w-8 rounded-full bg-ink-200 flex items-center justify-center"><Shield size={14} className="text-ink-500" /></span>}
                        <span className="font-medium text-ink-900">{l.actor}</span>
                      </div>
                    </td>
                    <td className="td"><Badge className="bg-ink-100 text-ink-700 font-mono text-[11px]">{l.action}</Badge></td>
                    <td className="td text-ink-700">{l.target}</td>
                    <td className="td text-ink-500">{l.detail}</td>
                    <td className="td font-mono text-xs text-ink-500">{l.ip}</td>
                    <td className="td text-ink-500 whitespace-nowrap">{l.time}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function SettingsPage() {
  const [tab, setTab] = useState('General');
  return (
    <div>
      <PageHeader title="System Settings" subtitle="Platform configuration and preferences" breadcrumbs={['Home', 'Administrator', 'System Settings']} />
      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6">
        <div className="space-y-1">
          {[
            { k: 'General', icon: Settings },
            { k: 'Security', icon: Lock },
            { k: 'Users', icon: User },
            { k: 'Integrations', icon: Globe },
            { k: 'Backups', icon: Database },
            { k: 'Documents', icon: FileText },
          ].map((s) => (
            <button key={s.k} onClick={() => setTab(s.k)} className={cn('nav-item w-full', tab === s.k && 'nav-item-active')}>
              <s.icon size={16} /> {s.k}
            </button>
          ))}
        </div>
        <div className="space-y-4">
          <Card>
            <SectionHeader title="General Configuration" subtitle="Organization-wide preferences" />
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Organization name</label><input className="input" defaultValue="Electronics Selecom | Electronics Security" /></div>
              <div><label className="label">Platform URL</label><input className="input" defaultValue="selecom.com" /></div>
              <div><label className="label">Default timezone</label><select className="input"><option>Ubicasion</option><option> Lima - Peru</option></select></div>
              <div><label className="label">Date format</label><select className="input"><option>MMM D, YYYY</option><option>DD/MM/YYYY</option></select></div>
              <div><label className="label">Currency</label><select className="input"><option>soles (S/.)</option><option>Dolares ($)</option></select></div>
              <div><label className="label">Working hours</label><input className="input" defaultValue="08:00 – 18:00" /></div>
            </div>
          </Card>
          <Card>
            <SectionHeader title="Security Policies" subtitle="Authentication and access controls" />
            <Toggle label="Enforce multi-factor authentication" desc="Require MFA for all users" on />
            <Toggle label="Session timeout after 30 minutes" desc="Auto sign-out on inactivity" on />
            <Toggle label="IP allowlist" desc="Restrict access to known networks" />
            <Toggle label="Password rotation every 90 days" desc="Force periodic password changes" on />
          </Card>
          <Card>
            <SectionHeader title="Automated Backups" subtitle="Last backup: Aug 6, 02:00 — 4.2 GB" action={<button className="btn-secondary">Run now</button>} />
            <Toggle label="Daily full database backup" desc="02:00 PST, retained 30 days" on />
            <Toggle label="Weekly document archive" desc="Sunday 03:00, retained 90 days" on />
            <Toggle label="Real-time replication" desc="Continuous WAL streaming to standby" on />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, desc, on }: { label: string; desc: string; on?: boolean }) {
  const [v, setV] = useState(!!on);
  return (
    <div className="flex items-center justify-between py-3 border-b border-ink-50 last:border-0">
      <div><div className="text-sm font-medium text-ink-900">{label}</div><div className="text-xs text-ink-500">{desc}</div></div>
      <button onClick={() => setV((x) => !x)} className={cn('h-6 w-11 rounded-full transition-colors relative', v ? 'bg-primary-600' : 'bg-ink-200')}>
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', v ? 'translate-x-5' : 'translate-x-0.5')} />
      </button>
    </div>
  );
}
