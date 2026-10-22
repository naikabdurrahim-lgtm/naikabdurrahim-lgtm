import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

type Tone = 'primary' | 'due' | 'stock' | 'today' | 'neutral';

const toneClasses: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary hover:bg-primary/20',
  due: 'bg-money-out/10 text-money-out hover:bg-money-out/20',
  stock: 'bg-warning/10 text-warning hover:bg-warning/20',
  today: 'bg-money-in/10 text-money-in hover:bg-money-in/20',
  neutral: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
};

type BigActionButtonProps = {
  icon: LucideIcon;
  label: string;
  hint?: string;
  to: string;
  tone?: Tone;
  className?: string;
};

/**
 * The 4 large home actions in Simple Mode (PROJECT_RULES 3.1 #4).
 * Icon + colour + Bangla label together, 56px+ target, works one-handed.
 */
export function BigActionButton({
  icon: Icon,
  label,
  hint,
  to,
  tone = 'neutral',
  className,
}: BigActionButtonProps) {
  return (
    <Link
      to={to}
      className={cn(
        'group flex min-h-[7.5rem] flex-col justify-between rounded-2xl border border-border/60 p-4 transition active:scale-[0.98]',
        toneClasses[tone],
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-xl bg-background/60">
        <Icon aria-hidden="true" className="size-7" />
      </span>
      <span className="space-y-0.5">
        <span className="block text-lg font-semibold leading-tight">{label}</span>
        {hint ? <span className="block text-xs opacity-80">{hint}</span> : null}
      </span>
    </Link>
  );
}
