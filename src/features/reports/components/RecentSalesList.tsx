import { ReceiptText, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

import { MoneyText } from '@/components/common/MoneyText';
import { NumberText } from '@/components/common/NumberText';
import { usePreferences } from '@/features/settings/preferences';
import { formatDhakaTime } from '@/lib/datetime';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';

import type { RecentSale } from '../types';

/** Today's bills, newest first. Tapping one opens the receipt for a reprint. */
export function RecentSalesList({ sales }: { sales: readonly RecentSale[] }) {
  const { t } = useAppTranslation('reports');
  const numerals = usePreferences((s) => s.numerals);

  return (
    <ul className="space-y-2">
      {sales.map((sale) => {
        const voided = sale.status === 'voided';
        return (
          <li key={sale.id}>
            <Link
              to={`/sell/receipt/${sale.id}`}
              className="app-card flex min-h-touch items-center gap-3 p-3"
            >
              <span
                aria-hidden="true"
                className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground"
              >
                <ReceiptText className="size-4" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <span className="bn-digits">{sale.invoiceNo ?? t('noInvoice')}</span>
                  {voided ? (
                    <XCircle aria-label={t('voided')} className="size-3.5 text-money-out" />
                  ) : null}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  <span className="bn-digits">{formatDhakaTime(sale.createdAt, numerals)}</span>
                  {sale.customerName ? ` · ${sale.customerName}` : ''}
                  {' · '}
                  <NumberText value={sale.itemCount} maxDecimals={0} /> {t('itemsLabel')}
                </span>
              </span>

              <span className="shrink-0 text-end">
                <MoneyText
                  paisa={sale.totalPaisa}
                  className={voided ? 'text-muted-foreground line-through' : 'font-semibold'}
                />
                {sale.duePaisa > 0 && !voided ? (
                  <span className="block text-xs text-money-out">
                    {t('dueLine')} <MoneyText paisa={sale.duePaisa} tone="out" />
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
