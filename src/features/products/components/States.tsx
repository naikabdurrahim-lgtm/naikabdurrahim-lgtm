import { PackagePlus, RotateCw, SearchX } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * The three states every list in this app must have, so nobody ever sees a blank
 * screen: loading (skeleton), failure (retry), empty (next step).
 */

export function ProductListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="app-card flex items-center gap-3 p-3">
          <div className="skeleton size-11 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-2/3" />
            <div className="skeleton h-3 w-1/3" />
          </div>
          <div className="skeleton h-4 w-14" />
        </div>
      ))}
    </div>
  );
}

export function ErrorPanel({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <div className="app-card space-y-3 p-5 text-center" role="alert">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button type="button" variant="secondary" className="w-full" onClick={onRetry}>
        <RotateCw aria-hidden="true" />
        {retryLabel}
      </Button>
    </div>
  );
}

export function EmptyPanel({
  title,
  body,
  actionLabel,
  onAction,
  searching = false,
}: {
  title: string;
  body: string;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
  searching?: boolean;
}) {
  const Icon = searching ? SearchX : PackagePlus;

  return (
    <div className="app-card space-y-3 p-6 text-center">
      <span
        aria-hidden="true"
        className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-muted-foreground"
      >
        <Icon className="size-7" />
      </span>
      <p className="text-base font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{body}</p>
      {actionLabel && onAction ? (
        <Button type="button" size="lg" className="w-full" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
