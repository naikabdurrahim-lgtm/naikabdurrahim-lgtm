import { CloudOff, RefreshCw, Wifi } from 'lucide-react';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { cn } from '@/lib/utils';

/**
 * Calm connectivity status (PROJECT_RULES 3.1 #13). Phase 9 replaces the
 * `syncing` branch with real outbox state; the visual contract stays the same.
 */
export function SyncStatusPill({ className }: { className?: string }) {
  const online = useOnlineStatus();
  const { t } = useAppTranslation();

  const Icon = online ? Wifi : CloudOff;
  const label = online ? t('status.online') : t('status.offline');

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        online
          ? 'border-money-in/25 bg-money-in/10 text-money-in'
          : 'border-warning/30 bg-warning/10 text-warning',
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {label}
      {!online ? <RefreshCw aria-hidden="true" className="hidden size-3.5" /> : null}
    </span>
  );
}
