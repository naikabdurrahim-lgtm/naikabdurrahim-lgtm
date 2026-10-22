import { Loader2, UserPlus, Wallet } from 'lucide-react';

import { MoneyText } from '@/components/common/MoneyText';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { inputClass } from '@/components/ui/input';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { formatPaisa, toEnglishDigits } from '@/lib/money';

import { MoneyInput } from './MoneyInput';
import {
  PAYMENT_METHODS,
  type Cart,
  type CartTotals,
  type DiscountInput,
  type PaymentMethod,
} from '../types';
import type { SaleProblem } from '../cart';

type PaymentSheetProps = {
  open: boolean;
  cart: Cart;
  totals: CartTotals;
  problem: SaleProblem | null;
  canDiscount: boolean;
  submitting: boolean;
  errorText: string | null;
  onClose: () => void;
  onTendered: (paisa: number) => void;
  onMethod: (method: PaymentMethod) => void;
  onCredit: (credit: boolean) => void;
  onDiscount: (discount: DiscountInput) => void;
  onNote: (note: string) => void;
  onPickCustomer: () => void;
  onClearCustomer: () => void;
  onConfirm: () => void;
};

/** Round notes a Bangladeshi counter actually hands over. */
const NOTE_CHIPS = [50_000, 100_000, 200_000, 500_000];

/**
 * Taking the money.
 *
 * The total is the biggest thing on the sheet; everything else (discount, cash
 * received, credit) is optional and below it. Confirming is one large button,
 * and it stays disabled with a plain-Bangla reason when something is missing
 * instead of failing at the server.
 */
