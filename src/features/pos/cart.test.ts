import { describe, expect, it } from 'vitest';

import {
  EMPTY_CART,
  addLine,
  computeTotals,
  qtyStepMilli,
  removeLine,
  saleProblem,
  setCredit,
  setDiscount,
  setQty,
  setTendered,
  setUnitPrice,
  stepQty,
  stockWarnings,
  toSalePayload,
} from './cart';
import type { Cart } from './types';

/**
 * Cart arithmetic is where a POS quietly loses money. These tests pin the three
 * things that go wrong in real shops: fractional units, discounts, and change.
 */

const rice = {
  id: 'p-rice',
  name: 'মিনিকেট চাল',
  unitCode: 'kg' as const,
  isService: false,
  sellPricePaisa: 7500,
  stockMilli: 20_000,
};

const soap = {
  id: 'p-soap',
  name: 'সাবান',
  unitCode: 'piece' as const,
  isService: false,
  sellPricePaisa: 3500,
  stockMilli: 40_000,
};

const delivery = {
  id: 'p-delivery',
  name: 'হোম ডেলিভারি',
  unitCode: 'piece' as const,
  isService: true,
  sellPricePaisa: 3000,
  stockMilli: 0,
};

const customer = { id: 'c-1', name: 'রহিম ভাই', phone: '+8801712345678' };

function cartWith(...products: Array<Parameters<typeof addLine>[1]>): Cart {
  return products.reduce((cart, product) => addLine(cart, product), EMPTY_CART);
}

describe('adding to the bill', () => {
  it('adds a new line at one unit', () => {
    const cart = cartWith(rice);
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]?.qtyMilli).toBe(1000);
  });

  it('raises the quantity instead of duplicating the same product', () => {
    const cart = addLine(addLine(EMPTY_CART, soap), soap);
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]?.qtyMilli).toBe(2000);
  });

  it('steps halves for weights and whole pieces for the rest', () => {
    expect(qtyStepMilli('kg')).toBe(500);
    expect(qtyStepMilli('litre')).toBe(500);
    expect(qtyStepMilli('piece')).toBe(1000);
    expect(qtyStepMilli('packet')).toBe(1000);
  });

  it('steps a half-kilo down to nothing and removes the line', () => {
    let cart = addLine(EMPTY_CART, rice, 500);
    cart = stepQty(cart, rice.id, -1);
    expect(cart.lines).toHaveLength(0);
  });

  it('treats a zero quantity as a removal', () => {
    expect(setQty(cartWith(soap), soap.id, 0).lines).toHaveLength(0);
  });

  it('never accepts a negative or nonsense quantity', () => {
    expect(setQty(cartWith(soap), soap.id, -5).lines[0]?.qtyMilli).toBe(1000);
    expect(setQty(cartWith(soap), soap.id, Number.NaN).lines[0]?.qtyMilli).toBe(1000);
  });

  it('removes only the line asked for', () => {
    const cart = removeLine(cartWith(rice, soap), rice.id);
    expect(cart.lines.map((line) => line.productId)).toEqual([soap.id]);
  });
});

describe('prices', () => {
  it('lets the price be edited for a negotiated sale', () => {
    const cart = setUnitPrice(cartWith(soap), soap.id, 3000);
    expect(computeTotals(cart).totalPaisa).toBe(3000);
  });

  it('ignores a negative or fractional price', () => {
    expect(setUnitPrice(cartWith(soap), soap.id, -1).lines[0]?.unitPricePaisa).toBe(3500);
    expect(setUnitPrice(cartWith(soap), soap.id, 12.5).lines[0]?.unitPricePaisa).toBe(3500);
  });
});

