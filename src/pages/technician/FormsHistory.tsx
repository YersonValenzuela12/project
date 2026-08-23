import { useState } from 'react';
import { Car, HeartPulse, MessageSquareWarning, Receipt, FileText, PenLine, Check, ChevronLeft, Download } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, SectionHeader, Badge, Modal } from '@/components/ui';
import { cn } from '@/lib/utils';
import { forms, technicianHistory, statusColor, statusLabel } from '@/data/mockData';

const iconMap: Record<string, typeof Car> = { Car, HeartPulse: HeartPulse, MessageSquareWarning, Receipt };

export function FormsPage() {
  const [active, setActive] = useState<string | null>(null);
  const form = forms.find((f) => f.id === active);
  const [submitted, setSubmitted] = useState(false);

  return (
    <div>
      <PageHeader title="Forms" subtitle="Submit and track your field and HR forms" breadcrumbs={['Home', 'Technician', 'Forms']} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {forms.map((f) => {
          const Icon = iconMap[f.icon] ?? FileText;
          return (
            <button key={f.id} onClick={() => { setActive(f.id); setSubmitted(false); }} className="card-pad text-left group hover:shadow-card-md hover:border-primary-200 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="h-11 w-11 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center group-hover:bg-primary-600 group-hover:text-white transition-colors"><Icon size={22} /></div>
                <Badge className="bg-emerald-50 text-emerald-700">Available</Badge>
              </div>
              <div className="font-semibold text-ink-900">{f.name}</div>
              <div className="text-sm text-ink-500 mt-1">{f.desc}</div>
              <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary-600 group-hover:text-primary-700">Start form <ChevronLeft size={14} className="rotate-180" /></div>
            </button>
          );
        })}
      </div>

      {/* Recent submissions */}
      <Card className="mt-6" pad={false}>
        <div className="p-5 pb-3"><SectionHeader title="Recent Submissions" /></div>
        <div className="divide-y divide-ink-50">
          {[
            { form: 'Mobility Form', period: 'Jul 2026', status: 'approved', date: 'Aug 1' },
            { form: 'Expense Claim', period: 'Jul 2026', status: 'pending', date: 'Aug 3' },
            { form: 'Mobility Form', period: 'Jul 2026', status: 'approved', date: 'Jul 2' },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5">
              <div className="h-9 w-9 rounded-lg bg-ink-100 text-ink-600 flex items-center justify-center"><FileText size={17} /></div>
              <div className="flex-1"><div className="text-sm font-medium text-ink-900">{s.form}</div><div className="text-xs text-ink-500">{s.period} · submitted {s.date}</div></div>
              <Badge className={s.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}>{s.status}</Badge>
              <button className="h-8 w-8 rounded-md hover:bg-ink-100 flex items-center justify-center text-ink-500"><Download size={15} /></button>
            </div>
          ))}
        </div>
      </Card>

      {/* Form modal */}
      <Modal
        open={!!form}
        onClose={() => setActive(null)}
        title={form?.name ?? ''}
        size="lg"
        footer={submitted ? (
          <button className="btn-primary" onClick={() => setActive(null)}>Done</button>
        ) : (
          <>
            <button className="btn-secondary" onClick={() => setActive(null)}>Cancel</button>
            <button className="btn-primary" onClick={() => setSubmitted(true)}><PenLine size={15} /> Sign & Submit</button>
          </>
        )}
      >
        {form && !submitted && <FormBody name={form.name} />}
        {submitted && (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3"><Check size={28} strokeWidth={3} /></div>
            <div className="text-lg font-semibold text-ink-900">Form submitted</div>
            <p className="text-sm text-ink-500 mt-1">Your {form?.name ?? 'form'} has been sent for approval. You'll be notified when it's reviewed.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function FormBody({ name }: { name: string }) {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-primary-50/50 border border-primary-100 text-sm text-primary-800">
        <span className="font-semibold">{name}</span> — all fields marked with * are required. Your digital signature will be applied on submission.
      </div>
      {name === 'Mobility Form' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Vehicle *</label><input className="input" defaultValue="Ford — ST-2841" /></div>
            <div><label className="label">Period *</label><input className="input" defaultValue="Aug 1 – Aug 7, 2026" /></div>
            <div><label className="label">Start mileage *</label><input className="input" defaultValue="48,210 km" /></div>
            <div><label className="label">End mileage *</label><input className="input" placeholder="48,XXX km" /></div>
          </div>
          <div><label className="label">Routes traveled</label><textarea className="input min-h-[80px]" defaultValue="full Details." /></div>
        </>
      )}
      {name === 'Medical Leave Form' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Leave type *</label><select className="input"><option>Sick leave</option><option>Medical procedure</option><option>Recovery</option></select></div>
            <div><label className="label">Days requested *</label><input className="input" defaultValue="3" /></div>
            <div><label className="label">From *</label><input type="date" className="input" /></div>
            <div><label className="label">To *</label><input type="date" className="input" /></div>
          </div>
          <div><label className="label">Reason / notes</label><textarea className="input min-h-[80px]" placeholder="Brief description…" /></div>
        </>
      )}
      {(name === 'Complaint Form' || name === 'Expense Claim') && (
        <>
          <div><label className="label">Subject *</label><input className="input" placeholder="Brief subject" /></div>
          <div><label className="label">Date *</label><input type="date" className="input" /></div>
          <div><label className="label">Details *</label><textarea className="input min-h-[120px]" placeholder="Provide full details…" /></div>
          {name === 'Expense Claim' && (
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Amount *</label><input className="input" placeholder="S/. 0.00" /></div>
              <div><label className="label">Category *</label><select className="input"><option>Materials</option><option>Travel</option><option>Equipment</option><option>Other</option></select></div>
            </div>
          )}
        </>
      )}

      {/* Signature */}
      <div className="pt-4 border-t border-ink-100">
        <label className="label">Digital signature</label>
        <div className="rounded-lg border-2 border-dashed border-ink-200 bg-ink-50/40 h-24 flex items-center justify-center text-ink-400">
          <div className="text-center">
            <PenLine size={20} className="mx-auto mb-1" />
            <span className="text-xs">Click to sign — D. Okafor</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HistoryPage() {
  return (
    <div>
      <PageHeader title="My History" subtitle="Completed work orders, reports, and submitted documents" breadcrumbs={['Home', 'Technician', 'History']} />

      <Card pad={false} className="overflow-hidden mb-6">
        <div className="p-5 pb-3"><SectionHeader title="Completed Work Orders" subtitle={`${technicianHistory.length} jobs this quarter`} /></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-ink-50/50 border-y border-ink-100">
              <tr><th className="th">Work order</th><th className="th">Client</th><th className="th">Service</th><th className="th">Date</th><th className="th">Status</th><th className="th">Rating</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {technicianHistory.map((h) => (
                <tr key={h.id} className="hover:bg-ink-50/40">
                  <td className="td font-mono text-xs font-semibold text-primary-700">{h.code}</td>
                  <td className="td font-medium text-ink-900">{h.client}</td>
                  <td className="td text-ink-600">{h.type}</td>
                  <td className="td text-ink-500">{h.date}</td>
                  <td className="td"><Badge className={statusColor('completed')}>{statusLabel('completed')}</Badge></td>
                  <td className="td"><span className="text-amber-400">{'★'.repeat(h.rating)}</span><span className="text-ink-200">{'★'.repeat(5 - h.rating)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card pad={false}>
          <div className="p-5 pb-3"><SectionHeader title="Uploaded Reports" /></div>
          <div className="divide-y divide-ink-50">
            {['WO-2026-1006 — CCTV PM Report.pdf', 'WO-2026-1007 — Sensor Replacement.pdf', 'WO-2026-0987 — Badge Reader Fix.pdf'].map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50/40">
                <div className="h-9 w-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center"><FileText size={16} /></div>
                <div className="flex-1 min-w-0"><div className="text-sm font-medium text-ink-900 truncate">{r}</div><div className="text-xs text-ink-500">PDF · 1.2 MB</div></div>
                <button className="h-8 w-8 rounded-md hover:bg-ink-100 flex items-center justify-center text-ink-500"><Download size={15} /></button>
              </div>
            ))}
          </div>
        </Card>
        <Card pad={false}>
          <div className="p-5 pb-3"><SectionHeader title="Uploaded Photos" /></div>
          <div className="grid grid-cols-3 gap-2 p-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-square rounded-lg overflow-hidden bg-ink-100">
                <img src={`https://images.pexels.com/photos/${[264819, 264819, 264819, 264819, 264819, 264819][i - 1]}/pexels-photo-${[264819, 264819, 264819, 264819, 264819, 264819][i - 1]}.jpeg?auto=compress&cs=tinysrgb&w=200`} alt="Job photo" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export const _cn = cn;
