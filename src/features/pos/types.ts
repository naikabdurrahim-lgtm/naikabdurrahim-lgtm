import type { UnitCode } from '@/packs';

/**
 * The POS view models.
 *
 * Quantities are thousandths (`qtyMilli`) and money is integer paisa, exactly
 * like the database. Nothing in this feature ever holds a float taka value.
 */

export type PaymentMethod = 'cash' | 'bkash' | 'nagad' | 'rocket' | 'card' | 'bank' | 'other';

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'cash',
  'bkash',
  'nagad',
  'rocket',
  'card',
  'bank',
  'other',
];

export type CartLine = {
  productId: string;
  name: string;
  unitCode: UnitCode;
  isService: boolean;
  /** Price at the moment it was added; owner/manager may edit it. */
  unitPricePaisa: number;
  qtyMilli: number;
  /** Stock when it was added — used for the "only 3 left" warning only. */
  stockMilli: number;
};

export type CartCustomer = { id: string; name: string; phone: string | null };

export type DiscountInput =
  { kind: 'amount'; paisa: number } | { kind: 'percent'; percent: number };

export type Cart = {
  lines: CartLine[];
  customer: CartCustomer | null;
  discount: DiscountInput;
  method: PaymentMethod;
  /** What the customer handed over. May exceed the total (change is returned). */
  tenderedPaisa: number;
  credit: boolean;
  note: string;
};

export type CartTotals = {
  subtotalPaisa: number;
  discountPaisa: number;
  totalPaisa: number;
  paidPaisa: number;
  duePaisa: number;
  changePaisa: number;
  itemCount: number;
};

/** What the sale RPC returns (create_sale / void_sale). */
export type SaleResult = {
  saleId: string;
  invoiceNo: string | null;
  subtotalPaisa: number;
  discountPaisa: number;
  totalPaisa: number;
  paidPaisa: number;
  duePaisa: number;
  duplicate: boolean;
};

export type ReceiptItem = {
  id: string;
  name: string;
  unitCode: UnitCode;
  qtyMilli: number;
  unitPricePaisa: number;
  discountPaisa: number;
  lineTotalPaisa: number;
};

export type Receipt = {
  saleId: string;
  invoiceNo: string | null;
  createdAt: string;
  businessDate: string;
  status: 'completed' | 'voided';
  customerName: string | null;
  subtotalPaisa: number;
  discountPaisa: number;
  discountKind: 'amount' | 'percent';
  totalPaisa: number;
  paidPaisa: number;
  duePaisa: number;
  note: string | null;
  items: ReceiptItem[];
  footer: string | null;
};

export type PosErrorCode =
  | 'insufficient_stock'
  | 'below_cost_not_allowed'
  | 'discount_not_allowed'
  | 'due_requires_customer'
  | 'unknown_product'
  | 'invalid_paid_amount'
  | 'empty_sale'
  | 'not_member'
  | 'forbidden'
  | 'not_configured'
  | 'network'
  | 'unknown';

/**
 * A POS failure the screen can translate. `detail` is for the console only —
 * a shopkeeper must never see raw Postgres text (PROJECT_RULES 3.1 #13).
 */
export class PosError extends Error {
  readonly code: PosErrorCode;
  readonly detail: string | undefined;

  constructor(code: PosErrorCode, detail?: string) {
    super(detail ?? code);
    this.name = 'PosError';
    this.code = code;
    this.detail = detail;
  }
}

export type PosSettings = {
  receiptFooter: string;
  receiptHeader: string | null;
  allowCashierDiscount: boolean;
  allowNegativeStock: boolean;
};
