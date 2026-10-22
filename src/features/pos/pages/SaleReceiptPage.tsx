import { RotateCw, ShoppingBasket } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/useAuth';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';

import { ReceiptView } from '../components/ReceiptView';
import { useReceipt } from '../queries';

/**
 * A receipt you can open again — from the success screen, a bookmark, or a
 * "where is my copy?" question a week later. It reads from the database so the
 * numbers are the ones the shop actually recorded, not a client-side guess.
 */
export function SaleReceiptPage() {
  const { saleId = '' } = useParams<{ saleId: string }>();
  const { t } = useAppTranslation('pos');
  const tenantId = useAuth().activeTenant?.tenantId ?? '';
  const receipt = useReceipt(tenantId, saleId);

  if (receipt.isPending) {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <div className="skeleton h-10 w-24" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  if (receipt.isError) {
    return (
      <div className="app-card space-y-3 p-5 text-center" role="alert">
        <p className="text-sm text-muted-foreground">{t('receiptLoadFailed')}</p>
        <Button variant="secondary" className="w-full" onClick={() => void receipt.refetch()}>
          <RotateCw aria-hidden="true" />
          {t('receiptTitle')}
        </Button>
        <Button asChild variant="ghost" className="w-full">
          <Link to="/sell">
            <ShoppingBasket aria-hidden="true" />
            {t('newSaleAfter')}
          </Link>
        </Button>
      </div>
    );
  }

  if (!receipt.data) {
    return (
      <div className="app-card space-y-3 p-5 text-center">
        <p className="font-medium">{t('receiptMissing')}</p>
        <Button asChild className="w-full">
          <Link to="/sell">
            <ShoppingBasket aria-hidden="true" />
            {t('newSaleAfter')}
          </Link>
        </Button>
      </div>
    );
  }

  return <ReceiptView receipt={receipt.data} />;
}
