import { NavLink, Outlet } from 'react-router-dom';
import { Languages, Moon, Store, Sun } from 'lucide-react';
import { SyncStatusPill } from '@/components/common/SyncStatusPill';
import { Button } from '@/components/ui/button';
import { usePreferences } from '@/features/settings/preferences';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { cn } from '@/lib/utils';
import { visibleNavItems } from '@/app/navigation';

/**
 * App shell: sticky header, content area, and navigation that changes shape by
 * screen size. On phones the primary actions sit at the bottom for one-handed
 * use (PROJECT_RULES 3.1 #5).
 */
export function AppShell() {
  const { t, language, changeLanguage } = useAppTranslation();
  const mode = usePreferences((s) => s.mode);
  const appearance = usePreferences((s) => s.appearance);
  const setAppearance = usePreferences((s) => s.setAppearance);

  const items = visibleNavItems(mode);
  const nextAppearance = appearance === 'light' ? 'dark' : 'light';

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        {t('a11y.skipToContent')}
      </a>

      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"
            >
              <Store className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight">{t('app.name')}</p>
              <p className="truncate text-xs text-muted-foreground">{t('app.shortTagline')}</p>
            </div>
          </div>

          <div className="ms-auto flex items-center gap-1">
            <SyncStatusPill className="hidden sm:inline-flex" />
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('a11y.languageSwitch')}
              onClick={() => changeLanguage(language === 'bn' ? 'en' : 'bn')}
            >
              <Languages aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('a11y.toggleTheme')}
              onClick={() => setAppearance(nextAppearance)}
            >
              {appearance === 'light' ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1">
        {/* Desktop sidebar */}
        <nav
          aria-label={t('app.name')}
          className="sticky top-[65px] hidden h-[calc(100dvh-65px)] w-56 shrink-0 flex-col gap-1 border-e border-border/60 p-3 lg:flex"
        >
          {items.map(({ to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex min-h-touch items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )
              }
            >
              <Icon aria-hidden="true" className="size-5" />
              {t(labelKey)}
            </NavLink>
          ))}
        </nav>

        <main id="main" className="min-w-0 flex-1 px-4 pb-28 pt-4 lg:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        aria-label={t('app.name')}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
          {items.map(({ to, labelKey, icon: Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-touch flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[0.7rem] font-medium leading-none',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon aria-hidden="true" className={cn('size-6', isActive && 'stroke-[2.5]')} />
                    <span className="truncate">{t(labelKey)}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
