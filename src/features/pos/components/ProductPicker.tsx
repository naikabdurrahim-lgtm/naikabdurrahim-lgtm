import { ScanLine, Search, X } from 'lucide-react';

import { MoneyText } from '@/components/common/MoneyText';
import { formatQuantityMilli } from '@/lib/quantity';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import type { Product } from '@/features/products/types';
import { isOutOfStock } from '@/features/products/types';

import { usePreferences } from '@/features/settings/preferences';

type ProductPickerProps = {
  query: string;
  onQueryChange: (value: string) => void;
  products: Product[];
  loading: boolean;
  allowNegativeStock: boolean;
  onPick: (product: Product) => void;
  /** Enter in the search box: add the scanned/first match without a tap. */
  onEnter: () => void;
  heading: string;
};

/**
 * The fastest path from "customer is at the counter" to "product on the bill".
 *
 * A search box that also accepts a scanner (which types the digits and presses
 * Enter) plus a grid of tappable products. Price and stock are on the tile, so
 * the shopkeeper never has to open the catalogue mid-sale.
 */
export function ProductPicker({
  query,
  onQueryChange,
  products,
  loading,
  allowNegativeStock,
  onPick,
  onEnter,
  heading,
}: ProductPickerProps) {
  const { t } = useAppTranslation('pos');
  const { t: tc } = useAppTranslation('common');
  const numerals = usePreferences((s) => s.numerals);

  return (
    <section className="space-y-3">
      <div className="flex min-h-cta items-center gap-2 rounded-xl border border-input bg-secondary/40 px-3 focus-within:border-primary">
        <Search aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onEnter();
            }
          }}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchLabel')}
          className="min-h-cta w-full bg-transparent text-base outline-none"
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            aria-label={tc('actions.cancel')}
            className="grid size-8 place-items-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        ) : (
          <ScanLine aria-hidden="true" className="size-5 shrink-0 text-muted-foreground/60" />
        )}
      </div>

      <p className="text-xs text-muted-foreground">{t('scanHint')}</p>

      <h2 className="text-sm font-semibold text-muted-foreground">{heading}</h2>

      {loading && products.length === 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="status" aria-live="polite">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : null}

      {!loading && products.length === 0 ? (
        <div className="app-card space-y-1 p-5 text-center">
          <p className="font-medium">{t('resultsEmptyTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('resultsEmptyBody')}</p>
        </div>
      ) : null}

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {products.map((product) => {
          const out = isOutOfStock(product);
          const blocked = out && !allowNegativeStock;
          const unit = tc(`units.${product.unitCode}`);

          return (
            <li key={product.id}>
              <button
                type="button"
                // Out of stock with negative stock disabled: the database would
                // refuse the sale, so say so here instead of after the tap.
                disabled={blocked}
                onClick={() => onPick(product)}
                className="app-card flex h-full min-h-[6rem] w-full flex-col justify-between gap-2 p-3 text-start transition active:scale-[0.98] disabled:opacity-60"
              >
                <span className="line-clamp-2 text-sm font-semibold leading-tight">
                  {product.name}
                </span>
                <span className="space-y-0.5">
                  <MoneyText paisa={product.sellPricePaisa} className="block text-base font-bold" />
                  <span className="block text-xs text-muted-foreground">
                    {product.isService
                      ? unit
                      : blocked
                        ? t('noStock')
                        : t('inStock', {
                            qty: formatQuantityMilli(product.stockMilli, { numerals }),
                            unit,
                          })}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
