import { RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * The failure state every data screen needs: a plain sentence and one retry
 * button. Never a raw Postgres or network message (PROJECT_RULES 3.1 #10).
 */
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
