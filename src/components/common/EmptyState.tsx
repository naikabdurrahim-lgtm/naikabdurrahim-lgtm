import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

/**
 * Helpful empty state: friendly icon, one sentence, one big button
 * (PROJECT_RULES 3.1 #10).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 p-6 text-center', className)}>
      <div className="grid size-16 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon aria-hidden="true" className="size-8" />
      </div>
      <p className="text-base font-semibold">{title}</p>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      {actionLabel && onAction ? (
        <Button size="lg" className="mt-2 min-h-cta w-full max-w-xs" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
