import { BarChart3, BookOpen, Boxes, ShoppingCart, Store, Users, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { BigActionButton } from '@/components/common/BigActionButton';
import { StatCard } from '@/components/common/StatCard';
import { NumberText } from '@/components/common/NumberText';
import { Button } from '@/components/ui/button';
import { usePreferences } from '@/features/settings/preferences';
import { useAuth } from '@/features/auth/useAuth';
import { useDueSummary } from '@/features/customers/queries';
import { useToday } from '@/features/reports/queries';
import { useStockOverview } from '@/features/stock/queries';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';

/**
 * Home. Simple Mode shows only the four primary actions (PROJECT_RULES 3.1 #4).
 * Pro Mode adds the dashboard tiles. Amounts stay empty until the data layer
 * lands in Phase 2+ — the UI never fabricates a number.
 */
export function HomePage() {
  const { t } = useAppTranslation();
  const mode = usePreferences((s) => s.mode);
  const tenantId = useAuth().activeTenant?.tenantId ?? '';

  // The dashboard is the same data the আজকের হিসাব screen uses, so the two can
  // never disagree. A cashier gets `null` for profit and sees collections instead.
  const today = useToday(tenantId);
  const due = useDueSummary(tenantId);
  const stock = useStockOverview(tenantId);
  const showProfit = today.data?.profitPaisa !== null && today.data !== undefined;

  return (
    <div className="space-y-5">
      <section className="space-y-1">
        <p className="text-sm text-muted-foreground">{t('home.greeting')}</p>
        <h1 className="text-2xl font-bold">{t('app.name')}</h1>
        <p className="text-sm text-muted-foreground">
          {mode === 'simple' ? t('home.simpleModeHint') : t('home.proModeHint')}
        </p>
      </section>

      {mode === 'simple' ? (
        <section aria-label={t('home.simpleModeHint')} className="grid grid-cols-2 gap-3">
          <BigActionButton icon={ShoppingCart} label={t('nav.sell')} to="/sell" tone="primary" />
          <BigActionButton icon={Wallet} label={t('nav.due')} to="/due" tone="due" />
          <BigActionButton icon={Boxes} label={t('nav.stock')} to="/stock" tone="stock" />
          <BigActionButton icon={BarChart3} label={t('nav.today')} to="/today" tone="today" />
        </section>
      ) : (
        <>
          <section aria-label={t('nav.today')} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={ShoppingCart}
              label={t('home.todaysSales')}
              paisa={today.data?.salesPaisa ?? null}
              tone="in"
              loading={today.isPending}
            />
            {showProfit ? (
              <StatCard
                icon={BarChart3}
                label={t('home.todaysProfit')}
                paisa={today.data?.profitPaisa ?? null}
                tone="in"
                loading={today.isPending}
              />
            ) : (
              <StatCard
                icon={BarChart3}
                label={t('home.todaysCollected')}
                paisa={today.data?.collectedPaisa ?? null}
                tone="in"
                loading={today.isPending}
              />
            )}
            <StatCard
              icon={Boxes}
              label={t('home.stockValue')}
              paisa={stock.data?.valuePaisa ?? null}
              loading={stock.isPending}
            />
            <StatCard
              icon={Wallet}
              label={t('home.totalDue')}
              paisa={due.data?.totalDuePaisa ?? null}
              tone="out"
              loading={due.isPending}
            />
          </section>

          <section aria-label={t('home.proModeHint')} className="grid gap-3 sm:grid-cols-3">
            <QuickLink icon={BookOpen} to="/products" label={t('nav.products')} />
            <QuickLink icon={Users} to="/customers" label={t('nav.customers')} />
            <QuickLink icon={BarChart3} to="/reports" label={t('nav.reports')} />
          </section>
        </>
      )}

      {stock.data && stock.data.outCount + stock.data.lowCount > 0 ? (
        <Link
          to="/stock"
          className="app-card flex min-h-touch items-center gap-3 p-4 text-sm font-medium"
        >
          <span
            aria-hidden="true"
            className="grid size-10 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400"
          >
            <Boxes className="size-5" />
          </span>
          <span className="flex-1">
            <NumberText value={stock.data.lowCount + stock.data.outCount} maxDecimals={0} />{' '}
            {t('home.lowStockLabel')}
          </span>
        </Link>
      ) : null}

      <section className="app-card flex items-center gap-3 p-4">
        <span
          aria-hidden="true"
          className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"
        >
          <Store className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t('health.title')}</p>
          <p className="truncate text-xs text-muted-foreground">{t('health.subtitle')}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/health">{t('actions.next')}</Link>
        </Button>
      </section>
    </div>
  );
}

function QuickLink({ icon: Icon, to, label }: { icon: LucideIcon; to: string; label: string }) {
  return (
    <Link
      to={to}
      className="app-card flex min-h-touch items-center gap-3 p-4 text-sm font-medium transition hover:bg-secondary/50"
    >
      <span
        aria-hidden="true"
        className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"
      >
        <Icon className="size-5" />
      </span>
      {label}
    </Link>
  );
}
