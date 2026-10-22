import { useTranslation } from 'react-i18next';
import type { AppNamespace } from './index';
import type { AppLanguage } from './index';

/**
 * Thin wrapper so feature code imports one helper instead of reaching into
 * i18next directly. `t('key')` is typed by i18next's inferred resources.
 */
export function useAppTranslation(namespace: AppNamespace = 'common') {
  const { t, i18n } = useTranslation(namespace);
  const language = (i18n.resolvedLanguage as AppLanguage | undefined) ?? 'bn';

  return {
    t,
    language,
    isBangla: language === 'bn',
    changeLanguage: (next: AppLanguage) => i18n.changeLanguage(next),
  };
}
