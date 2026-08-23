import { useState } from 'react';
import { ShieldCheck, Plus, Check, Lock } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, SectionHeader, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { modules, features, roles as roleList } from '@/data/mockData';

// Static permission matrix — represents each role's access per module.
type PermMatrix = Record<string, boolean[][]>;

const permMatrix: PermMatrix = {
  Administrator: modules.map(() => [true, true, true, true, true, true, true]),
  Supervisor: modules.map((m) => {
    if (['Users', 'Roles', 'Audit Logs', 'System Settings'].includes(m)) return [false, true, false, false, false, false, false];
    return [true, true, true, false, true, true, false];
  }),
  Technician: modules.map((m) => {
    if (['Dashboard', 'Work Orders', 'Calendar', 'Documents', 'Forms'].includes(m)) return [false, true, true, true, false, false, false];
    if (m === 'History') return [false, true, false, false, false, false, false];
    return [false, true, false, false, false, false, false];
  }),
  Auditor: modules.map(() => [false, true, false, false, false, true, false]),
};

export function PermissionsPage() {
  const [activeRole, setActiveRole] = useState('Administrator');
  const [matrix, setMatrix] = useState(permMatrix);

  const toggle = (mi: number, fi: number) => {
    setMatrix((m) => ({
      ...m,
      [activeRole]: m[activeRole].map((row: boolean[], i: number) => (i === mi ? row.map((v: boolean, j: number) => (j === fi ? !v : v)) : row)),
    }));
  };

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        subtitle="Define what each role can access and do across modules"
        breadcrumbs={['Home', 'Administrator', 'Roles & Permissions']}
        actions={<button className="btn-primary"><Plus size={15} /> New Role</button>}
      />

      {/* Role cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {roleList.map((r) => (
          <button
            key={r.name}
            onClick={() => setActiveRole(r.name)}
            className={cn(
              'card-pad text-left transition-all',
              activeRole === r.name ? 'border-primary-300 ring-2 ring-primary-500/20' : 'hover:shadow-card-md',
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center', activeRole === r.name ? 'bg-primary-600 text-white' : 'bg-ink-100 text-ink-600')}>
                <ShieldCheck size={18} />
              </div>
              <Badge className="bg-ink-100 text-ink-600">{r.users} users</Badge>
            </div>
            <div className="font-semibold text-ink-900">{r.name}</div>
            <div className="text-xs text-ink-500 mt-0.5">{r.desc}</div>
          </button>
        ))}
      </div>

      {/* Module access */}
      <Card className="mb-6">
        <SectionHeader title={`${activeRole} — Module Access`} subtitle="Toggle which modules this role can open" />
        <div className="flex flex-wrap gap-2.5">
          {modules.map((m, i) => {
            const enabled = matrix[activeRole][i].some((v) => v);
            return (
              <button
                key={m}
                onClick={() => {
                  setMatrix((prev) => ({
                    ...prev,
                    [activeRole]: prev[activeRole].map((row: boolean[], ri: number) => ri === i ? (enabled ? [false, false, false, false, false, false, false] : [false, true, false, false, false, false, false]) : row),
                  }));
                }}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium border transition',
                  enabled ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-white border-ink-200 text-ink-500 hover:border-ink-300',
                )}
              >
                {enabled ? <Check size={14} /> : <Lock size={14} />}
                {m}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Permission matrix */}
      <Card pad={false} className="overflow-hidden">
        <div className="p-5 pb-3"><SectionHeader title="Feature Permissions" subtitle={`What the ${activeRole} role can do inside each module`} /></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="bg-ink-50/50 border-y border-ink-100">
              <tr>
                <th className="th sticky left-0 bg-ink-50/50">Module</th>
                {features.map((f) => <th key={f} className="th text-center">{f}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {modules.map((m, mi) => (
                <tr key={m} className="hover:bg-ink-50/30">
                  <td className="td font-medium text-ink-800 sticky left-0 bg-white">{m}</td>
                  {features.map((_, fi) => {
                    const checked = matrix[activeRole][mi][fi];
                    const moduleEnabled = matrix[activeRole][mi].some((v) => v);
                    return (
                      <td key={fi} className="td text-center">
                        <button
                          onClick={() => moduleEnabled && toggle(mi, fi)}
                          disabled={!moduleEnabled}
                          className={cn(
                            'h-5 w-5 rounded-md border inline-flex items-center justify-center transition mx-auto',
                            checked ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-ink-300 text-transparent',
                            !moduleEnabled && 'opacity-40 cursor-not-allowed',
                            moduleEnabled && !checked && 'hover:border-primary-400',
                          )}
                        >
                          <Check size={12} strokeWidth={3} />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-ink-100 flex items-center gap-4 text-xs text-ink-500">
          <span className="flex items-center gap-1.5"><span className="h-4 w-4 rounded bg-primary-600 border border-primary-600" /> Allowed</span>
          <span className="flex items-center gap-1.5"><span className="h-4 w-4 rounded bg-white border border-ink-300" /> Not allowed</span>
          <span className="flex items-center gap-1.5"><Lock size={12} /> Module disabled</span>
        </div>
      </Card>
    </div>
  );
}
