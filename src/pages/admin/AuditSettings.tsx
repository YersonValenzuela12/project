import { useEffect, useMemo, useState } from 'react';
import { Shield, User, FileText, Settings, Database, Lock, Globe, ChevronDown } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, SectionHeader, Avatar, Badge, Tabs } from '@/components/ui';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { generateAuditPdf } from '@/lib/auditReport';

type AuditLogRow = {
  id: string;
  actor_name: string;
  action: string;
  target: string | null;
  detail: string | null;
  ip_address: string | null;
  created_at: string;
};

function categorize(action: string): 'Activity' | 'Logins' | 'System' | 'Security' {
  const a = action.toUpperCase();
  if (a.includes('LOGIN')) return 'Logins';
  if (a.includes('BACKUP') || a.includes('SYSTEM')) return 'System';
  if (a.includes('ROLE') || a.includes('POLICY') || a.includes('PERMISSION') || a.includes('PASSWORD')) return 'Security';
  return 'Activity';
}

export function AuditPage() {
  const [tab, setTab] = useState<'Activity' | 'Logins' | 'System' | 'Security'>('Activity');
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [profilesByName, setProfilesByName] = useState<Map<string, { initials: string; avatar_color: string }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data: logData } = await supabase
        .from('audit_logs')
        .select('id, actor_name, action, target, detail, ip_address, created_at')
        .order('created_at', { ascending: false })
        .limit(200);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, initials, avatar_color');

      if (!cancelled) {
        setLogs(logData ?? []);
        setProfilesByName(new Map((profileData ?? []).map((p: any) => [p.full_name, p])));
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const filteredLogs = useMemo(() => logs.filter((l) => categorize(l.action) === tab), [logs, tab]);

  async function handleExport(range: 'week' | 'month') {
    setExportOpen(false);
    setExporting(true);
    try {
      await generateAuditPdf(range, tab);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        subtitle="Immutable record of all system actions for compliance"
        breadcrumbs={['Home', 'Administrator', 'Audit Logs']}
        actions={
          <div className="relative">
            <button className="btn-secondary" onClick={() => setExportOpen((v) => !v)} disabled={exporting}>
              <Database size={15} /> {exporting ? 'Generating…' : 'Export Log'} <ChevronDown size={14} />
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white border border-ink-100 rounded-lg shadow-card-md z-10 overflow-hidden">
                <button className="w-full text-left px-4 py-2.5 text-sm hover:bg-ink-50" onClick={() => handleExport('week')}>Última semana</button>
                <button className="w-full text-left px-4 py-2.5 text-sm hover:bg-ink-50" onClick={() => handleExport('month')}>Este mes</button>
              </div>
            )}
          </div>
        }
      />
      <Card pad={false} className="overflow-hidden">
        <div className="px-5 pt-4"><Tabs tabs={['Activity', 'Logins', 'System', 'Security']} active={tab} onChange={(t: any) => setTab(t)} /></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead className="bg-ink-50/50 border-y border-ink-100">
              <tr>
                <th className="th">Actor</th><th className="th">Action</th><th className="th">Target</th>
                <th className="th">Detail</th><th className="th">IP address</th><th className="th">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {loading && <tr><td className="td text-ink-400" colSpan={6}>Loading…</td></tr>}
              {!loading && filteredLogs.length === 0 && (
                <tr><td className="td text-ink-400" colSpan={6}>No records in this category</td></tr>
              )}
              {filteredLogs.map((l) => {
                const p = profilesByName.get(l.actor_name);
                return (
                  <tr key={l.id} className="hover:bg-ink-50/40">
                    <td className="td">
                      <div className="flex items-center gap-2.5">
                        {p ? <Avatar initials={p.initials} color={p.avatar_color} size="sm" /> : <span className="h-8 w-8 rounded-full bg-ink-200 flex items-center justify-center"><Shield size={14} className="text-ink-500" /></span>}
                        <span className="font-medium text-ink-900">{l.actor_name}</span>
                      </div>
                    </td>
                    <td className="td"><Badge className="bg-ink-100 text-ink-700 font-mono text-[11px]">{l.action}</Badge></td>
                    <td className="td text-ink-700">{l.target ?? '—'}</td>
                    <td className="td text-ink-500">{l.detail ?? '—'}</td>
                    <td className="td font-mono text-xs text-ink-500">{l.ip_address ?? '—'}</td>
                    <td className="td text-ink-500 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
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
