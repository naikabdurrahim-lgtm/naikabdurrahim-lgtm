import { useCallback, useMemo, useState } from 'react';

import type { UnitCode } from '@/packs';

import {
  EMPTY_CART,
  addLine,
  computeTotals,
  removeLine,
  saleProblem,
  setCredit,
  setDiscount,
  setMethod,
  setQty,
  setTendered,
  setUnitPrice,
  stepQty,
  stockWarnings,
} from './cart';
import type { Cart, CartCustomer, DiscountInput, PaymentMethod } from './types';

type AddableProduct = {
  id: string;
  name: string;
  unitCode: UnitCode;
  isService: boolean;
  sellPricePaisa: number;
  stockMilli: number;
};

/**
 * The bill in progress, held in memory only.
 *
 * Deliberately not persisted: a shared shop phone must not keep yesterday's
 * prices or a cashier's half-finished bill in `localStorage`. Durable drafts
 * arrive with the offline store in Phase 9, where they can be encrypted and
 * keyed per user.
 */
export function useCart() {
  const [cart, setCart] = useState<Cart>(EMPTY_CART);

  const add = useCallback((product: AddableProduct, qtyMilli?: number) => {
    setCart((prev) => addLine(prev, product, qtyMilli));
  }, []);

  const step = useCallback((productId: string, direction: 1 | -1) => {
    setCart((prev) => stepQty(prev, productId, direction));
  }, []);

  const setQuantity = useCallback((productId: string, qtyMilli: number) => {
    setCart((prev) => setQty(prev, productId, qtyMilli));
  }, []);

  const remove = useCallback((productId: string) => {
    setCart((prev) => removeLine(prev, productId));
  }, []);

  const setPrice = useCallback((productId: string, unitPricePaisa: number) => {
    setCart((prev) => setUnitPrice(prev, productId, unitPricePaisa));
  }, []);

  const setDiscountValue = useCallback((discount: DiscountInput) => {
    setCart((prev) => setDiscount(prev, discount));
  }, []);

  const setPaymentMethod = useCallback((method: PaymentMethod) => {
    setCart((prev) => setMethod(prev, method));
  }, []);

  const setTenderedAmount = useCallback((paisa: number) => {
    setCart((prev) => setTendered(prev, paisa));
  }, []);

  const setCreditSale = useCallback((credit: boolean) => {
    setCart((prev) => setCredit(prev, credit));
  }, []);

  const setCustomer = useCallback((customer: CartCustomer | null) => {
    setCart((prev) => ({ ...prev, customer }));
  }, []);

  const setNote = useCallback((note: string) => {
    setCart((prev) => ({ ...prev, note }));
  }, []);

  const clear = useCallback(() => setCart(EMPTY_CART), []);

  const totals = useMemo(() => computeTotals(cart), [cart]);
  const problem = useMemo(() => saleProblem(cart, totals), [cart, totals]);
  const warnings = useMemo(() => stockWarnings(cart), [cart]);

  return {
    cart,
    totals,
    problem,
    warnings,
    add,
    step,
    setQuantity,
    remove,
    setPrice,
    setDiscount: setDiscountValue,
    setMethod: setPaymentMethod,
    setTendered: setTenderedAmount,
    setCredit: setCreditSale,
    setCustomer,
    setNote,
    clear,
  };
}

export type UseCart = ReturnType<typeof useCart>;
