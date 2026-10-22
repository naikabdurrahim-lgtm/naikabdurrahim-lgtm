import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

import { MoneyText } from '@/components/common/MoneyText';
import { Badge } from '@/components/ui/badge';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { formatDhakaDateTime } from '@/lib/datetime';
import { formatQuantityMilli } from '@/lib/quantity';
import { usePreferences } from '@/features/settings/preferences';

import type { Receipt } from '../types';

/**
 * A receipt, on screen.
 *
 * Paper and PDF come with printing in a later phase; the data here is already
 * the shape a printer needs (snapshot names, no cost, invoice number), so the
 * layout is the only thing that will change.
 */
export function ReceiptView({ receipt }: { receipt: Receipt }) {
  const { t } = useAppTranslation('pos');
  const { t: tc } = useAppTranslation('common');
  const numerals = usePreferences((s) => s.numerals);

  const unit = (code: Receipt['items'][number]['unitCode']) => tc(`units.${code}`);

  return (
    <article className="space-y-4 pb-6">
      <Link
        to="/sell"
        className="inline-flex min-h-touch items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {tc('actions.back')}
      </Link>

      <div className="app-card space-y-4 p-5">
        <header className="space-y-1 text-center">
          <p className="text-lg font-bold">{t('receiptTitle')}</p>
          <p className="text-sm text-muted-foreground">
            {t('receiptInvoice')} · {receipt.invoiceNo ?? '—'}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDhakaDateTime(receipt.createdAt, numerals)}
          </p>
          {receipt.status === 'voided' ? (
            <Badge variant="danger">{t('receiptVoided')}</Badge>
          ) : null}
        </header>

        {receipt.customerName ? (
          <p className="rounded-xl bg-secondary/40 p-3 text-sm">
            {t('receiptCustomer')}: <span className="font-medium">{receipt.customerName}</span>
          </p>
        ) : null}

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-start text-xs text-muted-foreground">
              <th scope="col" className="py-2 text-start font-medium">
                {t('receiptItems')}
              </th>
              <th scope="col" className="py-2 text-end font-medium">
                {t('receiptQty')}
              </th>
              <th scope="col" className="py-2 text-end font-medium">
                {t('receiptLineTotal')}
              </th>
            </tr>
          </thead>
          <tbody>
            {receipt.items.map((item) => (
              <tr key={item.id} className="border-b border-border/50">
                <td className="py-2 pe-2">
                  <span className="block font-medium leading-tight">{item.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    <MoneyText paisa={item.unitPricePaisa} />
                    {' / '}
                    {unit(item.unitCode)}
                  </span>
                </td>
                <td className="py-2 text-end tabular-nums">
                  {formatQuantityMilli(item.qtyMilli, { numerals })}
                </td>
                <td className="py-2 text-end">
                  <MoneyText paisa={item.lineTotalPaisa} className="font-medium" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="space-y-1 text-sm">
          <Row label={t('subtotal')} paisa={receipt.subtotalPaisa} />
          {receipt.discountPaisa > 0 ? (
            <Row
              label={`${t('discount')}${receipt.discountKind === 'percent' ? ' (%)' : ''}`}
              paisa={-receipt.discountPaisa}
            />
          ) : null}
          <Row label={t('total')} paisa={receipt.totalPaisa} strong />
          <Row label={t('paid')} paisa={receipt.paidPaisa} />
          {receipt.duePaisa > 0 ? (
            <Row label={t('dueLine')} paisa={receipt.duePaisa} tone="out" />
          ) : null}
        </dl>

        {receipt.note ? (
          <p className="rounded-xl bg-secondary/40 p-3 text-xs text-muted-foreground">
            {receipt.note}
          </p>
        ) : null}

        <footer className="border-t border-border pt-3 text-center text-sm">
          <p>{receipt.footer ?? t('receiptFooterFallback')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('receiptPrintSoon')}</p>
        </footer>
      </div>
    </article>
  );
}

function Row({
  label,
  paisa,
  strong = false,
  tone = 'default',
}: {
  label: string;
  paisa: number;
  strong?: boolean;
  tone?: 'default' | 'out';
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={strong ? 'font-semibold' : 'text-muted-foreground'}>{label}</dt>
      <dd>
        <MoneyText
          paisa={paisa}
          className={
            strong ? 'text-base font-bold' : tone === 'out' ? 'font-medium text-money-out' : ''
          }
        />
      </dd>
    </div>
  );
}
