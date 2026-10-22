import { ArrowDownLeft, ArrowUpRight, ReceiptText } from 'lucide-react';
import { Link } from 'react-router-dom';

import { MoneyText } from '@/components/common/MoneyText';
import { usePreferences } from '@/features/settings/preferences';
import { formatDhakaDateTime } from '@/lib/datetime';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { cn } from '@/lib/utils';

import type { LedgerEntry } from '../types';

/**
 * One line of the খাতা.
 *
 * `debit` means the customer owes more (a credit sale); `credit` means they paid
 * something. The running balance sits under the amount, which is what an
 * argument at the counter actually needs.
 */
export function KhataRow({ entry }: { entry: LedgerEntry }) {
  const { t } = useAppTranslation('customers');
  const numerals = usePreferences((s) => s.numerals);

  const isDebit = entry.entryType === 'debit';
  const Icon = isDebit ? ArrowUpRight : ArrowDownLeft;

  return (
    <li className="app-card flex items-start gap-3 p-3">
      <span
        aria-hidden="true"
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-lg',
          isDebit ? 'bg-money-out/10 text-money-out' : 'bg-money-in/10 text-money-in',
        )}
      >
        <Icon className="size-5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {entry.note ?? (isDebit ? t('ledger.saleEntry') : t('ledger.paymentEntry'))}
        </p>
        <p className="bn-digits text-xs text-muted-foreground">
          {formatDhakaDateTime(entry.occurredAt, numerals)}
        </p>
        {entry.saleId && entry.invoiceNo ? (
          <Link
            to={`/sell/receipt/${entry.saleId}`}
            className="mt-1 inline-flex min-h-touch items-center gap-1 text-xs font-medium text-primary"
          >
            <ReceiptText aria-hidden="true" className="size-3.5" />
            <span className="bn-digits">{entry.invoiceNo}</span>
          </Link>
        ) : null}
      </div>

      <div className="shrink-0 text-end">
        <p className="text-sm font-semibold">
          <span aria-hidden="true" className={isDebit ? 'text-money-out' : 'text-money-in'}>
            {isDebit ? '+' : '−'}
          </span>{' '}
          <MoneyText paisa={entry.amountPaisa} withSymbol />
        </p>
        <p className="text-xs text-muted-foreground">
          {t('ledger.after')} <MoneyText paisa={entry.balanceAfterPaisa} />
        </p>
      </div>
    </li>
  );
}
