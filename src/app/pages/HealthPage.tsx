import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, Database, Loader2, RefreshCw, Settings2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePreferences } from '@/features/settings/preferences';
import { appConfig } from '@/lib/env';
import { checkSupabaseConnection } from '@/lib/supabase/client';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';

type DbStatus = 'checking' | 'ok' | 'unconfigured' | 'unreachable';

/**
 * Health check: proves the shell, i18n, theme tokens and Supabase wiring work
 * before any business feature is built on top of them (Phase 1 exit criteria).
 */
export function HealthPage() {
  const { t, language } = useAppTranslation();
  const mode = usePreferences((s) => s.mode);
  const appearance = usePreferences((s) => s.appearance);
  const accent = usePreferences((s) => s.accent);
  const fontSize = usePreferences((s) => s.fontSize);
  const numerals = usePreferences((s) => s.numerals);

  const [dbStatus, setDbStatus] = useState<DbStatus>('checking');

  const runCheck = useCallback(async () => {
    setDbStatus('checking');
    const result = await checkSupabaseConnection();
    setDbStatus(result);
  }, []);

  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  const dbOk = dbStatus === 'ok';

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">{t('health.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('health.subtitle')}</p>
      </header>

      <section className="app-card space-y-3 p-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={
              dbOk
                ? 'grid size-10 shrink-0 place-items-center rounded-xl bg-money-in/10 text-money-in'
                : 'grid size-10 shrink-0 place-items-center rounded-xl bg-warning/10 text-warning'
            }
          >
            {dbStatus === 'checking' ? (
              <Loader2 className="size-5 animate-spin" />
            ) : dbOk ? (
              <CheckCircle2 className="size-5" />
            ) : (
              <CircleAlert className="size-5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">
                {dbStatus === 'checking'
                  ? t('health.checking')
                  : dbOk
                    ? t('health.supabaseConfigured')
                    : t('health.supabaseMissing')}
              </p>
              <Badge variant={dbOk ? 'success' : dbStatus === 'checking' ? 'default' : 'warning'}>
                <Database aria-hidden="true" className="size-3" />
                Supabase
              </Badge>
            </div>
            {!dbOk && dbStatus !== 'checking' ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {t('health.supabaseMissingHelp')}
              </p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('actions.retry')}
            onClick={() => void runCheck()}
          >
            <RefreshCw
              aria-hidden="true"
              className={dbStatus === 'checking' ? 'animate-spin' : ''}
            />
          </Button>
        </div>

        {!dbOk && dbStatus !== 'checking' ? (
          <div className="rounded-xl bg-muted/60 p-3">
            <p className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Settings2 aria-hidden="true" className="size-4" />
              {t('setup.title')}
            </p>
            <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
              <li>{t('setup.step1')}</li>
              <li>{t('setup.step2')}</li>
              <li>{t('setup.step3')}</li>
              <li>{t('setup.step4')}</li>
            </ol>
            <p className="mt-2 text-xs text-muted-foreground">{t('setup.envHelp')}</p>
          </div>
        ) : null}
      </section>

      <section className="app-card divide-y divide-border/60">
        <Row label={t('health.appVersion')} value={appConfig.version} />
        <Row
          label={t('health.language')}
          value={language === 'bn' ? 'বাংলা (bn)' : 'English (en)'}
        />
        <Row label={t('health.theme')} value={`${appearance} · ${accent} · ${fontSize}`} />
        <Row label="Mode" value={mode === 'simple' ? 'সহজ মোড' : 'প্রো মোড'} />
        <Row label="Numerals" value={numerals === 'bn' ? '০১২৩' : '0123'} />
        <Row label="Env" value={appConfig.mode} />
      </section>

      <Button asChild variant="secondary" className="w-full">
        <Link to="/settings">{t('nav.settings')}</Link>
      </Button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-end text-sm font-medium">{value}</span>
    </div>
  );
}
