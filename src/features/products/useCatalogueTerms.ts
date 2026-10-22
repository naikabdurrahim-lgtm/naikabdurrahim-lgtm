import { getPack } from '@/packs';
import { useAuth } from '@/features/auth/useAuth';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';

/**
 * The words this shop uses for its products.
 *
 * A pharmacy says "ওষুধ", a restaurant says "মেনু", a grocery says "পণ্য". The
 * pack carries the Bangla wording; English falls back to the locale file, because
 * translating six business vocabularies into English is busywork nobody reads.
 */
export function useCatalogueTerms() {
  const { t, isBangla } = useAppTranslation('products');
  const packId = useAuth().activeTenant?.pack;
  const pack = getPack(packId);

  return {
    pack,
    singular: isBangla ? pack.terminology.product : t('product'),
    plural: isBangla ? pack.terminology.products : t('productPlural'),
  };
}
