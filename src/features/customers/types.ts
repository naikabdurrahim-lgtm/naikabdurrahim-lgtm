/**
 * Customers and their dues.
 *
 * A balance is never stored anywhere: it is `sum(debit) - sum(credit)` over the
 * append-only ledger (migration 0004), computed by the functions in 0014.
 */

export type CustomerSummary = {
  id: string;
  name: string;
  phone: string | null;
  /** Positive means the customer owes the shop. */
  duePaisa: number;
};

export type CustomerWithDue = CustomerSummary & {
  creditLimitPaisa: number | null;
  lastActivityAt: string | null;
  createdAt: string;
};

export type CustomerDetail = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  note: string | null;
  duePaisa: number;
  creditLimitPaisa: number | null;
  isActive: boolean;
  isDeleted: boolean;
  lastActivityAt: string | null;
  createdAt: string;
};

export type CustomerInput = {
  name: string;
  phone: string | null;
  address: string | null;
  note: string | null;
  creditLimitPaisa: number | null;
};

/** The POS only needs a name and a number to start a khata. */
export type NewCustomer = {
  name: string;
  phone: string | null;
  address?: string | null;
  note?: string | null;
  creditLimitPaisa?: number | null;
};

export type LedgerEntryType = 'debit' | 'credit';

export type LedgerEntry = {
  id: string;
  entryType: LedgerEntryType;
  /** Always positive; `entryType` says which way it moves the balance. */
  amountPaisa: number;
  balanceAfterPaisa: number;
  occurredAt: string;
  note: string | null;
  saleId: string | null;
  paymentId: string | null;
  invoiceNo: string | null;
};

export type DueSummary = {
  totalDuePaisa: number;
  debtorCount: number;
  customerCount: number;
  oldestDueAt: string | null;
};

export type CustomerApiErrorCode =
  | 'duplicate_phone'
  | 'invalid_phone'
  | 'not_found'
  | 'not_configured'
  | 'forbidden'
  | 'network'
  | 'unknown';

export class CustomerApiError extends Error {
  readonly code: CustomerApiErrorCode;
  readonly detail: string | undefined;

  constructor(code: CustomerApiErrorCode, detail?: string) {
    super(detail ?? code);
    this.name = 'CustomerApiError';
    this.code = code;
    this.detail = detail;
  }
}

export type LedgerApiErrorCode =
  | 'overpayment'
  | 'nothing_due'
  | 'missing_customer'
  | 'not_configured'
  | 'forbidden'
  | 'network'
  | 'unknown';

export class LedgerApiError extends Error {
  readonly code: LedgerApiErrorCode;
  readonly detail: string | undefined;

  constructor(code: LedgerApiErrorCode, detail?: string) {
    super(detail ?? code);
    this.name = 'LedgerApiError';
    this.code = code;
    this.detail = detail;
  }
}

/** Is this customer over the credit limit their shop set for them? */
export function isOverCreditLimit(customer: {
  duePaisa: number;
  creditLimitPaisa: number | null;
}): boolean {
  return customer.creditLimitPaisa !== null && customer.duePaisa > customer.creditLimitPaisa;
}

/** Has this customer ever had a due, or is the khata still blank? */
export function isDebtor(customer: { duePaisa: number }): boolean {
  return customer.duePaisa > 0;
}
