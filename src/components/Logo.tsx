import { cn } from '@/lib/utils';

export function Logo({
  size = 'md',
  showText = true,
  light = false,
  onClick,
}: {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  light?: boolean;
  onClick?: () => void;
}) {
  const box = { sm: 'h-7 w-7', md: 'h-9 w-9', lg: 'h-11 w-11' };
  const text = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' };
  return (
    <div
      className={cn('flex items-center gap-2.5', onClick && 'cursor-pointer select-none')}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <div className={cn('rounded-lg bg-white flex items-center justify-center shadow-sm p-1', box[size])}>
        <img src="/logo-icon.png" alt="Selecom" className="h-full w-full object-contain" />
      </div>
      {showText && (
        <div className="leading-tight">
          <div className={cn('font-bold tracking-tight', text[size], light ? 'text-white' : 'text-ink-900')}><span className="text-primary-500">Electronics Selecom</span></div>
          <div className={cn('text-[10px] font-medium uppercase tracking-wider', light ? 'text-white/60' : 'text-ink-400')}></div>
        </div>
      )}
    </div>
  );
}
