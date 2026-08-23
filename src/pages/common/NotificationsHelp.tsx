import { Bell, CheckCircle2, Clock, Filter, Search, BookOpen, ClipboardList, CalendarDays, FileText, BarChart3, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, Badge, SectionHeader, Tabs } from '@/components/ui';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { notifications } from '@/data/mockData';

export function NotificationsPage() {
  const [tab, setTab] = useState('All');
  const items = [
    ...notifications,
    { id: 'n6', title: 'Work order assigned', body: 'WO-2026-1010 assigned to you by Marcus Delgado.', time: '2 days ago', unread: false, color: 'bg-primary-500' },
    { id: 'n7', title: 'Form approved', body: 'Your Mobility Form for Jul 2026 was approved.', time: '3 days ago', unread: false, color: 'bg-emerald-500' },
  ];
  return (
    <div>
      <PageHeader title="Notifications" subtitle="All your alerts and updates in one place" breadcrumbs={['Home', 'Notifications']} actions={<button className="btn-secondary"><CheckCircle2 size={15} /> Mark all read</button>} />
      <Card pad={false}>
        <div className="p-4 border-b border-ink-100 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input placeholder="Search notifications…" className="input pl-9 h-9" /></div>
          <button className="btn-secondary h-9"><Filter size={14} /> Filter</button>
        </div>
        <div className="px-4 pt-3"><Tabs tabs={['All', 'Unread', 'Work Orders', 'System']} active={tab} onChange={setTab} /></div>
        <div className="divide-y divide-ink-50 mt-2">
          {items.map((n) => (
            <div key={n.id} className={cn('flex items-start gap-4 px-5 py-4 hover:bg-ink-50/40 cursor-pointer', n.unread && 'bg-primary-50/30')}>
              <span className={cn('h-9 w-9 rounded-lg flex items-center justify-center text-white shrink-0', n.color)}><Bell size={16} /></span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><span className="text-sm font-semibold text-ink-900">{n.title}</span>{n.unread && <span className="h-2 w-2 rounded-full bg-primary-500" />}</div>
                <p className="text-sm text-ink-600 mt-0.5">{n.body}</p>
                <span className="text-xs text-ink-400 mt-1 flex items-center gap-1"><Clock size={11} /> {n.time}</span>
              </div>
              <Badge className={n.unread ? 'bg-primary-50 text-primary-700' : 'bg-ink-100 text-ink-500'}>{n.unread ? 'New' : 'Read'}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function HelpPage() {
  return (
    <div>
      <PageHeader title="Help Center" subtitle="Guides, articles, and support" breadcrumbs={['Home', 'Help Center']} />
      <div className="relative max-w-xl mb-6">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
        <input placeholder="Search for help articles…" className="input pl-11 h-11 text-sm" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { t: 'Getting Started', d: 'Setup guides and onboarding', c: 'bg-primary-50 text-primary-600', n: 12, icon: BookOpen },
          { t: 'Work Orders', d: 'Create, assign, and complete jobs', c: 'bg-emerald-50 text-emerald-600', n: 18, icon: ClipboardList },
          { t: 'Calendar & Scheduling', d: 'Plan and dispatch technicians', c: 'bg-amber-50 text-amber-600', n: 9, icon: CalendarDays },
          { t: 'Documents & Forms', d: 'Upload, fill, and submit', c: 'bg-violet-50 text-violet-600', n: 7, icon: FileText },
          { t: 'Reports & Analytics', d: 'Understand performance metrics', c: 'bg-cyan-50 text-cyan-600', n: 5, icon: BarChart3 },
          { t: 'Account & Security', d: 'Profile, roles, and access', c: 'bg-red-50 text-red-600', n: 6, icon: ShieldCheck },
        ].map((cat) => (
          <Card key={cat.t} className="hover:shadow-card-md transition cursor-pointer">
            <div className={cn('h-11 w-11 rounded-lg flex items-center justify-center mb-3', cat.c)}><cat.icon size={22} /></div>
            <div className="font-semibold text-ink-900">{cat.t}</div>
            <div className="text-sm text-ink-500 mt-0.5">{cat.d}</div>
            <div className="text-xs text-primary-600 font-medium mt-3">{cat.n} articles →</div>
          </Card>
        ))}
      </div>
      <Card>
        <SectionHeader title="Popular Articles" />
        <div className="divide-y divide-ink-50">
          {['How to create and assign a work order', 'Understanding work order statuses', 'Submitting a completed job checklist', 'Uploading before/after photos', 'Requesting medical leave', 'Reading your weekly schedule'].map((a, i) => (
            <a key={i} className="flex items-center justify-between py-3 hover:bg-ink-50/40 px-2 cursor-pointer">
              <span className="text-sm text-ink-800">{a}</span><span className="text-xs text-primary-600 font-medium">Read →</span>
            </a>
          ))}
        </div>
      </Card>
    </div>
  );
}
