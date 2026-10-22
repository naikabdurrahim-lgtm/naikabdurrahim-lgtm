import { Database, Settings2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';

/**
 * Shown instead of the sign-in form when `.env` has no Supabase credentials.
 * Honest, actionable, and in Bangla — never a white screen (PROJECT_RULES 3.1 #9).
 */
export function SetupNotice() {
  const { t } = useAppTranslation();

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
        <Button asChild variant="secondary" className="w-full">
          <Link to="/settings">
            <Settings2 aria-hidden="true" />
            {t('nav.settings')}
          </Link>
        </Button>
      </div>
    </div>
  );
}
