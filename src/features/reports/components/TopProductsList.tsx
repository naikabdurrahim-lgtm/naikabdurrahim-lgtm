import { MoneyText } from '@/components/common/MoneyText';
import { NumberText } from '@/components/common/NumberText';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';

import type { TopProduct } from '../types';

/** The ranking the shopkeeper asks about: "কোনটা বেশি বেচা যায়?" */
export function TopProductsList({ products }: { products: readonly TopProduct[] }) {
  const { t } = useAppTranslation('reports');

  return (
    <ol className="space-y-2">
      {products.map((product, index) => (
        <li key={product.productId} className="app-card flex items-center gap-3 p-3">
          <span
            aria-hidden="true"
            className="grid size-7 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-bold text-muted-foreground"
          >
            <NumberText value={index + 1} maxDecimals={0} />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{product.name}</span>
            <span className="text-xs text-muted-foreground">
              <NumberText value={product.qtyMilli / 1000} /> {t('sold')} ·{' '}
              <NumberText value={product.saleCount} maxDecimals={0} /> {t('bills')}
            </span>
          </span>

          <span className="shrink-0 text-end">
            <MoneyText paisa={product.revenuePaisa} className="text-sm font-semibold" />
            <span className="block text-xs text-muted-foreground">
              {t('profitLine')} <MoneyText paisa={product.profitPaisa} />
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
