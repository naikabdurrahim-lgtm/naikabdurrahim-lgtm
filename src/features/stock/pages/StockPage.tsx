import { useState } from 'react';
import { PackagePlus, Plus, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorPanel } from '@/components/common/ErrorPanel';
import { NumberText } from '@/components/common/NumberText';
import { MoneyText } from '@/components/common/MoneyText';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/useAuth';
import { can } from '@/lib/permissions';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { cn } from '@/lib/utils';

import { MovementSheet } from '../components/MovementSheet';
import { StockRow } from '../components/StockRow';
import { StockListSkeleton } from '../components/States';
import { useStock, useStockOverview } from '../queries';
import type { StockFilter, StockItem } from '../types';

const FILTERS: { id: StockFilter; key: string }[] = [
  { id: 'all', key: 'filter.all' },
  { id: 'low', key: 'filter.low' },
  { id: 'out', key: 'filter.out' },
];

/**
 * স্টক — what is left, what is running out, what it is worth.
 *
 * Sorted by trouble, not by name: the finished product is the one the shopkeeper
 * has to deal with before the next customer.
 */
export function StockPage() {
  const { t } = useAppTranslation('stock');
  const { t: tc } = useAppTranslation('common');
  const tenant = useAuth().activeTenant;
  const tenantId = tenant?.tenantId ?? '';
  const canMove = can(tenant?.role, 'stock.move');
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StockFilter>('all');
  const [moving, setMoving] = useState<StockItem | null>(null);

  const debounced = useDebouncedValue(search, 250);
  const stock = useStock(tenantId, debounced, filter);
  const overview = useStockOverview(tenantId);

  const rows = stock.data?.pages.flat() ?? [];
  const isSearching = debounced.trim() !== '' || filter !== 'all';

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniStat label={t('overview.products')} value={overview.data?.productCount ?? 0} />
          <MiniStat label={t('overview.low')} value={overview.data?.lowCount ?? 0} tone="warn" />
          <MiniStat label={t('overview.out')} value={overview.data?.outCount ?? 0} tone="bad" />
          <div className="app-card space-y-1 p-3">
            <p className="text-xs text-muted-foreground">{t('overview.value')}</p>
            {overview.data?.valuePaisa === null || overview.data === undefined ? (
              <p className="text-lg font-bold text-muted-foreground/60">—</p>
            ) : (
              <MoneyText paisa={overview.data.valuePaisa} className="text-lg font-bold" />
            )}
          </div>
        </div>

        <div className="flex min-h-cta items-center gap-2 rounded-xl border border-input bg-secondary/40 px-3 focus-within:border-primary">
          <Search aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchLabel')}
            className="min-h-cta w-full bg-transparent text-base outline-none"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label={tc('actions.cancel')}
              className="grid size-8 place-items-center rounded-full text-muted-foreground hover:text-foreground"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          ) : null}
        </div>

        <div className="flex gap-2" role="group" aria-label={t('filter.label')}>
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={filter === option.id}
              onClick={() => setFilter(option.id)}
              className={cn(
                'min-h-touch rounded-full border px-4 text-sm font-medium',
                filter === option.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-secondary/40 text-muted-foreground',
              )}
            >
              {t(option.key)}
            </button>
          ))}
        </div>
      </header>

      {stock.isPending ? <StockListSkeleton /> : null}

      {stock.isError ? (
        <ErrorPanel
          message={t('loadFailed')}
          retryLabel={tc('actions.retry')}
          onRetry={() => void stock.refetch()}
        />
      ) : null}

      {stock.isSuccess && rows.length === 0 ? (
        <EmptyState
          icon={PackagePlus}
          title={isSearching ? t('emptySearchTitle') : t('emptyTitle')}
          description={isSearching ? t('emptySearchBody') : t('emptyBody')}
          {...(isSearching
            ? {}
            : { actionLabel: t('emptyAction'), onAction: () => navigate('/products/new') })}
        />
      ) : null}

      {rows.length > 0 ? (
        <ul className="space-y-2">
          {rows.map((item) => (
            <div key={item.id} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <StockRow item={item} />
              </div>
              {canMove ? (
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label={t('adjustFor', { name: item.name })}
                  className="mt-3 shrink-0"
                  onClick={() => setMoving(item)}
                >
                  <Plus aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          ))}
        </ul>
      ) : null}

      {stock.hasNextPage ? (
        <Button
          variant="secondary"
          className="w-full"
          disabled={stock.isFetchingNextPage}
          onClick={() => void stock.fetchNextPage()}
        >
          {stock.isFetchingNextPage ? tc('a11y.loading') : t('loadMore')}
        </Button>
      ) : null}

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

function MiniStat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'warn' | 'bad';
}) {
  return (
    <div className="app-card space-y-1 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <NumberText
        value={value}
        className={cn(
          'text-lg font-bold',
          tone === 'warn' && value > 0 && 'text-amber-600 dark:text-amber-400',
          tone === 'bad' && value > 0 && 'text-money-out',
        )}
      />
    </div>
  );
}
