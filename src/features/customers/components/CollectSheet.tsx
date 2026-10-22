import { useEffect, useState } from 'react';
import { Banknote, Check, Loader2 } from 'lucide-react';

import { MoneyInput } from '@/components/common/MoneyInput';
import { MoneyText } from '@/components/common/MoneyText';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { newClientId } from '@/lib/ids';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/features/settings/preferences';

import { useCollectPayment } from '../queries';
import { LedgerApiError } from '../types';

const METHODS = [
  { id: 'cash', labelKey: 'methods.cash', icon: Banknote },
  { id: 'bkash', labelKey: 'methods.bkash', icon: Check },
  { id: 'nagad', labelKey: 'methods.nagad', icon: Check },
  { id: 'rocket', labelKey: 'methods.rocket', icon: Check },
] as const;

type Method = (typeof METHODS)[number]['id'] | 'other';

export type CollectedInfo = {
  paymentId: string;
  amountPaisa: number;
  customerId: string;
  customerName: string;
};

type CollectSheetProps = {
  open: boolean;
  tenantId: string;
  customer: { id: string; name: string; duePaisa: number } | null;
  onClose: () => void;
  onCollected: (info: CollectedInfo) => void;
};

/**
 * বাকি আদায় — take money against an existing due.
 *
 * One amount, one method, one big button. The default is the whole due because
 * that is what happens most of the time; a partial amount is one tap away. The
 * payment carries a client-generated id, so a retry after a dropped connection
 * is recognised by the server as the same collection (0009).
 */
export function CollectSheet({
  open,
  tenantId,
  customer,
  onClose,
  onCollected,
}: CollectSheetProps) {
  const { t } = useAppTranslation('customers');
  const { t: tc } = useAppTranslation('common');
  const numerals = usePreferences((s) => s.numerals);

  const collect = useCollectPayment(tenantId);

  const [amountPaisa, setAmountPaisa] = useState(0);
  const [method, setMethod] = useState<Method>('cash');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const duePaisa = customer?.duePaisa ?? 0;

  // Opening the sheet pre-fills the whole due, so the common case is one tap.
  useEffect(() => {
    if (open) {
      setAmountPaisa(duePaisa);
      setMethod('cash');
      setNote('');
      setError(null);
    }
  }, [open, duePaisa]);

  const submit = async () => {
    if (!customer) return;

    if (amountPaisa <= 0) {
      setError(t('collect.amountRequired'));
      return;
    }
    if (amountPaisa > duePaisa) {
      setError(t('collect.moreThanDue'));
      return;
    }

    setError(null);
    try {
      const result = await collect.mutateAsync({
        customerId: customer.id,
        amountPaisa,
        method,
        note: note.trim() === '' ? null : note.trim(),
        clientId: newClientId(),
      });
      onCollected({
        paymentId: result.paymentId,
        amountPaisa: result.amountPaisa,
        customerId: customer.id,
        customerName: customer.name,
      });
      onClose();
    } catch (cause) {
      const code = cause instanceof LedgerApiError ? cause.code : 'unknown';
      setError(
        code === 'overpayment'
          ? t('collect.moreThanDue')
          : code === 'nothing_due'
            ? t('collect.nothingDue')
            : code === 'forbidden'
              ? t('collect.forbidden')
              : t('collect.failed'),
      );
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t('collect.title')}
      description={
        customer ? t('collect.forWhom', { name: customer.name }) : t('collect.forWhomNoName')
      }
      closeLabel={tc('actions.cancel')}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2">
          <span className="text-sm text-muted-foreground">{t('collect.dueNow')}</span>
          <MoneyText paisa={duePaisa} tone="out" className="font-semibold" />
        </div>

        <MoneyInput
          id="collect-amount"
          label={t('collect.amount')}
          valuePaisa={amountPaisa}
          onChange={setAmountPaisa}
          numerals={numerals}
          hint={t('collect.amountHint')}
        />

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="min-h-touch flex-1"
            onClick={() => setAmountPaisa(duePaisa)}
          >
            {t('collect.fullDue')}
          </Button>
          <Button
            variant="outline"
            className="min-h-touch flex-1"
            onClick={() => setAmountPaisa(Math.floor(duePaisa / 2))}
          >
            {t('collect.half')}
          </Button>
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">{t('collect.method')}</legend>
          <div className="grid grid-cols-2 gap-2">
            {METHODS.map(({ id, labelKey, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={method === id}
                onClick={() => setMethod(id)}
                className={cn(
                  'flex min-h-touch items-center justify-center gap-2 rounded-xl border text-sm font-medium',
                  method === id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-secondary/40 text-muted-foreground',
                )}
              >
                <Icon aria-hidden="true" className="size-4" />
                {t(labelKey)}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-1.5">
          <label htmlFor="collect-note" className="block text-sm font-medium">
            {t('collect.note')}
          </label>
          <input
            id="collect-note"
            value={note}
            maxLength={300}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t('collect.notePlaceholder')}
            className="min-h-cta w-full rounded-xl border border-input bg-secondary/40 px-3 text-base outline-none focus-visible:border-primary"
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
          disabled={collect.isPending}
          onClick={() => void submit()}
        >
          {collect.isPending ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : (
            <Check aria-hidden="true" />
          )}
          {collect.isPending ? t('collect.saving') : t('collect.confirm')}
        </Button>
      </div>
    </Sheet>
  );
}
