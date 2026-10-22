import { CheckCircle2, Printer, RotateCcw, ShoppingBasket } from 'lucide-react';
import { Link } from 'react-router-dom';

import { MoneyText } from '@/components/common/MoneyText';
import { Button } from '@/components/ui/button';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';

import type { SaleResult } from '../types';

type SaleSuccessProps = {
  sale: SaleResult;
  /** Money the customer is owed back, computed from the bill before it was cleared. */
  changePaisa: number;
  canVoid: boolean;
  secondsLeft: number;
  voiding: boolean;
  onUndo: () => void;
  onNewSale: () => void;
};

/**
 * What the shopkeeper sees the instant the sale is saved.
 *
 * The three numbers they must not get wrong — total, paid and change — are the
 * biggest things on the screen, and the undo is right there for the ten seconds
 * where a mistyped quantity is still cheap to fix.
 */
export function SaleSuccess({
  sale,
  changePaisa,
  canVoid,
  secondsLeft,
  voiding,
  onUndo,
  onNewSale,
}: SaleSuccessProps) {
  const { t } = useAppTranslation('pos');

  return (
    <div className="space-y-4">
      <div className="app-card space-y-3 p-5 text-center">
        <span
          aria-hidden="true"
          className="mx-auto grid size-14 place-items-center rounded-full bg-money-in/15 text-money-in"
        >
          <CheckCircle2 className="size-8" />
        </span>
        <div className="space-y-1">
          <h1 className="text-xl font-bold">{t('success')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('successBody', { invoice: sale.invoiceNo ?? '—' })}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-start">
          <div className="rounded-xl bg-secondary/40 p-3">
            <dt className="text-xs text-muted-foreground">{t('total')}</dt>
            <dd>
              <MoneyText paisa={sale.totalPaisa} className="text-lg font-bold" />
            </dd>
          </div>
          <div className="rounded-xl bg-secondary/40 p-3">
            <dt className="text-xs text-muted-foreground">{t('paid')}</dt>
            <dd>
              <MoneyText paisa={sale.paidPaisa} className="text-lg font-bold" />
            </dd>
          </div>
          {changePaisa > 0 ? (
            <div className="rounded-xl bg-money-in/10 p-3">
              <dt className="text-xs text-money-in">{t('change')}</dt>
              <dd>
                <MoneyText paisa={changePaisa} className="text-lg font-bold text-money-in" />
              </dd>
            </div>
          ) : null}
          {sale.duePaisa > 0 ? (
            <div className="rounded-xl bg-money-out/10 p-3">
              <dt className="text-xs text-money-out">{t('dueLine')}</dt>
              <dd>
                <MoneyText paisa={sale.duePaisa} className="text-lg font-bold text-money-out" />
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      {canVoid && secondsLeft > 0 ? (
        <Button variant="secondary" className="w-full" disabled={voiding} onClick={onUndo}>
          <RotateCcw aria-hidden="true" />
          {t('undo')} ({secondsLeft}s)
        </Button>
      ) : null}

      <Button size="lg" className="w-full" onClick={onNewSale}>
        <ShoppingBasket aria-hidden="true" />
        {t('newSaleAfter')}
      </Button>

      <Button asChild variant="ghost" className="w-full">
        <Link to={`/sell/receipt/${sale.saleId}`}>
          <Printer aria-hidden="true" />
          {t('receiptTitle')}
        </Link>
      </Button>

      <p className="text-center text-xs text-muted-foreground">{t('receiptPrintSoon')}</p>
    </div>
  );
}
