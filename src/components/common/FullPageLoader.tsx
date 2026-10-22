import { Loader2 } from 'lucide-react';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Shown while the session is being restored. A skeleton of the real layout,
 * so the screen does not jump when content arrives.
 */
export function FullPageLoader() {
  const { t } = useAppTranslation();

  return (
    <div className="min-h-dvh bg-background p-4" role="status" aria-live="polite">
      <span className="sr-only">{t('a11y.loading')}</span>
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <div className="flex items-center gap-3 py-3">
          <Skeleton className="size-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
        <Skeleton className="h-28 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
        <div className="flex items-center justify-center gap-2 pt-4 text-sm text-muted-foreground">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          {t('a11y.loading')}
        </div>
      </div>
    </div>
  );
}
