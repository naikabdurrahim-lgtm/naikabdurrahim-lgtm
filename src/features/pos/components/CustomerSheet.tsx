import { useState } from 'react';
import { Loader2, Search, UserPlus } from 'lucide-react';

import { MoneyText } from '@/components/common/MoneyText';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { inputClass } from '@/components/ui/input';
import { formatBdPhone } from '@/features/auth/lib/phone';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useCreateCustomer, useCustomerSearch } from '@/features/customers/queries';
import { CustomerApiError } from '@/features/customers/types';
import type { CustomerSummary } from '@/features/customers/types';

type CustomerSheetProps = {
  open: boolean;
  tenantId: string;
  onClose: () => void;
  onSelect: (customer: CustomerSummary) => void;
};

/**
 * Pick the person who owes money, or add them without leaving the sale.
 *
 * Creating a customer mid-sale is the normal case in a small shop ("রহিম ভাই,
 * ০১৭…"), so the form lives here rather than sending the cashier to another
 * screen with a half-finished bill.
 */
export function CustomerSheet({ open, tenantId, onClose, onSelect }: CustomerSheetProps) {
  const { t } = useAppTranslation('pos');
  const { t: tc } = useAppTranslation('common');

  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const debounced = useDebouncedValue(query, 250);
  const search = useCustomerSearch(tenantId, debounced, open);
  const createCustomer = useCreateCustomer(tenantId);

  const reset = () => {
    setQuery('');
    setAdding(false);
    setName('');
    setPhone('');
    setError(null);
  };

  const save = async () => {
    if (name.trim() === '') {
      setError(t('customerNameRequired'));
      return;
    }
    setError(null);
    try {
      const customer = await createCustomer.mutateAsync({
        name: name.trim(),
        phone: phone.trim() === '' ? null : phone.trim(),
      });
      onSelect(customer);
      reset();
    } catch (cause) {
      const code = cause instanceof CustomerApiError ? cause.code : 'unknown';
      setError(
        code === 'duplicate_phone'
          ? t('customerDuplicate')
          : code === 'invalid_phone'
            ? t('customerPhoneInvalid')
            : t('errors.unknown'),
      );
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
          onClose();
        }
      }}
      title={t('customerPick')}
      closeLabel={tc('actions.close')}
    >
      <div className="space-y-3">
        <div className="flex min-h-cta items-center gap-2 rounded-xl border border-input bg-secondary/40 px-3 focus-within:border-primary">
          <Search aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('customerSearch')}
            aria-label={t('customerSearch')}
            className="min-h-cta w-full bg-transparent text-base outline-none"
          />
        </div>

        {search.isPending ? (
          <p className="py-3 text-center text-sm text-muted-foreground" role="status">
            {tc('a11y.loading')}
          </p>
        ) : null}

        <ul className="max-h-64 space-y-2 overflow-y-auto">
          {(search.data ?? []).map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(customer);
                  reset();
                }}
                className="app-card flex min-h-touch w-full items-center gap-2 p-3 text-start"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{customer.name}</span>
                  {customer.phone ? (
                    <span className="bn-digits block text-xs text-muted-foreground" dir="ltr">
                      {formatBdPhone(customer.phone)}
                    </span>
                  ) : null}
                </span>
                {/* The due travels with the pick, so the cashier can say
                    "আপনার তো ৬০০ টাকা বাকি আছে" without leaving the sale. */}
                {customer.duePaisa > 0 ? (
                  <span className="shrink-0 text-xs font-medium text-money-out">
                    {tc('money.due')} <MoneyText paisa={customer.duePaisa} tone="out" />
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>

        {search.isSuccess && search.data.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">{t('customerEmpty')}</p>
        ) : null}

        {adding ? (
          <div className="space-y-3 rounded-xl border border-border p-3">
            <div className="space-y-1.5">
              <label htmlFor="customer-name" className="block text-sm font-medium">
                {t('customerName')}
              </label>
              <input
                id="customer-name"
                value={name}
                autoFocus
                maxLength={120}
                aria-invalid={Boolean(error)}
                className={inputClass}
                onChange={(event) => {
                  setName(event.target.value);
                  setError(null);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="customer-phone" className="block text-sm font-medium">
                {t('customerPhone')}
              </label>
              <input
                id="customer-phone"
                value={phone}
                inputMode="tel"
                dir="ltr"
                placeholder="01712345678"
                className={inputClass}
                onChange={(event) => {
                  setPhone(event.target.value);
                  setError(null);
                }}
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-money-out">
                {error}
              </p>
            ) : null}
            <Button
              className="w-full"
              disabled={createCustomer.isPending}
              onClick={() => void save()}
            >
              {createCustomer.isPending ? (
                <Loader2 aria-hidden="true" className="animate-spin" />
              ) : (
                <UserPlus aria-hidden="true" />
              )}
              {t('customerSave')}
            </Button>
          </div>
        ) : (
          <Button variant="secondary" className="w-full" onClick={() => setAdding(true)}>
            <UserPlus aria-hidden="true" />
            {t('customerNew')}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
