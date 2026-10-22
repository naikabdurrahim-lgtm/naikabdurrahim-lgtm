import { Database, RotateCw, Stethoscope } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { env } from '@/lib/env';

/**
 * The names of the variables that are still empty.
 *
 * Names only, never values: this screen is the one place a mistake is most
 * likely, and a screenshot of it must be safe to paste into a chat.
 */
function missingVariableNames(): string {
  const missing: string[] = [];
  if (!env.VITE_SUPABASE_URL) missing.push('VITE_SUPABASE_URL');
  if (!env.VITE_SUPABASE_ANON_KEY) missing.push('VITE_SUPABASE_ANON_KEY');
  return missing.join(' · ');
}

/**
 * Shown instead of the sign-in form when `.env` has no Supabase credentials.
 * Honest, actionable, and in Bangla — never a white screen (PROJECT_RULES 3.1 #9).
 *
 * Phase 7 fix: this screen used to offer a "সেটিংস" button. Settings lives
 * behind RequireAuth, so without a Supabase key it opened… this screen again.
 * A retry and the public health check are the only two things that can
 * actually help from here.
 */
export function SetupNotice() {
  const { t } = useAppTranslation();
  const missing = missingVariableNames();

  return (
    <div className="grid min-h-dvh place-items-center bg-background p-4">
      <div className="app-card w-full max-w-md space-y-4 p-6">
        <div className="grid size-12 place-items-center rounded-xl bg-warning/10 text-warning">
          <Database aria-hidden="true" className="size-6" />
        </div>
        <h1 className="text-xl font-semibold">{t('setup.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('setup.envHelp')}</p>
        <ol className="list-inside list-decimal space-y-1.5 text-sm text-muted-foreground">
          <li>{t('setup.step1')}</li>
          <li>{t('setup.step2')}</li>
          <li>{t('setup.step3')}</li>
          <li>{t('setup.step4')}</li>
        </ol>
        {missing ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            {t('setup.missing')} <code className="font-mono text-foreground">{missing}</code>
          </p>
        ) : null}
        <div className="space-y-2">
          <Button className="w-full" onClick={() => window.location.reload()}>
            <RotateCw aria-hidden="true" />
            {t('setup.recheck')}
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/health">
              <Stethoscope aria-hidden="true" />
              {t('setup.health')}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
