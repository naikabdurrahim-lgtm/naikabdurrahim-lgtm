import { BarChart3, HandCoins, Receipt, TrendingUp, Wallet } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorPanel } from '@/components/common/ErrorPanel';
import { StatCard } from '@/components/common/StatCard';
import { NumberText } from '@/components/common/NumberText';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/useAuth';
import { formatDhakaDate } from '@/lib/datetime';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { can } from '@/lib/permissions';
import { usePreferences } from '@/features/settings/preferences';

import { RecentSalesList } from '../components/RecentSalesList';
import { useRecentSales, useToday } from '../queries';

/**
 * আজকের হিসাব — the closing-time screen.
 *
 * Four numbers and the bills behind them. A cashier sees takings and
 * collections but no profit: the server sends `null` for profit, and a `null`
 * is rendered as nothing at all rather than as a confident ৳০.
 */
export function TodayPage() {
  const { t } = useAppTranslation('reports');
  const { t: tc } = useAppTranslation('common');
  const tenant = useAuth().activeTenant;
  const tenantId = tenant?.tenantId ?? '';
  const numerals = usePreferences((s) => s.numerals);
  const navigate = useNavigate();

  const today = useToday(tenantId);
  const recent = useRecentSales(tenantId);
  const sales = recent.data?.pages.flat() ?? [];
  const canSeeReports = can(tenant?.role, 'reports.view');

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">{t('today.title')}</h1>
            <p className="bn-digits text-sm text-muted-foreground">
              {today.data
                ? formatDhakaDate(today.data.businessDate, numerals)
                : t('today.subtitle')}
            </p>
          </div>
          {canSeeReports ? (
            <Button asChild variant="ghost" size="sm">
              <Link to="/reports">
                <BarChart3 aria-hidden="true" />
                {t('today.reports')}
              </Link>
            </Button>
          ) : null}
        </div>
      </header>

      {today.isError ? (
        <ErrorPanel
          message={t('loadFailed')}
          retryLabel={tc('actions.retry')}
          onRetry={() => void today.refetch()}
        />
      ) : (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t('today.title')}>
          <StatCard
            icon={Receipt}
            label={t('today.sales')}
            paisa={today.data?.salesPaisa ?? null}
            tone="in"
            loading={today.isPending}
          />
          <StatCard
            icon={HandCoins}
            label={t('today.collected')}
            paisa={today.data?.collectedPaisa ?? null}
            tone="in"
            loading={today.isPending}
          />
          <StatCard
            icon={Wallet}
            label={t('today.credit')}
            paisa={today.data?.creditPaisa ?? null}
            tone="out"
            loading={today.isPending}
          />
          {today.data?.profitPaisa !== null && today.data !== undefined ? (
            <StatCard
              icon={TrendingUp}
              label={t('today.profit')}
              paisa={today.data.profitPaisa}
              tone="in"
              loading={today.isPending}
            />
          ) : null}
        </section>
      )}

      <p className="text-sm text-muted-foreground">
        <NumberText value={today.data?.saleCount ?? 0} maxDecimals={0} />{' '}
        {t('today.saleCountLabel')}
      </p>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">{t('today.bills')}</h2>

        {recent.isPending ? (
          <div className="space-y-2" role="status" aria-live="polite">
            {[0, 1, 2].map((row) => (
              <div key={row} className="app-card flex items-center gap-3 p-3">
                <div className="skeleton size-9 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-1/3" />
                  <div className="skeleton h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {recent.isError ? (
          <ErrorPanel
            message={t('loadFailed')}
            retryLabel={tc('actions.retry')}
            onRetry={() => void recent.refetch()}
          />
        ) : null}

        {recent.isSuccess && sales.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={t('today.emptyTitle')}
            description={t('today.emptyBody')}
            actionLabel={t('today.startSelling')}
            onAction={() => navigate('/sell')}
          />
        ) : null}

        {sales.length > 0 ? <RecentSalesList sales={sales} /> : null}

        {recent.hasNextPage ? (
          <Button
            variant="secondary"
            className="w-full"
            disabled={recent.isFetchingNextPage}
            onClick={() => void recent.fetchNextPage()}
          >
            {recent.isFetchingNextPage ? tc('a11y.loading') : t('loadMore')}
          </Button>
        ) : null}
      </section>
    </div>
  );
}
