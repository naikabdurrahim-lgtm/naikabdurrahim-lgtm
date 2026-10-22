import type { LucideIcon } from 'lucide-react';
import { Construction } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';

type ModulePlaceholderProps = {
  icon: LucideIcon;
  titleKey: string;
  phase: number;
};

/**
 * Honest scaffold for modules scheduled in later phases. It renders real
 * navigation and i18n wiring, and states plainly that the feature is not
 * built yet — no fake data, no dead buttons that pretend to work.
 */
export function ModulePlaceholder({ icon: Icon, titleKey, phase }: ModulePlaceholderProps) {
  const { t } = useAppTranslation();

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon aria-hidden="true" className="size-5" />
          </span>
          <h1 className="text-2xl font-bold">{t(titleKey)}</h1>
          <Badge variant="outline" className="ms-auto">
            <Construction aria-hidden="true" className="size-3" />
            {`Phase ${phase}`}
          </Badge>
        </div>
      </header>

      <section className="app-card space-y-3 p-5">
        <p className="text-base font-semibold">{t('placeholder.title')}</p>
        <p className="text-sm text-muted-foreground">{t('placeholder.body')}</p>
        <Button asChild variant="secondary" className="w-full">
          <Link to="/">{t('errors.goHome')}</Link>
        </Button>
      </section>
    </div>
  );
}
