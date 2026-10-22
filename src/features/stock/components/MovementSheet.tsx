import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, Loader2 } from 'lucide-react';

import { MoneyInput } from '@/components/common/MoneyInput';
import { QuantityText } from '@/components/common/QuantityText';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { newClientId } from '@/lib/ids';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { parseQuantityToMilli } from '@/lib/quantity';
import { cn } from '@/lib/utils';

import { useRecordMovement } from '../queries';
import { StockApiError, type ManualMovementType, type StockItem } from '../types';

type Direction = 'in' | 'out';

const REASONS: Record<Direction, { type: ManualMovementType; key: string }[]> = {
  in: [
    { type: 'purchase', key: 'reason.purchase' },
    { type: 'sale_return', key: 'reason.return' },
    { type: 'adjustment', key: 'reason.count' },
  ],
  out: [
    { type: 'damage', key: 'reason.damage' },
    { type: 'adjustment', key: 'reason.count' },
  ],
};

type MovementSheetProps = {
  open: boolean;
  tenantId: string;
  item: StockItem | null;
  onClose: () => void;
  onRecorded: (stockMilli: number) => void;
};

/**
 * Add or remove stock, with a reason.
 *
 * There is no "set stock to N" field on purpose: a shopkeeper who finds 3 kg
 * where the book says 5 is recording a difference, and the reason is what makes
 * that difference explainable later (PROJECT_RULES 5.2).
 */
export function MovementSheet({ open, tenantId, item, onClose, onRecorded }: MovementSheetProps) {
  const { t } = useAppTranslation('stock');
  const { t: tc } = useAppTranslation('common');
  const record = useRecordMovement(tenantId);

  const [direction, setDirection] = useState<Direction>('in');
  const [type, setType] = useState<ManualMovementType>('purchase');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [costPaisa, setCostPaisa] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDirection('in');
    setType('purchase');
    setAmount('');
    setReason('');
    // A purchase is usually at the same cost as last time: pre-fill it.
    setCostPaisa(item?.buyPricePaisa ?? 0);
    setError(null);
  }, [open, item]);

  const parseAmount = (): number | null => {
    const milli = parseQuantityToMilli(amount.trim());
    return milli !== null && milli > 0 ? milli : null;
  };

  const changeDirection = (next: Direction) => {
    setDirection(next);
    setType(REASONS[next][0]?.type ?? 'adjustment');
    setError(null);
  };

  const submit = async () => {
    if (!item) return;

    const magnitude = parseAmount();
    if (magnitude === null) {
      setError(t('form.quantityInvalid'));
      return;
    }

    // A purchase without a note is normal; an adjustment without one is not.
    const finalReason =
      reason.trim() === ''
        ? t(REASONS[direction].find((r) => r.type === type)?.key ?? 'reason.count')
        : reason.trim();

    setError(null);
    try {
      const result = await record.mutateAsync({
        productId: item.id,
        type,
        qtyMilli: direction === 'in' ? magnitude : -magnitude,
        unitCostPaisa: type === 'purchase' ? costPaisa : null,
        reason: finalReason,
        clientId: newClientId(),
      });
      onRecorded(result.stockMilli);
      onClose();
    } catch (cause) {
      const code = cause instanceof StockApiError ? cause.code : 'unknown';
      setError(
        code === 'reason_required'
          ? t('form.reasonRequired')
          : code === 'forbidden'
            ? t('form.forbidden')
            : code === 'stock_movement_on_service_product'
              ? t('form.serviceNoStock')
              : t('form.failed'),
      );
    }
  };

  const current = item?.stockMilli ?? 0;
  const magnitude = parseAmount() ?? 0;
  const after = direction === 'in' ? current + magnitude : current - magnitude;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t('sheet.title')}
      description={item?.name ?? ''}
      closeLabel={tc('actions.cancel')}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2" role="group" aria-label={t('sheet.direction')}>
          <button
            type="button"
            aria-pressed={direction === 'in'}
            onClick={() => changeDirection('in')}
            className={cn(
              'flex min-h-cta items-center justify-center gap-2 rounded-xl border font-semibold',
              direction === 'in'
                ? 'border-money-in bg-money-in/10 text-money-in'
                : 'border-border bg-secondary/40 text-muted-foreground',
            )}
          >
            <ArrowDownLeft aria-hidden="true" />
            {t('sheet.in')}
          </button>
          <button
            type="button"
            aria-pressed={direction === 'out'}
            onClick={() => changeDirection('out')}
            className={cn(
              'flex min-h-cta items-center justify-center gap-2 rounded-xl border font-semibold',
              direction === 'out'
                ? 'border-money-out bg-money-out/10 text-money-out'
                : 'border-border bg-secondary/40 text-muted-foreground',
            )}
          >
            <ArrowUpRight aria-hidden="true" />
            {t('sheet.out')}
          </button>
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">{t('sheet.reasonLabel')}</legend>
          <div className="flex flex-wrap gap-2">
            {REASONS[direction].map((option) => (
              <button
                key={`${direction}-${option.type}`}
                type="button"
                aria-pressed={type === option.type}
                onClick={() => setType(option.type)}
                className={cn(
                  'min-h-touch rounded-full border px-4 text-sm font-medium',
                  type === option.type
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-secondary/40 text-muted-foreground',
                )}
              >
                {t(option.key)}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-1.5">
          <label htmlFor="movement-amount" className="block text-sm font-medium">
            {t('sheet.amount')}
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-input bg-secondary/40 px-3 focus-within:border-primary">
            <input
              id="movement-amount"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setError(null);
              }}
              placeholder="0"
              aria-invalid={error !== null}
              aria-describedby="movement-amount-hint"
              className={cn(inputClass, 'border-0 bg-transparent px-0')}
            />
            <span className="text-sm text-muted-foreground">
              {tc(`units.${item?.unitCode ?? 'piece'}`)}
            </span>
          </div>
          <p id="movement-amount-hint" className="text-xs text-muted-foreground">
            {t('sheet.afterHint', {
              before: current / 1000,
              after: after / 1000,
            })}
          </p>
        </div>

        {type === 'purchase' ? (
          <MoneyInput
            id="movement-cost"
            label={t('sheet.cost')}
            valuePaisa={costPaisa}
            onChange={setCostPaisa}
            hint={t('sheet.costHint')}
          />
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor="movement-note" className="block text-sm font-medium">
            {t('sheet.note')}
          </label>
          <input
            id="movement-note"
            value={reason}
            maxLength={300}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t('sheet.notePlaceholder')}
            className={inputClass}
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-money-out">
            {error}
          </p>
        ) : null}

        <Button
          size="lg"
          className="w-full"
          disabled={record.isPending || item === null}
          onClick={() => void submit()}
        >
          {record.isPending ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : (
            <Check aria-hidden="true" />
          )}
          {record.isPending ? t('sheet.saving') : t('sheet.confirm')}
        </Button>

        {item ? (
          <p className="text-center text-xs text-muted-foreground">
            <QuantityText milli={after} unitCode={item.unitCode} /> {t('sheet.afterLabel')}
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}
