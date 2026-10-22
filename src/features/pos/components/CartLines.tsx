import { Minus, Plus, Trash2 } from 'lucide-react';

import { MoneyText } from '@/components/common/MoneyText';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { formatQuantityMilli } from '@/lib/quantity';
import { lineTotalPaisa } from '@/lib/money';
import { usePreferences } from '@/features/settings/preferences';

import type { CartLine } from '../types';

type CartLinesProps = {
  lines: CartLine[];
  unitLabel: (unitCode: CartLine['unitCode']) => string;
  /** Lines whose quantity exceeds the stock on hand. */
  warningIds: ReadonlySet<string>;
  onStep: (productId: string, direction: 1 | -1) => void;
  onOpen: (productId: string) => void;
  onRemove: (productId: string) => void;
};

/**
 * One row per bill line: name, quantity stepper, line total.
 *
 * The stepper is the fast path (big, thumb-sized), and tapping the quantity
 * opens the sheet for halves and odd amounts.
 */
export function CartLines({
  lines,
  unitLabel,
  warningIds,
  onStep,
  onOpen,
  onRemove,
}: CartLinesProps) {
  const { t } = useAppTranslation('pos');
  const numerals = usePreferences((s) => s.numerals);

  return (
    <ul className="space-y-2">
      {lines.map((line) => {
        const unit = unitLabel(line.unitCode);
        const total = lineTotalPaisa(line.unitPricePaisa, line.qtyMilli);
        const warning = warningIds.has(line.productId);

        return (
          <li key={line.productId} className="app-card space-y-2 p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold leading-tight">{line.name}</p>
                <p className="text-xs text-muted-foreground">
                  <MoneyText paisa={line.unitPricePaisa} className="font-medium" /> / {unit}
                </p>
                {warning ? (
                  <p className="text-xs font-medium text-warning">
                    {t('stockWarning', {
                      qty: formatQuantityMilli(line.stockMilli, { numerals }),
                      unit,
                    })}
                  </p>
                ) : null}
              </div>
              <MoneyText paisa={total} className="shrink-0 text-base font-bold" />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-xl border border-border bg-secondary/40">
                <button
                  type="button"
                  onClick={() => onStep(line.productId, -1)}
                  aria-label={`${t('qty')} − ${line.name}`}
                  className="grid size-touch place-items-center rounded-s-xl text-muted-foreground hover:text-foreground"
                >
                  <Minus aria-hidden="true" className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpen(line.productId)}
                  aria-label={`${t('qty')}: ${formatQuantityMilli(line.qtyMilli, { numerals })} ${unit}`}
                  className="min-h-touch min-w-[5.5rem] px-2 text-base font-semibold tabular-nums"
                >
                  {formatQuantityMilli(line.qtyMilli, { numerals })} {unit}
                </button>
                <button
                  type="button"
                  onClick={() => onStep(line.productId, 1)}
                  aria-label={`${t('qty')} + ${line.name}`}
                  className="grid size-touch place-items-center rounded-e-xl text-muted-foreground hover:text-foreground"
                >
                  <Plus aria-hidden="true" className="size-5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => onRemove(line.productId)}
                aria-label={`${t('removeLine')}: ${line.name}`}
                className="ms-auto grid size-touch place-items-center rounded-xl text-muted-foreground hover:text-money-out"
              >
                <Trash2 aria-hidden="true" className="size-5" />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
