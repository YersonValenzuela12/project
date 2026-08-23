import { cn } from '@/lib/utils';
import { Breadcrumb } from '@/components/ui';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function PageHeader({
  title, subtitle, breadcrumbs, actions,
}: { title: string; subtitle?: string; breadcrumbs?: string[]; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
      <div>
        {breadcrumbs && <div className="mb-2"><Breadcrumb items={breadcrumbs} /></div>}
        <h1 className="text-2xl font-bold text-ink-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-ink-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label, value, icon: Icon, iconColor = 'bg-primary-50 text-primary-600', delta, spark,
}: {
  label: string; value: string | number; icon: LucideIcon;
  iconColor?: string; delta?: { value: string; up: boolean }; spark?: ReactNode;
}) {
  return (
    <div className="card-pad hover:shadow-card-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', iconColor)}>
          <Icon size={20} />
        </div>
        {delta && (
          <span className={cn('text-xs font-semibold', delta.up ? 'text-emerald-600' : 'text-red-600')}>
            {delta.up ? '▲' : '▼'} {delta.value}
          </span>
        )}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-ink-900 tabular-nums">{value}</div>
        <div className="text-sm text-ink-500 mt-0.5">{label}</div>
      </div>
      {spark && <div className="mt-2">{spark}</div>}
    </div>
  );
}
