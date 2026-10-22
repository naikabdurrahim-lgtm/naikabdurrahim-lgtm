import { useState } from 'react';
import { HandCoins, Plus, Search, Users, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorPanel } from '@/components/common/ErrorPanel';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/useAuth';
import { can } from '@/lib/permissions';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

import { useCustomers, useDueSummary, useVoidPayment } from '../queries';
import { CustomerCard } from './CustomerCard';
import { CollectSheet, type CollectedInfo } from './CollectSheet';
import { DueSummaryCard } from './DueSummaryCard';
import { CustomerListSkeleton } from './States';
import { UndoBar } from './UndoBar';

/**
 * The customer list, in both of its jobs: `/due` (only people who owe money,
 * with a collect button) and `/customers` (everyone, searchable).
 *
 * One component because the two screens differ by one flag and one button; two
 * copies would drift, and the বাকি screen is the one that must never break.
 */
export function CustomerListScreen({ mode }: { mode: 'due' | 'all' }) {
  const { t } = useAppTranslation('customers');
  const { t: tc } = useAppTranslation('common');
  const tenant = useAuth().activeTenant;
  const tenantId = tenant?.tenantId ?? '';
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [onlyDue, setOnlyDue] = useState(mode === 'due');
  const [collectFor, setCollectFor] = useState<{
    id: string;
    name: string;
    duePaisa: number;
  } | null>(null);
  const [lastCollected, setLastCollected] = useState<CollectedInfo | null>(null);

  const debounced = useDebouncedValue(search, 250);
  const filterDue = mode === 'due' ? true : onlyDue;

  const customers = useCustomers(tenantId, debounced, filterDue);
  const summary = useDueSummary(tenantId);
  const voidPayment = useVoidPayment(tenantId);

  const rows = customers.data?.pages.flat() ?? [];
  const isSearching = debounced.trim() !== '';
  const canCollect = can(tenant?.role, 'due.collect');

  const undo = async () => {
    if (!lastCollected?.paymentId) {
      setLastCollected(null);
      return;
    }
    try {
      await voidPayment.mutateAsync(lastCollected.paymentId);
    } finally {
      // Either way the window is over: the errors here are already the shop's
      // least interesting problem, and the ledger shows the truth after refetch.
      setLastCollected(null);
    }
  };

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">{mode === 'due' ? t('due.title') : t('title')}</h1>
            <p className="text-sm text-muted-foreground">
              {mode === 'due' ? t('due.subtitle') : t('subtitle')}
            </p>
          </div>
          {mode === 'all' ? (
            <Button variant="ghost" size="sm" onClick={() => navigate('/customers/new')}>
              <Plus aria-hidden="true" />
              {t('addShort')}
            </Button>
          ) : null}
        </div>

        <DueSummaryCard summary={summary.data} loading={summary.isPending} />

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

        {mode === 'all' ? (
          <div className="flex gap-2" role="group" aria-label={t('filterLabel')}>
            <FilterChip
              selected={!onlyDue}
              onClick={() => setOnlyDue(false)}
              label={t('filterAll')}
            />
            <FilterChip
              selected={onlyDue}
              onClick={() => setOnlyDue(true)}
              label={t('filterDue')}
            />
          </div>
        ) : null}
      </header>

      {lastCollected ? (
        <UndoBar
          key={lastCollected.paymentId}
          amountPaisa={lastCollected.amountPaisa}
          pending={voidPayment.isPending}
          onUndo={() => void undo()}
          onExpire={() => setLastCollected(null)}
        />
      ) : null}

      {customers.isPending ? <CustomerListSkeleton /> : null}

      {customers.isError ? (
        <ErrorPanel
          message={t('loadFailed')}
          retryLabel={tc('actions.retry')}
          onRetry={() => void customers.refetch()}
        />
      ) : null}

      {customers.isSuccess && rows.length === 0 ? (
        isSearching ? (
          <EmptyState
            icon={Search}
            title={t('emptySearchTitle')}
            description={t('emptySearchBody')}
          />
        ) : filterDue ? (
          <EmptyState
            icon={HandCoins}
            title={t('due.emptyTitle')}
            description={t('due.emptyBody')}
          />
        ) : (
          <EmptyState
            icon={Users}
            title={t('emptyTitle')}
            description={t('emptyBody')}
            actionLabel={t('addFirst')}
            onAction={() => navigate('/customers/new')}
          />
        )
      ) : null}

      {rows.length > 0 ? (
        <ul className="space-y-2">
          {rows.map((customer) => (
            <li key={customer.id}>
              <CustomerCard
                customer={customer}
                action={
                  mode === 'due' && canCollect && customer.duePaisa > 0 ? (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setCollectFor({
                          id: customer.id,
                          name: customer.name,
                          duePaisa: customer.duePaisa,
                        })
                      }
                    >
                      <HandCoins aria-hidden="true" />
                      {t('collect.short')}
                    </Button>
                  ) : undefined
                }
              />
            </li>
          ))}
        </ul>
      ) : null}

      {customers.hasNextPage ? (
        <Button
          variant="secondary"
          className="w-full"
          disabled={customers.isFetchingNextPage}
          onClick={() => void customers.fetchNextPage()}
        >
          {customers.isFetchingNextPage ? tc('a11y.loading') : t('loadMore')}
        </Button>
      ) : null}

      <CollectSheet
        open={collectFor !== null}
        tenantId={tenantId}
        customer={collectFor}
        onClose={() => setCollectFor(null)}
        onCollected={(info) => setLastCollected(info)}
      />
    </div>
  );
}

function FilterChip({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={
        selected
          ? 'min-h-touch rounded-full border border-primary bg-primary/10 px-4 text-sm font-medium text-primary'
          : 'min-h-touch rounded-full border border-border bg-secondary/40 px-4 text-sm font-medium text-muted-foreground'
      }
    >
      {label}
    </button>
  );
}