describe('totals', () => {
  it('multiplies fractional quantities correctly', () => {
    const cart = addLine(addLine(EMPTY_CART, rice, 1500), soap);
    // 1.5 kg × 75.00 = 112.50, plus one soap at 35.00.
    expect(computeTotals(cart)).toMatchObject({
      subtotalPaisa: 11_250 + 3500,
      totalPaisa: 14_750,
    });
  });

  it('rounds a fraction of a paisa half-up, like Postgres', () => {
    // 0.333 kg × 10.01 = 3.33333 → 333 paisa.
    const cart = addLine(EMPTY_CART, { ...rice, sellPricePaisa: 1001 }, 333);
    expect(computeTotals(cart).subtotalPaisa).toBe(333);
  });

  it('applies a taka discount', () => {
    const cart = setDiscount(cartWith(soap), { kind: 'amount', paisa: 500 });
    expect(computeTotals(cart)).toMatchObject({
      subtotalPaisa: 3500,
      discountPaisa: 500,
      totalPaisa: 3000,
    });
  });

  it('applies a percent discount, rounded to the paisa', () => {
    const cart = setDiscount(cartWith(soap), { kind: 'percent', percent: 10 });
    expect(computeTotals(cart).discountPaisa).toBe(350);
  });

  it('never discounts below zero', () => {
    const cart = setDiscount(cartWith(soap), { kind: 'amount', paisa: 99_999 });
    expect(computeTotals(cart)).toMatchObject({ discountPaisa: 3500, totalPaisa: 0 });
  });

  it('treats an untouched amount on a cash sale as exact payment', () => {
    expect(computeTotals(cartWith(soap))).toMatchObject({
      totalPaisa: 3500,
      paidPaisa: 3500,
      duePaisa: 0,
      changePaisa: 0,
    });
  });

  it('returns change when the customer pays more', () => {
    const cart = setTendered(cartWith(soap), 5000);
    expect(computeTotals(cart)).toMatchObject({
      totalPaisa: 3500,
      paidPaisa: 3500,
      changePaisa: 1500,
      duePaisa: 0,
    });
  });

  it('leaves the whole bill due when a credit sale received nothing', () => {
    const cart = setCredit(cartWith(soap), true);
    expect(computeTotals(cart)).toMatchObject({ paidPaisa: 0, duePaisa: 3500 });
  });

  it('counts an unpaid remainder as due on a credit sale', () => {
    const cart = setCredit(setTendered(cartWith(soap), 1000), true);
    expect(computeTotals(cart)).toMatchObject({ paidPaisa: 1000, duePaisa: 2500, changePaisa: 0 });
  });
});

describe('completing the sale', () => {
  it('refuses an empty bill', () => {
    expect(saleProblem(EMPTY_CART)).toBe('empty');
    expect(saleProblem(setDiscount(cartWith(soap), { kind: 'percent', percent: 100 }))).toBe(
      'empty',
    );
  });

  it('asks for a customer when money is left owing', () => {
    expect(saleProblem(setTendered(cartWith(soap), 1000))).toBe('credit_required');
    const credit = setCredit(setTendered(cartWith(soap), 1000), true);
    expect(saleProblem(credit)).toBe('customer_required');
    expect(saleProblem({ ...credit, customer })).toBeNull();
  });

  it('is fine without a customer when it is paid in full', () => {
    expect(saleProblem(setTendered(cartWith(delivery), 3000))).toBeNull();
  });

  it('warns about lines that will hit the stock guard, services excluded', () => {
    const cart = addLine(addLine(EMPTY_CART, rice, 25_000), delivery, 5000);
    expect(stockWarnings(cart).map((line) => line.productId)).toEqual([rice.id]);
  });
});

describe('RPC payload', () => {
  it('sends quantities as fixed 3-decimal strings and integer paisa', () => {
    const cart = addLine(addLine(EMPTY_CART, rice, 1500), soap);
    const totals = computeTotals(cart);
    const payload = toSalePayload(cart, totals, 'client-1');

    expect(payload).toMatchObject({
      client_id: 'client-1',
      subtotal_paisa: 14_750,
      discount_paisa: 0,
      discount_kind: 'amount',
      // Nothing typed means the customer paid the exact amount.
      paid_paisa: 14_750,
      payment_method: 'cash',
    });
    expect(payload.items).toEqual([
      { product_id: rice.id, qty: '1.500', unit_price_paisa: 7500 },
      { product_id: soap.id, qty: '1.000', unit_price_paisa: 3500 },
    ]);
  });

  it('only includes a customer and a note when they exist', () => {
    const cart = setCredit({ ...addLine(EMPTY_CART, soap), customer }, true);
    const payload = toSalePayload(cart, computeTotals(cart), 'client-2');
    expect(payload.customer_id).toBe(customer.id);
    expect(payload.note).toBeUndefined();
  });

  it('records a percent discount as a percent', () => {
    const cart = setDiscount(cartWith(soap), { kind: 'percent', percent: 20 });
    const payload = toSalePayload(cart, computeTotals(cart), 'client-3');
    expect(payload).toMatchObject({
      discount_kind: 'percent',
      discount_paisa: 700,
      paid_paisa: 2800,
    });
  });
});