export function PaymentSheet({
  open,
  cart,
  totals,
  problem,
  canDiscount,
  submitting,
  errorText,
  onClose,
  onTendered,
  onMethod,
  onCredit,
  onDiscount,
  onNote,
  onPickCustomer,
  onClearCustomer,
  onConfirm,
}: PaymentSheetProps) {
  const { t } = useAppTranslation('pos');
  const { t: tc } = useAppTranslation('common');

  const problemText =
    problem === 'empty'
      ? t('emptyCart')
      : problem === 'credit_required'
        ? t('creditHint')
        : problem === 'customer_required'
          ? t('customerRequired')
          : null;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t('cartTitle')}
      closeLabel={tc('actions.close')}
    >
      <div className="space-y-4">
        <div className="rounded-2xl bg-primary/10 p-4 text-center">
          <p className="text-sm text-muted-foreground">{t('total')}</p>
          <MoneyText paisa={totals.totalPaisa} className="text-3xl font-bold text-primary" />
          <p className="mt-1 text-xs text-muted-foreground">
            {t('items', { total: totals.itemCount })}
            {totals.discountPaisa > 0 ? (
              <>
                {' · '}
                {t('discount')} <MoneyText paisa={totals.discountPaisa} className="font-medium" />
              </>
            ) : null}
          </p>
        </div>

        {canDiscount ? (
          <section className="space-y-2">
            <p className="text-sm font-medium">{t('discount')}</p>
            <div className="flex flex-wrap gap-2">
              <DiscountChip
                selected={cart.discount.kind === 'amount' && cart.discount.paisa === 0}
                label={t('discountNone')}
                onClick={() => onDiscount({ kind: 'amount', paisa: 0 })}
              />
              <DiscountChip
                selected={cart.discount.kind === 'amount' && cart.discount.paisa > 0}
                label={t('discountAmount')}
                onClick={() =>
                  onDiscount({
                    kind: 'amount',
                    paisa: cart.discount.kind === 'amount' ? cart.discount.paisa : 0,
                  })
                }
              />
              <DiscountChip
                selected={cart.discount.kind === 'percent'}
                label={t('discountPercent')}
                onClick={() =>
                  onDiscount({
                    kind: 'percent',
                    percent: cart.discount.kind === 'percent' ? cart.discount.percent : 0,
                  })
                }
              />
            </div>

            {cart.discount.kind === 'amount' && cart.discount.paisa > 0 ? (
              <MoneyInput
                id="discount-amount"
                label={t('discountAmount')}
                valuePaisa={cart.discount.paisa}
                placeholder={t('discountAmountPlaceholder')}
                onChange={(paisa) => onDiscount({ kind: 'amount', paisa })}
              />
            ) : null}

            {cart.discount.kind === 'percent' ? (
              <div className="space-y-1.5">
                <label htmlFor="discount-percent" className="block text-sm font-medium">
                  {t('discountPercent')}
                </label>
                <input
                  id="discount-percent"
                  inputMode="decimal"
                  value={cart.discount.percent === 0 ? '' : String(cart.discount.percent)}
                  placeholder={t('discountPercentPlaceholder')}
                  onChange={(event) => {
                    // Bangla numerals are accepted; anything unparseable is 0.
                    const next = Number(toEnglishDigits(event.target.value).replace(',', '.'));
                    onDiscount({
                      kind: 'percent',
                      percent: Number.isFinite(next) ? Math.min(100, Math.max(0, next)) : 0,
                    });
                  }}
                  className={inputClass}
                />
              </div>
            ) : null}
          </section>
        ) : null}

        <label className="flex min-h-touch items-center gap-3 rounded-xl bg-secondary/40 px-3">
          <input
            type="checkbox"
            className="size-5 rounded border-input"
            checked={cart.credit}
            onChange={(event) => onCredit(event.target.checked)}
          />
          <span className="flex-1">
            <span className="block text-sm font-medium">{t('credit')}</span>
            <span className="block text-xs text-muted-foreground">{t('creditHint')}</span>
          </span>
        </label>

        {cart.credit ? (
          <div className="space-y-2">
            {cart.customer ? (
              <div className="app-card flex items-center gap-2 p-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{cart.customer.name}</span>
                  {cart.customer.phone ? (
                    <span className="block text-xs text-muted-foreground" dir="ltr">
                      {cart.customer.phone}
                    </span>
                  ) : null}
                </span>
                <Button variant="ghost" size="sm" onClick={onClearCustomer}>
                  {tc('actions.cancel')}
                </Button>
              </div>
            ) : null}
            <Button variant="secondary" className="w-full" onClick={onPickCustomer}>
              <UserPlus aria-hidden="true" />
              {cart.customer ? t('customer') : t('customerPick')}
            </Button>

            <MoneyInput
              id="credit-received"
              label={t('tendered')}
              hint={t('tenderedHint')}
              valuePaisa={cart.tenderedPaisa}
              onChange={onTendered}
            />

            {totals.duePaisa > 0 ? (
              <div className="flex items-center justify-between rounded-xl bg-money-out/10 px-3 py-2">
                <span className="text-sm font-medium text-money-out">{t('dueLine')}</span>
                <MoneyText paisa={totals.duePaisa} className="font-bold text-money-out" />
              </div>
            ) : null}
          </div>
        ) : (
          <section className="space-y-2">
            <MoneyInput
              id="cash-received"
              label={t('tendered')}
              hint={t('tenderedHint')}
              valuePaisa={cart.tenderedPaisa}
              placeholder={formatPaisa(totals.totalPaisa, { numerals: 'en', withSymbol: false })}
              onChange={onTendered}
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onTendered(totals.totalPaisa)}
                className="min-h-touch rounded-full border border-primary bg-primary/10 px-4 text-sm font-semibold text-primary"
              >
                {t('paid')} · <MoneyText paisa={totals.totalPaisa} />
              </button>
              {NOTE_CHIPS.filter((note) => note >= totals.totalPaisa).map((note) => (
                <button
                  key={note}
                  type="button"
                  onClick={() => onTendered(note)}
                  className="min-h-touch rounded-full border border-border bg-secondary/40 px-4 text-sm"
                >
                  <MoneyText paisa={note} />
                </button>
              ))}
            </div>

            {totals.changePaisa > 0 ? (
              <div className="flex items-center justify-between rounded-xl bg-money-in/10 px-3 py-2">
                <span className="text-sm font-medium text-money-in">{t('change')}</span>
                <MoneyText paisa={totals.changePaisa} className="font-bold text-money-in" />
              </div>
            ) : null}
          </section>
        )}

        <section className="space-y-2">
          <p className="text-sm font-medium">{t('method')}</p>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => onMethod(method)}
                aria-pressed={cart.method === method}
                className={
                  cart.method === method
                    ? 'min-h-touch rounded-full border border-primary bg-primary/10 px-4 text-sm font-semibold text-primary'
                    : 'min-h-touch rounded-full border border-border bg-secondary/40 px-4 text-sm'
                }
              >
                {t(method)}
              </button>
            ))}
          </div>
        </section>

        <div className="space-y-1.5">
          <label htmlFor="sale-note" className="block text-sm font-medium">
            {t('note')}
          </label>
          <input
            id="sale-note"
            value={cart.note}
            maxLength={500}
            placeholder={t('notePlaceholder')}
            onChange={(event) => onNote(event.target.value)}
            className={inputClass}
          />
        </div>

        {errorText ? (
          <p role="alert" className="rounded-xl bg-money-out/10 p-3 text-sm text-money-out">
            {errorText}
          </p>
        ) : null}

        <div className="space-y-2">
          <Button
            size="lg"
            className="w-full"
            disabled={submitting || problem !== null}
            onClick={onConfirm}
          >
            {submitting ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              <Wallet aria-hidden="true" />
            )}
            {submitting ? t('savingSale') : t('confirmSale')}
          </Button>
          {problemText ? (
            <p className="text-center text-sm text-muted-foreground">{problemText}</p>
          ) : null}
          <Button variant="ghost" className="w-full" onClick={onClose} disabled={submitting}>
            {t('backToCart')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function DiscountChip({
  selected,
  label,
  onClick,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={
        selected
          ? 'min-h-touch rounded-full border border-primary bg-primary/10 px-4 text-sm font-semibold text-primary'
          : 'min-h-touch rounded-full border border-border bg-secondary/40 px-4 text-sm'
      }
    >
      {label}
    </button>
  );
}
