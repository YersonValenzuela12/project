import {
  FileDown, FileSpreadsheet, Calendar, TrendingUp, Clock, CheckCircle2, AlertTriangle, Filter,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, SectionHeader, Badge, ProgressBar } from '@/components/ui';
import { LineChart, BarChart, DonutChart, HorizontalBars } from '@/components/charts';
import { monthlyWO, woByType, techPerformance } from '@/data/mockData';

export function ReportsPage() {
  const slaData = [
    { label: 'CCTV', value: 94, color: '#2563eb' },
    { label: 'Access Ctrl', value: 89, color: '#0891b2' },
    { label: 'Fire Alarm', value: 97, color: '#dc2626' },
    { label: 'Fire Water', value: 82, color: '#ea580c' },
    { label: 'BMS', value: 91, color: '#7c3aed' },
    { label: 'Elec. Sec', value: 88, color: '#16a34a' },
  ];

  const completion = [
    { label: 'Mon', value: 18 }, { label: 'Tue', value: 22 }, { label: 'Wed', value: 15 },
    { label: 'Thu', value: 26 }, { label: 'Fri', value: 20 }, { label: 'Sat', value: 8 }, { label: 'Sun', value: 3 },
  ];

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Operational performance, SLA compliance, and workforce insights"
        breadcrumbs={['Home', 'Administrator', 'Reports']}
        actions={
          <>
            <button className="btn-secondary"><Filter size={15} /> Date range: Jul–Aug 2026</button>
            <button className="btn-secondary"><FileSpreadsheet size={15} /> Export Excel</button>
            <button className="btn-primary"><FileDown size={15} /> Export PDF</button>
          </>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Avg Response Time" value="2h 14m" icon={Clock} trend="-18% vs last month" up />
        <KpiCard label="First-Time Fix Rate" value="87.4%" icon={CheckCircle2} trend="+3.2%" up />
        <KpiCard label="SLA Compliance" value="92.1%" icon={TrendingUp} trend="+1.4%" up />
        <KpiCard label="Overdue Jobs" value="6" icon={AlertTriangle} trend="-2" up />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <SectionHeader title="Work Order Volume Trend" subtitle="Monthly created vs completed" action={<Badge className="bg-emerald-50 text-emerald-700">Trending up</Badge>} />
          <LineChart data={monthlyWO.map((m) => ({ label: m.month, value: m.value }))} height={240} />
        </Card>
        <Card>
          <SectionHeader title="By Service Type" subtitle="Q3 distribution" />
          <DonutChart data={woByType.map((d) => ({ label: d.type, value: d.value, color: d.color }))} centerLabel="146" centerSub="work orders" />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <SectionHeader title="SLA Compliance by Service" subtitle="Target: 90%" />
          <HorizontalBars data={slaData} unit="%" />
        </Card>
        <Card>
          <SectionHeader title="Jobs Completed — This Week" subtitle="Daily completion count" />
          <BarChart data={completion} height={220} color="#16a34a" />
        </Card>
      </div>

      {/* Tech performance table */}
      <Card pad={false} className="overflow-hidden">
        <div className="p-5 pb-3"><SectionHeader title="Technician Performance Leaderboard" subtitle="Aug 2026 · ranked by completed jobs" /></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-ink-50/50 border-y border-ink-100">
              <tr>
                <th className="th">#</th><th className="th">Technician</th><th className="th">Completed</th>
                <th className="th">SLA %</th><th className="th">Avg Rating</th><th className="th w-48">Utilization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {techPerformance.map((t, i) => (
                <tr key={t.name} className="hover:bg-ink-50/40">
                  <td className="td"><span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-ink-100 text-ink-600'}`}>{i + 1}</span></td>
                  <td className="td font-medium text-ink-900">{t.name}</td>
                  <td className="td font-semibold text-ink-900">{t.completed}</td>
                  <td className="td"><Badge className={t.sla >= 95 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}>{t.sla}%</Badge></td>
                  <td className="td text-ink-700">{'★'.repeat(Math.round(t.sla / 20))}<span className="text-ink-300">{'★'.repeat(5 - Math.round(t.sla / 20))}</span></td>
                  <td className="td"><div className="flex items-center gap-2"><ProgressBar value={Math.min(100, t.completed * 3)} barClass="bg-primary-600" /><span className="text-xs text-ink-500 w-9">{Math.min(99, t.completed * 3)}%</span></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, trend, up }: { label: string; value: string; icon: typeof Clock; trend: string; up?: boolean }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <div className="h-9 w-9 rounded-lg bg-ink-100 text-ink-600 flex items-center justify-center"><Icon size={18} /></div>
        <span className={`text-xs font-semibold ${up ? 'text-emerald-600' : 'text-red-600'}`}>{trend}</span>
      </div>
      <div className="text-2xl font-bold text-ink-900">{value}</div>
      <div className="text-sm text-ink-500">{label}</div>
    </Card>
  );
}
