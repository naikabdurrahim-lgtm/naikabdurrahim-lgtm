import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { formatQuantityMilli, parseQuantityToMilli } from '@/lib/quantity';

import { MoneyInput } from '@/components/common/MoneyInput';
import type { CartLine } from '../types';

type LineSheetProps = {
  line: CartLine | null;
  unitLabel: string;
  canEditPrice: boolean;
  onClose: () => void;
  onChangeQty: (qtyMilli: number) => void;
  onChangePrice: (paisa: number) => void;
  onRemove: () => void;
};

/** Presets cover what a shop actually sells: quarter/half kilos, ones and fives. */
const PRESETS_WEIGHT = [250, 500, 1000, 2000, 5000];
const PRESETS_COUNT = [1000, 2000, 3000, 5000, 10_000];

/**
 * Editing one line: quantity and (for an owner/manager) the price.
 *
 * Quantity is a text field plus presets rather than a numeric spinner, because
 * half a kilo and one and a half kilos are both everyday sales.
 */
export function LineSheet({
  line,
  unitLabel,
  canEditPrice,
  onClose,
  onChangeQty,
  onChangePrice,
  onRemove,
}: LineSheetProps) {
  const { t } = useAppTranslation('pos');
  const { t: tc } = useAppTranslation('common');
  const [qtyText, setQtyText] = useState('');

  useEffect(() => {
    if (line) setQtyText(formatQuantityMilli(line.qtyMilli));
  }, [line]);

  if (!line) return null;

  const presets =
    line.unitCode === 'kg' || line.unitCode === 'litre' ? PRESETS_WEIGHT : PRESETS_COUNT;
  const parsed = parseQuantityToMilli(qtyText);

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={line.name}
      closeLabel={tc('actions.close')}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('qtyPresets')}</p>
          <div className="flex flex-wrap gap-2">
            {presets.map((milli) => (
              <button
                key={milli}
                type="button"
                onClick={() => {
                  onChangeQty(milli);
                  setQtyText(formatQuantityMilli(milli));
                }}
                aria-pressed={line.qtyMilli === milli}
                className={
                  line.qtyMilli === milli
                    ? 'min-h-touch rounded-full border border-primary bg-primary/10 px-4 text-sm font-semibold text-primary'
                    : 'min-h-touch rounded-full border border-border bg-secondary/40 px-4 text-sm'
                }
              >
                {formatQuantityMilli(milli)} {unitLabel}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="line-qty" className="block text-sm font-medium">
            {t('qty')} ({unitLabel})
          </label>
          <input
            id="line-qty"
            inputMode="decimal"
            value={qtyText}
            onChange={(event) => {
              const next = event.target.value;
              setQtyText(next);
              const milli = parseQuantityToMilli(next);
              // Ignore an unfinished "1." until it parses; never write 0.
              if (milli !== null && milli > 0) onChangeQty(milli);
            }}
            className="min-h-cta w-full rounded-xl border border-input bg-secondary/40 px-3 text-lg outline-none focus-visible:border-primary"
          />
          {parsed === null && qtyText.trim() !== '' ? (
            <p className="text-xs text-money-out">{t('qtyInvalid')}</p>
          ) : null}
        </div>

        {canEditPrice ? (
          <MoneyInput
            id="line-price"
            label={`${t('unitPrice')} (${unitLabel})`}
            valuePaisa={line.unitPricePaisa}
            onChange={onChangePrice}
          />
        ) : (
          <p className="rounded-xl bg-secondary/40 p-3 text-xs text-muted-foreground">
            {t('priceLocked')}
          </p>
        )}

        <div className="flex gap-2">
          <Button
            variant="ghost"
            className="flex-1 text-money-out"
            onClick={() => {
              onRemove();
              onClose();
            }}
          >
            {t('removeLine')}
          </Button>
          <Button className="flex-1" onClick={onClose}>
            {t('qtyDone')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
