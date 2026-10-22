import { Package, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';

import { MoneyText } from '@/components/common/MoneyText';
import { Badge } from '@/components/ui/badge';
import { usePreferences } from '@/features/settings/preferences';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { formatPaisa } from '@/lib/money';
import { formatQuantityMilli } from '@/lib/quantity';

import { isLowStock, isOutOfStock, type Product } from '../types';

/**
 * One row in the catalogue. Everything a shopkeeper needs to decide "is this the
 * right one" — name, category, unit, price, stock state — without opening it.
 */
export function ProductCard({ product }: { product: Product }) {
  const { t } = useAppTranslation('products');
  const numerals = usePreferences((s) => s.numerals);

  const low = isLowStock(product);
  const out = isOutOfStock(product);
  const unitLabel = t(`common:units.${product.unitCode}`, { ns: 'common' }) as string;
  const stockText = t('stockLine', {
    qty: formatQuantityMilli(product.stockMilli, { numerals }),
    unit: unitLabel,
  });

  return (
    <Link
      to={`/products/${product.id}`}
      className="app-card flex min-h-touch items-center gap-3 p-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
      aria-label={`${product.name}, ${formatPaisa(product.sellPricePaisa, { numerals })}`}
    >
      <span
        aria-hidden="true"
        className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary/60 text-muted-foreground"
      >
        {product.isService ? <Wrench className="size-5" /> : <Package className="size-5" />}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold leading-tight">{product.name}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <span className="truncate">
            {product.categoryName ?? t('form.noCategory')} · {unitLabel}
          </span>
          {!product.isActive ? <Badge variant="outline">{t('inactive')}</Badge> : null}
        </span>
      </span>

      <span className="shrink-0 text-end">
        <MoneyText paisa={product.sellPricePaisa} className="block font-semibold" />
        {product.isService ? (
          <Badge variant="default" className="mt-1">
            {t('service')}
          </Badge>
        ) : out ? (
          <Badge variant="danger" className="mt-1">
            {t('outOfStock')}
          </Badge>
        ) : low ? (
          <Badge variant="warning" className="mt-1">
            {t('lowStock')}
          </Badge>
        ) : (
          <span className="mt-1 block text-xs text-muted-foreground">{stockText}</span>
        )}
      </span>
    </Link>
  );
}
