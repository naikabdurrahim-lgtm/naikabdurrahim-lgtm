import { CalendarClock, Users, Wallet } from 'lucide-react';

import { MoneyText } from '@/components/common/MoneyText';
import { Skeleton } from '@/components/ui/skeleton';
import { usePreferences } from '@/features/settings/preferences';
import { formatDhakaDate } from '@/lib/datetime';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';

import type { DueSummary } from '../types';

/**
 * The one number the shopkeeper came for: how much is owed to the shop. It is
 * read from `due_summary()` (0014), so it is the ledger total, not the sum of
 * the rows currently on screen.
 */
export function DueSummaryCard({
  summary,
  loading = false,
}: {
  summary: DueSummary | undefined;
  loading?: boolean;
}) {
  const { t } = useAppTranslation('customers');
  const numerals = usePreferences((s) => s.numerals);

  return (
    <section className="app-card space-y-3 p-4" aria-label={t('due.totalLabel')}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Wallet aria-hidden="true" className="size-4" />
        <span className="text-xs font-medium">{t('due.totalLabel')}</span>
      </div>

      {loading ? (
        <Skeleton className="h-9 w-40" />
      ) : (
        <MoneyText
          paisa={summary?.totalDuePaisa ?? 0}
          tone="out"
          className="block text-3xl font-bold"
        />
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Users aria-hidden="true" className="size-3.5" />
          {t('due.debtorCount', {
            formatted: new Intl.NumberFormat(numerals === 'bn' ? 'bn-BD' : 'en-US').format(
              summary?.debtorCount ?? 0,
            ),
          })}
        </span>
        {summary?.oldestDueAt ? (
          <span className="inline-flex items-center gap-1">
            <CalendarClock aria-hidden="true" className="size-3.5" />
            {t('due.oldest', { date: formatDhakaDate(summary.oldestDueAt, numerals) })}
          </span>
        ) : null}
      </div>
    </section>
  );
}
