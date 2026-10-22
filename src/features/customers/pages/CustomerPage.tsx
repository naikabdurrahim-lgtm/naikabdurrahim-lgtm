import { useState } from 'react';
import { ArrowLeft, HandCoins, Loader2, Pencil, Phone, Trash2, TriangleAlert } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorPanel } from '@/components/common/ErrorPanel';
import { MoneyText } from '@/components/common/MoneyText';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { formatBdPhone, toLocalPhone } from '@/features/auth/lib/phone';
import { useAuth } from '@/features/auth/useAuth';
import { can } from '@/lib/permissions';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';

import { CollectSheet, type CollectedInfo } from '../components/CollectSheet';
import { KhataRow } from '../components/KhataRow';
import { KhataSkeleton } from '../components/States';
import { UndoBar } from '../components/UndoBar';
import { useCustomer, useCustomerLedger, useDeleteCustomer, useVoidPayment } from '../queries';
import { isOverCreditLimit } from '../types';

/**
 * One customer's খাতা: what they owe now and every entry that got them there.
 *
 * The ledger is append-only, so this page never offers "edit entry". A mistake
 * is fixed by collecting (or by undoing a collection inside ten seconds), which
 * leaves the history honest.
 */
export function CustomerPage() {
  const { t } = useAppTranslation('customers');
  const { t: tc } = useAppTranslation('common');
  const { customerId = '' } = useParams();
  const tenant = useAuth().activeTenant;
  const tenantId = tenant?.tenantId ?? '';
  const navigate = useNavigate();

  const [collectOpen, setCollectOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [collected, setCollected] = useState<CollectedInfo | null>(null);

  const customer = useCustomer(tenantId, customerId);
  const ledger = useCustomerLedger(tenantId, customerId);
  const voidPayment = useVoidPayment(tenantId);
  const remove = useDeleteCustomer(tenantId);

  const entries = ledger.data?.pages.flat() ?? [];
  const detail = customer.data;
  const localPhone = detail?.phone ? toLocalPhone(detail.phone) : null;
  const overLimit =
    detail !== undefined &&
    isOverCreditLimit({
      duePaisa: detail.duePaisa,
      creditLimitPaisa: detail.creditLimitPaisa,
    });

  const undo = async () => {
    if (!collected?.paymentId) {
      setCollected(null);
      return;
    }
    try {
      await voidPayment.mutateAsync(collected.paymentId);
    } finally {
      setCollected(null);
    }
  };

  const confirmDelete = async () => {
    try {
      await remove.mutateAsync(customerId);
      setDeleteOpen(false);
      navigate('/customers');
    } catch {
      setDeleteOpen(false);
    }
  };

  if (customer.isPending) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-9 w-40" />
        <div className="skeleton h-28 w-full rounded-2xl" />
        <KhataSkeleton />
      </div>
    );
  }

  if (customer.isError) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" onClick={() => navigate('/customers')}>
          <ArrowLeft aria-hidden="true" />
          {tc('actions.back')}
        </Button>
        <ErrorPanel
          message={t('loadFailed')}
          retryLabel={tc('actions.retry')}
          onRetry={() => void customer.refetch()}
        />
      </div>
    );
  }

  if (!detail) {
    return (
      <EmptyState
        icon={Trash2}
        title={t('notFoundTitle')}
        description={t('notFoundBody')}
        actionLabel={t('backToList')}
        onAction={() => navigate('/customers')}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/customers')}>
          <ArrowLeft aria-hidden="true" />
          {tc('actions.back')}
        </Button>
        <div className="ms-auto flex items-center gap-1">
          {can(tenant?.role, 'customer.update') && !detail.isDeleted ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={tc('actions.edit')}
              onClick={() => navigate(`/customers/${detail.id}/edit`)}
            >
              <Pencil aria-hidden="true" />
            </Button>
          ) : null}
          {can(tenant?.role, 'customer.delete') && !detail.isDeleted ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={tc('actions.delete')}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>

      {detail.isDeleted ? (
        <p
          role="status"
          className="rounded-xl bg-secondary/60 px-3 py-2 text-sm text-muted-foreground"
        >
          {t('deletedBanner')}
        </p>
      ) : null}

      <section className="app-card space-y-3 p-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-xl bg-secondary text-lg font-bold"
          >
            {detail.name.trim().charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold">{detail.name}</h1>
            {detail.phone ? (
              <a
                href={`tel:${detail.phone}`}
                className="bn-digits inline-flex min-h-touch items-center gap-1 text-sm text-primary"
              >
                <Phone aria-hidden="true" className="size-4" />
                {formatBdPhone(detail.phone)}
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">{t('noPhone')}</p>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-secondary/40 p-3">
          <p className="text-xs text-muted-foreground">{t('dueNow')}</p>
          <MoneyText
            paisa={detail.duePaisa}
            tone={detail.duePaisa > 0 ? 'out' : 'default'}
            className="block text-3xl font-bold"
          />
          {detail.creditLimitPaisa !== null ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t('creditLimit')} <MoneyText paisa={detail.creditLimitPaisa} />
            </p>
          ) : null}
          {overLimit ? (
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-money-out">
              <TriangleAlert aria-hidden="true" className="size-3.5" />
              {t('overLimit')}
            </p>
          ) : null}
        </div>

        {detail.address ? <p className="text-sm text-muted-foreground">{detail.address}</p> : null}
        {detail.note ? <p className="text-sm text-muted-foreground">{detail.note}</p> : null}

        <div className="flex flex-wrap gap-2">
          {can(tenant?.role, 'due.collect') && detail.duePaisa > 0 && !detail.isDeleted ? (
            <Button size="lg" className="flex-1" onClick={() => setCollectOpen(true)}>
              <HandCoins aria-hidden="true" />
              {t('collect.button')}
            </Button>
          ) : null}
          {localPhone ? (
            <Button asChild variant="outline" size="lg" className="flex-1">
              <a href={`tel:${localPhone}`}>
                <Phone aria-hidden="true" />
                {t('call')}
              </a>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="lg" className="flex-1">
            <Link to="/sell">{t('newSale')}</Link>
          </Button>
        </div>
      </section>

      {collected ? (
        <UndoBar
          key={collected.paymentId}
          amountPaisa={collected.amountPaisa}
          pending={voidPayment.isPending}
          onUndo={() => void undo()}
          onExpire={() => setCollected(null)}
        />
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">{t('ledger.title')}</h2>

        {ledger.isPending ? <KhataSkeleton rows={4} /> : null}

        {ledger.isError ? (
          <ErrorPanel
            message={t('ledger.loadFailed')}
            retryLabel={tc('actions.retry')}
            onRetry={() => void ledger.refetch()}
          />
        ) : null}

        {ledger.isSuccess && entries.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title={t('ledger.emptyTitle')}
            description={t('ledger.emptyBody')}
          />
        ) : null}

        {entries.length > 0 ? (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <KhataRow key={entry.id} entry={entry} />
            ))}
          </ul>
        ) : null}

        {ledger.hasNextPage ? (
          <Button
            variant="secondary"
            className="w-full"
            disabled={ledger.isFetchingNextPage}
            onClick={() => void ledger.fetchNextPage()}
          >
            {ledger.isFetchingNextPage ? tc('a11y.loading') : t('ledger.loadMore')}
          </Button>
        ) : null}
      </section>

      <CollectSheet
        open={collectOpen}
        tenantId={tenantId}
        customer={{ id: detail.id, name: detail.name, duePaisa: detail.duePaisa }}
        onClose={() => setCollectOpen(false)}
        onCollected={(info) => setCollected(info)}
      />

      <Sheet
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('delete.title')}
        description={t('delete.body', { name: detail.name })}
        closeLabel={tc('actions.cancel')}
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('delete.keepHistory')}</p>
          <Button
            variant="destructive"
            size="lg"
            className="w-full"
            disabled={remove.isPending}
            onClick={() => void confirmDelete()}
          >
            {remove.isPending ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              <Trash2 aria-hidden="true" />
            )}
            {t('delete.confirm')}
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => setDeleteOpen(false)}>
            {tc('actions.cancel')}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
