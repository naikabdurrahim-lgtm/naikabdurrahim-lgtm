/**
 * Stock, as the shop counts it.
 *
 * Quantities travel as integers in thousandths (`numeric(14,3)` in Postgres) and
 * are only converted for display, never for arithmetic.
 */

export type StockFilter = 'all' | 'low' | 'out';

export type StockItem = {
  id: string;
  name: string;
  unitCode: string;
  stockMilli: number;
  alertMilli: number;
  sellPricePaisa: number;
  /** `null` for a cashier: cost is not theirs to see (0012). */
  buyPricePaisa: number | null;
  /** `null` for a cashier, for the same reason. */
  stockValuePaisa: number | null;
  isService: boolean;
  lastMovementAt: string | null;
};

export type StockOverview = {
  productCount: number;
  lowCount: number;
  outCount: number;
  /** `null` for a cashier. */
  valuePaisa: number | null;
};

export type MovementType =
  'opening' | 'purchase' | 'sale' | 'sale_return' | 'adjustment' | 'damage';

export type StockMovement = {
  id: string;
  type: MovementType;
  /** Signed: positive is stock in, negative is stock out. */
  qtyMilli: number;
  unitCostPaisa: number;
  reason: string | null;
  occurredAt: string;
  referenceType: string | null;
  createdByName: string;
  runningMilli: number;
};

/** What the movement sheet can write. A sale is written by the POS, not here. */
export type ManualMovementType = 'purchase' | 'damage' | 'adjustment' | 'sale_return';

export type NewMovement = {
  productId: string;
  type: ManualMovementType;
  /** Signed quantity in thousandths. The sheet builds it from direction + amount. */
  qtyMilli: number;
  unitCostPaisa: number | null;
  reason: string;
  clientId: string;
};

export type StockApiErrorCode =
  | 'reason_required'
  | 'invalid_quantity'
  | 'stock_movement_on_service_product'
  | 'forbidden'
  | 'not_found'
  | 'not_configured'
  | 'network'
  | 'unknown';

export class StockApiError extends Error {
  readonly code: StockApiErrorCode;
  readonly detail: string | undefined;

  constructor(code: StockApiErrorCode, detail?: string) {
    super(detail ?? code);
    this.name = 'StockApiError';
    this.code = code;
    this.detail = detail;
  }
}

/** Is this product at or below the level the shop asked to be warned about? */
export function isLowStock(item: { stockMilli: number; alertMilli: number }): boolean {
  return item.alertMilli > 0 && item.stockMilli > 0 && item.stockMilli <= item.alertMilli;
}

export function isOutOfStock(item: { stockMilli: number }): boolean {
  return item.stockMilli <= 0;
}
