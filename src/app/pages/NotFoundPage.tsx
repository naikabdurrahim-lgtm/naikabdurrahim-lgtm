import { MapPinOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';

export function NotFoundPage() {
  const { t } = useAppTranslation();

  return (
    <div className="grid min-h-[60dvh] place-items-center">
      <div className="app-card max-w-sm space-y-4 p-6 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
          <MapPinOff aria-hidden="true" className="size-7" />
        </div>
        <h1 className="text-xl font-semibold">{t('errors.notFound')}</h1>
        <p className="text-sm text-muted-foreground">{t('errors.notFoundHelp')}</p>
        <Button asChild className="min-h-cta w-full">
          <Link to="/">{t('errors.goHome')}</Link>
        </Button>
      </div>
    </div>
  );
}
