import type { LucideIcon } from 'lucide-react';
import { MoneyText } from '@/components/common/MoneyText';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type StatCardProps = {
  icon: LucideIcon;
  label: string;
  /** `null` renders a placeholder dash: no data yet (never a fake zero). */
  paisa: number | null;
  tone?: 'default' | 'in' | 'out';
  loading?: boolean;
  className?: string;
};

/** Dashboard tile: icon + label + amount, colour-coded by meaning. */
export function StatCard({
  icon: Icon,
  label,
  paisa,
  tone = 'default',
  loading = false,
  className,
}: StatCardProps) {
  return (
    <div className={cn('app-card flex flex-col gap-2 p-4', className)}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon aria-hidden="true" className="size-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-7 w-24" />
      ) : paisa === null ? (
        <span className="text-2xl font-bold text-muted-foreground/60" aria-label="—">
          —
        </span>
      ) : (
        <MoneyText paisa={paisa} tone={tone} className="text-2xl font-bold" />
      )}
    </div>
  );
}
