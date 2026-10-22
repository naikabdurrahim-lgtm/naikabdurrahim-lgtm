import { useEffect, useMemo, useRef, useState } from 'react';
import { Receipt as ReceiptIcon, ShoppingBasket, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { MoneyText } from '@/components/common/MoneyText';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/useAuth';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { newClientId } from '@/lib/ids';
import { can } from '@/lib/permissions';
import type { Product } from '@/features/products/types';

import { CartLines } from '../components/CartLines';
import { CustomerSheet } from '../components/CustomerSheet';
import { LineSheet } from '../components/LineSheet';
import { PaymentSheet } from '../components/PaymentSheet';
import { ProductPicker } from '../components/ProductPicker';
import { SaleSuccess } from '../components/SaleSuccess';
import { useCart } from '../useCart';
import { toSalePayload } from '../cart';
import {
  useCanDiscount,
  usePosProducts,
  usePosSettings,
  useSubmitSale,
  useVoidSale,
} from '../queries';
import type { CustomerSummary } from '@/features/customers/types';
import { PosError, type SaleResult } from '../types';

/** How long the undo stays available after a sale (PROJECT_RULES 3.1 #10). */
const UNDO_SECONDS = 10;

type MobileTab = 'products' | 'cart';

/**
 * The sell screen.
 *
 * Mobile first: one column with a two-tab switch (products / bill), because a
 * shopkeeper holds the phone in one hand and the goods in the other. On a
 * counter tablet or laptop the two halves sit side by side and no tab is needed.
 *
 * Nothing here computes a total by itself — `cart.ts` does, and the database
 * recomputes it again in `create_sale()`.
 */
export function SellPage() {
  const { t } = useAppTranslation('pos');
  const { t: tc } = useAppTranslation('common');
  const tenant = useAuth().activeTenant;
  const tenantId = tenant?.tenantId ?? '';
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [mobileTab, setMobileTab] = useState<MobileTab>('products');
  const [lineId, setLineId] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [sale, setSale] = useState<SaleResult | null>(null);
  const [changePaisa, setChangePaisa] = useState(0);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [undoLeft, setUndoLeft] = useState(0);

  const debouncedSearch = useDebouncedValue(search, 250);
  const productsQuery = usePosProducts(tenantId, debouncedSearch);
  const settings = usePosSettings(tenantId);
  const canDiscount = useCanDiscount();
  const submitSale = useSubmitSale(tenantId);
  const voidSale = useVoidSale(tenantId);
  const cart = useCart();

  // One id per attempt: a retried submit is the same sale, not a second one.
  const clientId = useRef<string | null>(null);

  const products = useMemo(() => productsQuery.data?.pages.flat() ?? [], [productsQuery.data]);

  const isSearching = debouncedSearch.trim() !== '';
  // A grid of 24 is one screen of scrolling; search narrows the rest.
  const visibleProducts = products.slice(0, 24);

  const unitLabel = (code: Product['unitCode']) => tc(`units.${code}`);

  const warningIds = useMemo(
    () => new Set(cart.warnings.map((line) => line.productId)),
    [cart.warnings],
  );
  const selectedLine = cart.cart.lines.find((line) => line.productId === lineId) ?? null;

  // Undo window: a plain 1-second tick, stopped as soon as it hits zero.
  useEffect(() => {
    if (undoLeft <= 0) return;
    const timer = window.setTimeout(() => setUndoLeft((left) => left - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [undoLeft]);

  const pick = (product: Product) => {
    cart.add(product);
    setErrorText(null);
    // The bill tab shows a count, so there is no need to jump away while the
    // shopkeeper is still adding items.
  };

  /** Enter in the search box: a scanner's newline, or a barcode typed by hand. */
  const handleEnter = () => {
    const term = search.trim();
    if (term === '') return;
    const exact = products.find((product) => product.barcode === term);
    const single = products.length === 1 ? products[0] : undefined;
    const match = exact ?? single;
    if (!match) return;
    pick(match);
    setSearch('');
  };

  const onConfirm = async () => {
    if (cart.problem !== null || tenantId === '') return;
    setErrorText(null);

    const id = clientId.current ?? newClientId();
    clientId.current = id;

    try {
      const result = await submitSale.mutateAsync(toSalePayload(cart.cart, cart.totals, id));
      setChangePaisa(cart.totals.changePaisa);
      setSale(result);
      setPaymentOpen(false);
      setMobileTab('products');
      cart.clear();
      clientId.current = null;
      setUndoLeft(can(tenant?.role, 'sale.void') ? UNDO_SECONDS : 0);
    } catch (cause) {
      const code = cause instanceof PosError ? cause.code : 'unknown';
      setErrorText(t(`errors.${code}`));
    }
  };

  const onUndo = async () => {
    if (!sale || !tenantId) return;
    try {
      await voidSale.mutateAsync({ saleId: sale.saleId, reason: t('voidReason') });
      setUndoLeft(0);
      navigate(`/sell/receipt/${sale.saleId}`);
    } catch (cause) {
      const code = cause instanceof PosError ? cause.code : 'unknown';
      setErrorText(t(`errors.${code}`));
    }
  };

  const startNewSale = () => {
    setSale(null);
    setErrorText(null);
    setChangePaisa(0);
    setUndoLeft(0);
  };

  if (sale) {
    return (
      <SaleSuccess
        sale={sale}
        changePaisa={changePaisa}
        canVoid={can(tenant?.role, 'sale.void')}
        secondsLeft={undoLeft}
        voiding={voidSale.isPending}
        onUndo={() => void onUndo()}
        onNewSale={startNewSale}
      />
    );
  }

  const cartPanel = (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold">{t('cartTitle')}</h2>
        {cart.cart.lines.length > 0 ? (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            {t('items', { total: cart.totals.itemCount })}
          </span>
        ) : null}
        {cart.cart.lines.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="ms-auto"
            onClick={() => {
              cart.clear();
              setErrorText(null);
            }}
          >
            <Trash2 aria-hidden="true" />
            {t('clearCart')}
          </Button>
        ) : null}
      </div>

      {cart.cart.lines.length === 0 ? (
        <div className="app-card space-y-2 p-6 text-center">
          <span
            aria-hidden="true"
            className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary text-muted-foreground"
          >
            <ReceiptIcon className="size-6" />
          </span>
          <p className="font-semibold">{t('cartEmptyTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('cartEmptyBody')}</p>
        </div>
      ) : (
        <>
          <CartLines
            lines={cart.cart.lines}
            unitLabel={unitLabel}
            warningIds={warningIds}
            onStep={cart.step}
            onOpen={(productId) => setLineId(productId)}
            onRemove={cart.remove}
          />

          <div className="app-card space-y-2 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('subtotal')}</span>
              <MoneyText paisa={cart.totals.subtotalPaisa} />
            </div>
            {cart.totals.discountPaisa > 0 ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('discount')}</span>
                <MoneyText paisa={-cart.totals.discountPaisa} />
              </div>
            ) : null}
            <div className="flex items-center justify-between border-t border-border pt-2">
              <span className="font-semibold">{t('total')}</span>
              <MoneyText paisa={cart.totals.totalPaisa} className="text-xl font-bold" />
            </div>
          </div>

          {errorText ? (
            <p role="alert" className="rounded-xl bg-money-out/10 p-3 text-sm text-money-out">
              {errorText}
            </p>
          ) : null}

          <Button size="lg" className="w-full" onClick={() => setPaymentOpen(true)}>
            <ShoppingBasket aria-hidden="true" />
            {t('confirmSale')}
          </Button>
        </>
      )}
    </section>
  );

  return (
    <div className="space-y-4 pb-4">
      <header className="flex items-center gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
      </header>

      {/* Two-tab switch for a phone; both halves visible on a larger screen. */}
      <div
        className="grid grid-cols-2 gap-1 rounded-xl bg-secondary/50 p-1 lg:hidden"
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'products'}
          onClick={() => setMobileTab('products')}
          className={
            mobileTab === 'products'
              ? 'min-h-touch rounded-lg bg-background font-semibold shadow-sm'
              : 'min-h-touch rounded-lg text-muted-foreground'
          }
        >
          {t('title')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'cart'}
          onClick={() => setMobileTab('cart')}
          className={
            mobileTab === 'cart'
              ? 'min-h-touch rounded-lg bg-background font-semibold shadow-sm'
              : 'min-h-touch rounded-lg text-muted-foreground'
          }
        >
          {t('cartTitle')}
          {cart.cart.lines.length > 0 ? ` · ${cart.totals.itemCount}` : ''}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className={mobileTab === 'products' ? 'block' : 'hidden lg:block'}>
          <ProductPicker
            query={search}
            onQueryChange={setSearch}
            products={visibleProducts}
            loading={productsQuery.isPending}
            allowNegativeStock={settings.data?.allowNegativeStock ?? false}
            onPick={pick}
            onEnter={handleEnter}
            heading={isSearching ? t('resultsTitle') : t('quickPicks')}
          />
          {productsQuery.isError ? (
            <p role="alert" className="mt-3 text-sm text-money-out">
              {t('errors.network')}
            </p>
          ) : null}
        </div>

        <div className={mobileTab === 'cart' ? 'block' : 'hidden lg:block'}>{cartPanel}</div>
      </div>

      <LineSheet
        line={selectedLine}
        unitLabel={selectedLine ? unitLabel(selectedLine.unitCode) : ''}
        canEditPrice={can(tenant?.role, 'product.update')}
        onClose={() => setLineId(null)}
        onChangeQty={(qtyMilli) =>
          selectedLine && cart.setQuantity(selectedLine.productId, qtyMilli)
        }
        onChangePrice={(paisa) => selectedLine && cart.setPrice(selectedLine.productId, paisa)}
        onRemove={() => selectedLine && cart.remove(selectedLine.productId)}
      />

      <PaymentSheet
        open={paymentOpen}
        cart={cart.cart}
        totals={cart.totals}
        problem={cart.problem}
        canDiscount={canDiscount}
        submitting={submitSale.isPending}
        errorText={errorText}
        onClose={() => setPaymentOpen(false)}
        onTendered={cart.setTendered}
        onMethod={cart.setMethod}
        onCredit={cart.setCredit}
        onDiscount={cart.setDiscount}
        onNote={cart.setNote}
        onPickCustomer={() => setCustomerOpen(true)}
        onClearCustomer={() => cart.setCustomer(null)}
        onConfirm={() => void onConfirm()}
      />

      <CustomerSheet
        open={customerOpen}
        tenantId={tenantId}
        onClose={() => setCustomerOpen(false)}
        onSelect={(customer: CustomerSummary) => {
          cart.setCustomer(customer);
          setCustomerOpen(false);
        }}
      />
    </div>
  );
}
