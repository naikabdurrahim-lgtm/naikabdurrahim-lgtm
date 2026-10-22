import { calcDiscount, lineTotalPaisa } from '@/lib/money';
import { MILLI_PER_UNIT } from '@/lib/quantity';
import type { UnitCode } from '@/packs';

import type { Cart, CartLine, CartTotals, DiscountInput, PaymentMethod } from './types';

/**
 * All the arithmetic of a sale, with no React and no network.
 *
 * The same rules the database enforces in `create_sale()` (migration 0009) are
 * mirrored here so a mistake is caught before the network round-trip — the
 * server stays the judge, this module just avoids a pointless failure.
 */

export const EMPTY_CART: Cart = {
  lines: [],
  customer: null,
  discount: { kind: 'amount', paisa: 0 },
  method: 'cash',
  tenderedPaisa: 0,
  credit: false,
  note: '',
};

/** Units sold in halves make sense; pieces do not. */
export function qtyStepMilli(unitCode: UnitCode): number {
  switch (unitCode) {
    case 'kg':
    case 'litre':
    case 'gram':
    case 'ml':
      return 500;
    default:
      return MILLI_PER_UNIT;
  }
}

function clampQty(qtyMilli: number): number {
  if (!Number.isFinite(qtyMilli) || qtyMilli < 0) return 0;
  // 999.999 in the largest unit a shop would ever sell in one line.
  return Math.min(Math.round(qtyMilli), 999_999);
}

function replaceLine(cart: Cart, productId: string, next: CartLine): Cart {
  return {
    ...cart,
    lines: cart.lines.map((line) => (line.productId === productId ? next : line)),
  };
}

/**
 * Adds a product, or raises the quantity when it is already on the bill.
 * The price of the existing line is kept: the shopkeeper may have edited it.
 */
export function addLine(
  cart: Cart,
  product: {
    id: string;
    name: string;
    unitCode: UnitCode;
    isService: boolean;
    sellPricePaisa: number;
    stockMilli: number;
  },
  qtyMilli: number = MILLI_PER_UNIT,
): Cart {
  const existing = cart.lines.find((line) => line.productId === product.id);
  if (existing) {
    return replaceLine(cart, product.id, {
      ...existing,
      qtyMilli: clampQty(existing.qtyMilli + qtyMilli),
    });
  }

  return {
    ...cart,
    lines: [
      ...cart.lines,
      {
        productId: product.id,
        name: product.name,
        unitCode: product.unitCode,
        isService: product.isService,
        unitPricePaisa: product.sellPricePaisa,
        qtyMilli: clampQty(qtyMilli),
        stockMilli: product.stockMilli,
      },
    ],
  };
}

export function setQty(cart: Cart, productId: string, qtyMilli: number): Cart {
  const line = cart.lines.find((candidate) => candidate.productId === productId);
  if (!line) return cart;
  // A typed "-5" or "" is a slip of the finger, not a request to delete the
  // line: only an explicit zero removes it (the database rejects qty = 0).
  if (!Number.isFinite(qtyMilli) || qtyMilli < 0) return cart;
  if (qtyMilli === 0) return removeLine(cart, productId);
  return replaceLine(cart, productId, { ...line, qtyMilli: clampQty(qtyMilli) });
}

export function stepQty(cart: Cart, productId: string, direction: 1 | -1): Cart {
  const line = cart.lines.find((candidate) => candidate.productId === productId);
  if (!line) return cart;
  const step = qtyStepMilli(line.unitCode);
  if (direction === 1) return setQty(cart, productId, line.qtyMilli + step);

  const next = line.qtyMilli - step;
  // A half-kilo still on the bill steps down to zero and disappears.
  return next <= 0 ? removeLine(cart, productId) : setQty(cart, productId, next);
}

export function removeLine(cart: Cart, productId: string): Cart {
  return { ...cart, lines: cart.lines.filter((line) => line.productId !== productId) };
}

export function setUnitPrice(cart: Cart, productId: string, unitPricePaisa: number): Cart {
  const line = cart.lines.find((candidate) => candidate.productId === productId);
  if (!line) return cart;
  if (!Number.isInteger(unitPricePaisa) || unitPricePaisa < 0) return cart;
  return replaceLine(cart, productId, { ...line, unitPricePaisa });
}

