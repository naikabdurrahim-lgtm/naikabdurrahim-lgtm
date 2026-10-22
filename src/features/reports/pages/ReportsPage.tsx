import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, HandCoins, Receipt, TrendingUp, Wallet } from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorPanel } from '@/components/common/ErrorPanel';
import { StatCard } from '@/components/common/StatCard';
import { NumberText } from '@/components/common/NumberText';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/useAuth';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { cn } from '@/lib/utils';

import { DailyBars } from '../components/DailyBars';
import { TopProductsList } from '../components/TopProductsList';
import { useSalesReport, useTopProducts } from '../queries';
import { totalsOf, type ReportRange } from '../types';

const RANGES: { id: ReportRange; key: string }[] = [
  { id: 'today', key: 'range.today' },
  { id: 'week', key: 'range.week' },
  { id: 'month', key: 'range.month' },
];

/**
 * রিপোর্ট — the owner's view.
 *
 * Profit is the point of this screen, so the router keeps cashiers out and the
 * database refuses them as well (`sales_report` raises). The bars are plain
 * buttons: no chart library, nothing to fail offline.
 */
export function ReportsPage() {
  const { t } = useAppTranslation('reports');
  const { t: tc } = useAppTranslation('common');
  const tenant = useAuth().activeTenant;
  const tenantId = tenant?.tenantId ?? '';

  const [range, setRange] = useState<ReportRange>('week');
  const [metric, setMetric] = useState<'sales' | 'profit'>('sales');

  const report = useSalesReport(tenantId, range);
  const top = useTopProducts(tenantId, range);

  const days = report.data ?? [];
  const totals = totalsOf(days);

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        <div className="flex gap-2" role="group" aria-label={t('range.label')}>
          {RANGES.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={range === option.id}
              onClick={() => setRange(option.id)}
              className={cn(
                'min-h-touch flex-1 rounded-full border px-4 text-sm font-medium',
                range === option.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-secondary/40 text-muted-foreground',
              )}
            >
              {t(option.key)}
            </button>
          ))}
        </div>
      </header>

      {report.isError ? (
        <ErrorPanel
          message={t('loadFailed')}
          retryLabel={tc('actions.retry')}
          onRetry={() => void report.refetch()}
        />
      ) : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t('title')}>
        <StatCard
          icon={Receipt}
          label={t('totals.sales')}
          paisa={report.data ? totals.salesPaisa : null}
          tone="in"
          loading={report.isPending}
        />
        <StatCard
          icon={TrendingUp}
          label={t('totals.profit')}
          paisa={report.data ? totals.profitPaisa : null}
          tone="in"
          loading={report.isPending}
        />
        <StatCard
          icon={Wallet}
          label={t('totals.credit')}
          paisa={report.data ? totals.creditPaisa : null}
          tone="out"
          loading={report.isPending}
        />
        <StatCard
          icon={HandCoins}
          label={t('totals.collected')}
          paisa={report.data ? totals.collectedPaisa : null}
          tone="in"
          loading={report.isPending}
        />
      </section>

      <section className="app-card space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{t('chart.title')}</h2>
          <div className="flex gap-1" role="group" aria-label={t('chart.metric')}>
            {(['sales', 'profit'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={metric === option}
                onClick={() => setMetric(option)}
                className={cn(
                  'min-h-touch rounded-full px-3 text-xs font-medium',
                  metric === option
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary/60',
                )}
              >
                {t(option === 'sales' ? 'chart.sales' : 'chart.profit')}
              </button>
            ))}
          </div>
        </div>

        {report.isPending ? (
          <div className="skeleton h-32 w-full" role="status" aria-live="polite" />
        ) : days.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('chart.empty')}</p>
        ) : (
          <DailyBars days={days} metric={metric} />
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">{t('top.title')}</h2>

        {top.isPending ? (
          <div className="space-y-2" role="status" aria-live="polite">
            {[0, 1, 2].map((row) => (
              <div key={row} className="app-card h-16 p-3">
                <div className="skeleton h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : null}

        {top.isError ? (
          <ErrorPanel
            message={t('loadFailed')}
            retryLabel={tc('actions.retry')}
            onRetry={() => void top.refetch()}
          />
        ) : null}

        {top.isSuccess && (top.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={BarChart3}
            title={t('top.emptyTitle')}
            description={t('top.emptyBody')}
          />
        ) : null}

        {top.data && top.data.length > 0 ? <TopProductsList products={top.data} /> : null}
      </section>

      {report.data && days.length > 0 ? (
        <p className="text-center text-xs text-muted-foreground">
          {t('totals.saleCount')} <NumberText value={totals.saleCount} maxDecimals={0} />
        </p>
      ) : null}

      <Button asChild variant="secondary" className="w-full">
        <Link to="/today">{t('backToToday')}</Link>
      </Button>
    </div>
  );
}
