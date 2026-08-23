import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export function Avatar({
  initials, color = 'bg-primary-600', size = 'md', ring = false,
}: { initials: string; color?: string; size?: 'xs' | 'sm' | 'md' | 'lg'; ring?: boolean }) {
  const sizes = {
    xs: 'h-6 w-6 text-[10px]',
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-base',
  };
  return (
    <span className={cn(
      'inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0',
      color, sizes[size], ring && 'ring-2 ring-white',
    )}>
      {initials}
    </span>
  );
}

export function Badge({
  children, className,
}: { children: ReactNode; className?: string }) {
  return <span className={cn('chip', className)}>{children}</span>;
}

export function StatusDot({ className }: { className?: string }) {
  return <span className={cn('h-1.5 w-1.5 rounded-full', className)} />;
}

export function ProgressBar({
  value, className, barClass = 'bg-primary-600',
}: { value: number; className?: string; barClass?: string }) {
  return (
    <div className={cn('h-1.5 w-full rounded-full bg-ink-100 overflow-hidden', className)}>
      <div className={cn('h-full rounded-full transition-all', barClass)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Card({
  children, className, pad = true,
}: { children: ReactNode; className?: string; pad?: boolean }) {
  return <div className={cn(pad ? 'card-pad' : 'card', className)}>{children}</div>;
}

export function SectionHeader({
  title, subtitle, action,
}: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h3 className="section-title">{title}</h3>
        {subtitle && <p className="text-sm text-ink-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Tabs({
  tabs, active, onChange,
}: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="flex gap-1 border-b border-ink-200">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            active === t ? 'border-primary-600 text-primary-700' : 'border-transparent text-ink-500 hover:text-ink-800',
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

export function Modal({
  open, onClose, title, children, footer, size = 'md',
}: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-[1px]" onClick={onClose} />
      <div className={cn('relative bg-white rounded-2xl shadow-pop w-full animate-scale-in max-h-[90vh] flex flex-col', widths[size])}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100">
          <h3 className="text-base font-semibold text-ink-900">{title}</h3>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700 text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-ink-100 flex justify-end gap-2 bg-ink-50/50 rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="h-12 w-12 rounded-full bg-ink-100 flex items-center justify-center text-ink-400 mb-3">{icon}</div>
      <p className="text-sm font-medium text-ink-700">{title}</p>
      {subtitle && <p className="text-sm text-ink-400 mt-1">{subtitle}</p>}
    </div>
  );
}

export function Breadcrumb({ items }: { items: string[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-ink-300">/</span>}
          <span className={i === items.length - 1 ? 'text-ink-900 font-medium' : 'text-ink-500'}>{it}</span>
        </span>
      ))}
    </nav>
  );
}

export function FullPageLoader({ label }: { label?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-ink-50">
      <div className="h-10 w-10 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      {label && <p className="mt-4 text-sm text-ink-500">{label}</p>}
    </div>
  );
}
