import type { ReactNode } from 'react';
import { ChevronRight, Phone, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

import { MoneyText } from '@/components/common/MoneyText';
import { formatBdPhone } from '@/features/auth/lib/phone';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { cn } from '@/lib/utils';

import { isOverCreditLimit } from '../types';

type CustomerCardProps = {
  customer: {
    id: string;
    name: string;
    phone: string | null;
    duePaisa: number;
    creditLimitPaisa?: number | null;
  };
  /** The due screen adds a collect button next to the row. */
  action?: ReactNode;
};

/**
 * One person in the list. Colour carries the meaning first (red = owes money),
 * then the amount, then the name — the order a shopkeeper scans in.
 */
export function CustomerCard({ customer, action }: CustomerCardProps) {
  const { t } = useAppTranslation('customers');
  const overLimit = isOverCreditLimit({
    duePaisa: customer.duePaisa,
    creditLimitPaisa: customer.creditLimitPaisa ?? null,
  });

  return (
    <div className="app-card flex items-center gap-3 p-3">
      <Link
        to={`/customers/${customer.id}`}
        className="flex min-h-touch min-w-0 flex-1 items-center gap-3 rounded-xl"
      >
        <span
          aria-hidden="true"
          className={cn(
            'grid size-11 shrink-0 place-items-center rounded-xl text-base font-bold',
            customer.duePaisa > 0
              ? 'bg-money-out/10 text-money-out'
              : 'bg-secondary text-muted-foreground',
          )}
        >
          {customer.name.trim().charAt(0)}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 font-semibold">
            <span className="truncate">{customer.name}</span>
            {overLimit ? (
              <TriangleAlert aria-hidden="true" className="size-4 shrink-0 text-money-out" />
            ) : null}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {customer.phone ? (
              <>
                <Phone aria-hidden="true" className="size-3" />
                <span className="bn-digits">{formatBdPhone(customer.phone)}</span>
              </>
            ) : (
              t('noPhone')
            )}
          </span>
        </span>

        <span className="shrink-0 text-end">
          {customer.duePaisa > 0 ? (
            <MoneyText paisa={customer.duePaisa} tone="out" className="font-semibold" />
          ) : (
            <span className="text-xs text-muted-foreground">{t('settled')}</span>
          )}
          <ChevronRight aria-hidden="true" className="ms-auto mt-1 size-4 text-muted-foreground" />
        </span>
      </Link>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