export function setDiscount(cart: Cart, discount: DiscountInput): Cart {
  return { ...cart, discount };
}

export function setMethod(cart: Cart, method: PaymentMethod): Cart {
  return { ...cart, method };
}

export function setTendered(cart: Cart, tenderedPaisa: number): Cart {
  const safe = Number.isFinite(tenderedPaisa) ? Math.max(0, Math.round(tenderedPaisa)) : 0;
  return { ...cart, tenderedPaisa: safe };
}

export function setCredit(cart: Cart, credit: boolean): Cart {
  // Credit with the full amount paid is the same sale; the flag also clears the
  // customer when it is switched off, so a cash sale never collects a name it
  // does not need.
  return credit ? { ...cart, credit } : { ...cart, credit, customer: null };
}

/**
 * The amount on the bill. Values are clamped, never negative: a shopkeeper
 * typing a bigger discount than the bill gets "free", not a negative sale.
 */
export function computeTotals(cart: Cart): CartTotals {
  const subtotalPaisa = cart.lines.reduce(
    (sum, line) => sum + lineTotalPaisa(line.unitPricePaisa, line.qtyMilli),
    0,
  );

  const discountPaisa =
    cart.discount.kind === 'percent'
      ? calcDiscount(subtotalPaisa, { type: 'percent', valuePercent: cart.discount.percent })
      : calcDiscount(subtotalPaisa, { type: 'amount', valuePaisa: cart.discount.paisa });

  const totalPaisa = Math.max(0, subtotalPaisa - discountPaisa);

  // A cash sale with nothing typed is an exact payment, not a free one: the
  // shopkeeper only opens the amount field when the customer hands over more or
  // less than the bill. Credit sales start from whatever was actually received.
  const cashPaisa = !cart.credit && cart.tenderedPaisa === 0 ? totalPaisa : cart.tenderedPaisa;
  const paidPaisa = Math.min(cashPaisa, totalPaisa);
  const duePaisa = totalPaisa - paidPaisa;
  const changePaisa = cart.credit ? 0 : Math.max(0, cashPaisa - totalPaisa);

  return {
    subtotalPaisa,
    discountPaisa,
    totalPaisa,
    paidPaisa,
    duePaisa,
    changePaisa,
    itemCount: cart.lines.length,
  };
}

export type SaleProblem = 'empty' | 'customer_required' | 'credit_required';

/** Why the sale cannot be completed yet, or `null` when it can. */
export function saleProblem(
  cart: Cart,
  totals: CartTotals = computeTotals(cart),
): SaleProblem | null {
  if (cart.lines.length === 0 || totals.totalPaisa <= 0) return 'empty';
  if (totals.duePaisa > 0 && !cart.credit) return 'credit_required';
  if (totals.duePaisa > 0 && !cart.customer) return 'customer_required';
  return null;
}

/** Lines that will hit the stock guard, so the UI can warn before the refusal. */
export function stockWarnings(cart: Cart): CartLine[] {
  return cart.lines.filter((line) => !line.isService && line.qtyMilli > line.stockMilli);
}

export type SalePayload = {
  client_id: string;
  customer_id?: string | null;
  subtotal_paisa: number;
  discount_paisa: number;
  discount_kind: 'amount' | 'percent';
  paid_paisa: number;
  payment_method: PaymentMethod;
  note?: string;
  items: Array<{ product_id: string; qty: string; unit_price_paisa: number }>;
};

/**
 * Builds the RPC payload. Quantities go out as fixed 3-decimal strings so the
 * server receives exactly what was typed — `1.5` never becomes `1.4999999`.
 */
export function toSalePayload(cart: Cart, totals: CartTotals, clientId: string): SalePayload {
  const payload: SalePayload = {
    client_id: clientId,
    subtotal_paisa: totals.subtotalPaisa,
    discount_paisa: totals.discountPaisa,
    discount_kind: cart.discount.kind,
    paid_paisa: totals.paidPaisa,
    payment_method: cart.method,
    items: cart.lines.map((line) => ({
      product_id: line.productId,
      qty: (line.qtyMilli / MILLI_PER_UNIT).toFixed(3),
      unit_price_paisa: line.unitPricePaisa,
    })),
  };

  if (cart.customer) payload.customer_id = cart.customer.id;
  if (cart.note.trim() !== '') payload.note = cart.note.trim();

  return payload;
}
