import type { UnitCode } from '@/packs';

/**
 * View models for the catalogue. They are deliberately flat and camelCase: the
 * rows that come back from `search_products()` are snake_case with nullable
 * numbers, and `api.ts` is the only place that translates.
 */

export type Product = {
  id: string;
  name: string;
  nameEn: string | null;
  categoryId: string | null;
  categoryName: string | null;
  unitCode: UnitCode;
  barcode: string | null;
  sku: string | null;
  sellPricePaisa: number;
  /** Null for a cashier: cost is owner/manager only (see migration 0012). */
  buyPricePaisa: number | null;
  wholesalePricePaisa: number | null;
  /** Thousandths, like `numeric(14,3)`. */
  stockMilli: number;
  stockAlertMilli: number;
  isService: boolean;
  isActive: boolean;
  updatedAt: string;
};

export type Category = {
  id: string;
  name: string;
  nameEn: string | null;
  icon: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
};

/** What the form hands to `api.ts`: everything already in paisa and thousandths. */
export type ProductInput = {
  tenantId: string;
  name: string;
  nameEn: string | null;
  categoryId: string | null;
  unitCode: UnitCode;
  barcode: string | null;
  sku: string | null;
  sellPricePaisa: number;
  buyPricePaisa: number;
  wholesalePricePaisa: number | null;
  stockAlertMilli: number;
  isService: boolean;
  isActive: boolean;
};

export type ProductListFilters = {
  query: string;
  categoryId: string | null;
  /** "Running out" chip: only products at or below their alert level. */
  lowStock: boolean;
};

export type ProductApiErrorCode =
  | 'not_configured'
  | 'duplicate_barcode'
  | 'duplicate_sku'
  | 'duplicate_category'
  | 'forbidden'
  | 'network'
  | 'not_found'
  | 'unknown';

export class ProductApiError extends Error {
  readonly code: ProductApiErrorCode;
  readonly detail: string | undefined;

  constructor(code: ProductApiErrorCode, detail?: string) {
    super(detail ?? code);
    this.name = 'ProductApiError';
    this.code = code;
    this.detail = detail;
  }
}

/** A product is "low" only when the owner asked to be warned and it is at or below. */
export function isLowStock(product: Pick<Product, 'isService' | 'stockMilli' | 'stockAlertMilli'>) {
  return (
    !product.isService &&
    product.stockAlertMilli > 0 &&
    product.stockMilli <= product.stockAlertMilli
  );
}

export function isOutOfStock(product: Pick<Product, 'isService' | 'stockMilli'>) {
  return !product.isService && product.stockMilli <= 0;
}
