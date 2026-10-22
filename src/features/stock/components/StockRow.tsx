import { ChevronRight, PackageX, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

import { MoneyText } from '@/components/common/MoneyText';
import { QuantityText } from '@/components/common/QuantityText';
import { cn } from '@/lib/utils';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';

import { isLowStock, isOutOfStock, type StockItem } from '../types';

/**
 * One product on the stock list: how much is left, and how much it is worth.
 *
 * Colour carries the state before the number does (red = finished, amber =
 * running out), because that is what the shopkeeper scans for.
 */
export function StockRow({ item }: { item: StockItem }) {
  const { t } = useAppTranslation('stock');
  const out = isOutOfStock(item);
  const low = !out && isLowStock(item);

  return (
    <li>
      <Link to={`/stock/${item.id}`} className="app-card flex min-h-touch items-center gap-3 p-3">
        <span
          aria-hidden="true"
          className={cn(
            'grid size-11 shrink-0 place-items-center rounded-xl',
            out
              ? 'bg-money-out/10 text-money-out'
              : low
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'bg-secondary text-muted-foreground',
          )}
        >
          {out ? <PackageX className="size-5" /> : <TriangleAlert className="size-5" />}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{item.name}</span>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            {out ? (
              <span className="font-medium text-money-out">{t('status.out')}</span>
            ) : low ? (
              <span className="font-medium text-amber-600 dark:text-amber-400">
                {t('status.low')}
              </span>
            ) : (
              <span>{t('status.ok')}</span>
            )}
            {item.alertMilli > 0 ? (
              <span>
                {t('alertAt')} <QuantityText milli={item.alertMilli} unitCode={item.unitCode} />
              </span>
            ) : null}
          </span>
        </span>

        <span className="shrink-0 text-end">
          <QuantityText
            milli={item.stockMilli}
            unitCode={item.unitCode}
            className="font-semibold"
          />
          {item.stockValuePaisa !== null ? (
            <span className="block text-xs text-muted-foreground">
              <MoneyText paisa={item.stockValuePaisa} />
            </span>
          ) : null}
        </span>

        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}
