import { useState } from 'react';
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, PackagePlus } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorPanel } from '@/components/common/ErrorPanel';
import { MoneyText } from '@/components/common/MoneyText';
import { QuantityText } from '@/components/common/QuantityText';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/useAuth';
import { useProduct } from '@/features/products/queries';
import { formatDhakaDateTime } from '@/lib/datetime';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { usePreferences } from '@/features/settings/preferences';
import { can } from '@/lib/permissions';
import { cn } from '@/lib/utils';

import { MovementSheet } from '../components/MovementSheet';
import { MovementListSkeleton } from '../components/States';
import { useStockMovements } from '../queries';
import type { StockItem } from '../types';

/**
 * One product's stock history.
 *
 * Append-only, so there is no edit or delete here: a wrong count is fixed by
 * another movement with a reason, and both stay in the list. That is the same
 * rule the ledger and the sales follow.
 */
export function ProductStockPage() {
  const { productId = '' } = useParams();
  const { t } = useAppTranslation('stock');
  const { t: tc } = useAppTranslation('common');
  const tenant = useAuth().activeTenant;
  const tenantId = tenant?.tenantId ?? '';
  const navigate = useNavigate();
  const numerals = usePreferences((s) => s.numerals);

  const product = useProduct(tenantId, productId, true);
  const movements = useStockMovements(tenantId, productId);
  const [moving, setMoving] = useState<StockItem | null>(null);

  const rows = movements.data?.pages.flat() ?? [];

  if (product.isPending) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-9 w-40" />
        <div className="skeleton h-24 w-full rounded-2xl" />
        <MovementListSkeleton rows={4} />
      </div>
    );
  }

  if (product.isError || !product.data) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" onClick={() => navigate('/stock')}>
          <ArrowLeft aria-hidden="true" />
          {tc('actions.back')}
        </Button>
        <ErrorPanel
          message={t('loadFailed')}
          retryLabel={tc('actions.retry')}
          onRetry={() => void product.refetch()}
        />
      </div>
    );
  }

  const item = product.data;
  const asStockItem: StockItem = {
    id: item.id,
    name: item.name,
    unitCode: item.unitCode,
    stockMilli: item.stockMilli,
    alertMilli: item.stockAlertMilli,
    sellPricePaisa: item.sellPricePaisa,
    buyPricePaisa: item.buyPricePaisa,
    stockValuePaisa:
      item.buyPricePaisa === null
        ? null
        : Math.round((item.stockMilli / 1000) * item.buyPricePaisa),
    isService: item.isService,
    lastMovementAt: null,
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate('/stock')}>
        <ArrowLeft aria-hidden="true" />
        {tc('actions.back')}
      </Button>

      <section className="app-card space-y-3 p-4">
        <div>
          <h1 className="text-xl font-bold">{item.name}</h1>
          <p className="text-sm text-muted-foreground">
            {tc(`units.${item.unitCode}`)} · <MoneyText paisa={item.sellPricePaisa} />
          </p>
        </div>

        <div className="rounded-xl bg-secondary/40 p-3">
          <p className="text-xs text-muted-foreground">{t('detail.inStock')}</p>
          <QuantityText
            milli={item.stockMilli}
            unitCode={item.unitCode}
            className="text-3xl font-bold"
          />
          {item.stockAlertMilli > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t('alertAt')} <QuantityText milli={item.stockAlertMilli} unitCode={item.unitCode} />
            </p>
          ) : null}
        </div>

        {can(tenant?.role, 'stock.move') ? (
          <Button size="lg" className="w-full" onClick={() => setMoving(asStockItem)}>
            <PackagePlus aria-hidden="true" />
            {t('detail.adjust')}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">{t('detail.readOnly')}</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">{t('detail.history')}</h2>

        {movements.isPending ? <MovementListSkeleton rows={4} /> : null}

        {movements.isError ? (
          <ErrorPanel
            message={t('loadFailed')}
            retryLabel={tc('actions.retry')}
            onRetry={() => void movements.refetch()}
          />
        ) : null}

        {movements.isSuccess && rows.length === 0 ? (
          <EmptyState
            icon={PackagePlus}
            title={t('detail.emptyTitle')}
            description={t('detail.emptyBody')}
          />
        ) : null}

        {rows.length > 0 ? (
          <ul className="space-y-2">
            {rows.map((movement) => {
              const isIn = movement.qtyMilli > 0;
              const Icon = isIn ? ArrowDownLeft : ArrowUpRight;
              return (
                <li key={movement.id} className="app-card flex items-start gap-3 p-3">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'grid size-9 shrink-0 place-items-center rounded-lg',
                      isIn ? 'bg-money-in/10 text-money-in' : 'bg-money-out/10 text-money-out',
                    )}
                  >
                    <Icon className="size-5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {t(`types.${movement.type}`)}
                      {movement.reason ? ` · ${movement.reason}` : ''}
                    </p>
                    <p className="bn-digits text-xs text-muted-foreground">
                      {formatDhakaDateTime(movement.occurredAt, numerals)}
                      {movement.createdByName ? ` · ${movement.createdByName}` : ''}
                    </p>
                  </div>

                  <div className="shrink-0 text-end">
                    <QuantityText
                      milli={movement.qtyMilli}
                      unitCode={item.unitCode}
                      showUnit={false}
                      className={cn('font-semibold', isIn ? 'text-money-in' : 'text-money-out')}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('detail.running')}{' '}
                      <QuantityText milli={movement.runningMilli} unitCode={item.unitCode} />
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        {movements.hasNextPage ? (
          <Button
            variant="secondary"
            className="w-full"
            disabled={movements.isFetchingNextPage}
            onClick={() => void movements.fetchNextPage()}
          >
            {movements.isFetchingNextPage ? tc('a11y.loading') : t('loadMore')}
          </Button>
        ) : null}
      </section>

      <MovementSheet
        open={moving !== null}
        tenantId={tenantId}
        item={moving}
        onClose={() => setMoving(null)}
        onRecorded={() => toast.success(t('saved'))}
      />
    </div>
  );
}
