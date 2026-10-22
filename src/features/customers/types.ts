/**
 * Minimal customer view model for the POS.
 *
 * Phase 6 owns the customer screens, balances and the due ledger; this file only
 * carries what a credit sale needs — who the customer is and how to reach them.
 */

export type CustomerSummary = {
  id: string;
  name: string;
  phone: string | null;
};

export type NewCustomer = {
  name: string;
  phone: string | null;
};

export type CustomerApiErrorCode =
  'duplicate_phone' | 'invalid_phone' | 'not_configured' | 'forbidden' | 'network' | 'unknown';

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
