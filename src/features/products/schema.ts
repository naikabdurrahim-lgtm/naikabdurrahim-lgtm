import { z } from 'zod';

import type { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { parseTakaToPaisa } from '@/lib/money';
import { parseQuantityToMilli } from '@/lib/quantity';
import { UNIT_CODES, type UnitCode } from '@/packs';

import type { Product, ProductInput } from './types';

/**
 * Validation lives here, in "form space": the user types taka and kilos as
 * strings, and only `toProductInput` converts to paisa and thousandths.
 *
 * The schema is built with a translate function rather than module-level
 * messages, because every message is Bangla (or English) and must come from the
 * locale files (PROJECT_RULES 3.1 #14).
 */

/**
 * Exactly the `t` the screens get from `useAppTranslation`, so a fake translator
 * in a test is the only thing that needs adjusting, never the call sites.
 */
export type Translate = ReturnType<typeof useAppTranslation>['t'];

const NAME_MAX = 160;
const CATEGORY_MAX = 60;
const BARCODE_MAX = 64;

/** Letters, digits, dash and underscore — what every scanner and supplier uses. */
const BARCODE_PATTERN = /^[A-Za-z0-9_-]*$/;

const isPrice = (value: string) => parseTakaToPaisa(value) !== null;
const isQuantity = (value: string) => value.trim() === '' || parseQuantityToMilli(value) !== null;

export function buildProductFormSchema(t: Translate) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t('form.required'))
      .max(NAME_MAX, t('form.tooLong', { max: NAME_MAX })),
    nameEn: z
      .string()
      .trim()
      .max(NAME_MAX, t('form.tooLong', { max: NAME_MAX })),
    categoryId: z.string().uuid().nullable(),
    unitCode: z.enum(UNIT_CODES),
    sellPrice: z.string().trim().min(1, t('form.required')).refine(isPrice, t('form.priceInvalid')),
    buyPrice: z
      .string()
      .trim()
      .refine((value) => value === '' || isPrice(value), t('form.priceInvalid')),
    barcode: z
      .string()
      .trim()
      .max(BARCODE_MAX, t('form.tooLong', { max: BARCODE_MAX }))
      .regex(BARCODE_PATTERN, t('form.barcodeInvalid')),
    stockAlert: z.string().trim().refine(isQuantity, t('form.quantityInvalid')),
    openingStock: z.string().trim().refine(isQuantity, t('form.quantityInvalid')),
    isService: z.boolean(),
  });
}

export type ProductFormValues = z.infer<ReturnType<typeof buildProductFormSchema>>;

export function emptyProductForm(
  unitCode: UnitCode = 'piece',
  isService = false,
): ProductFormValues {
  return {
    name: '',
    nameEn: '',
    categoryId: null,
    unitCode,
    sellPrice: '',
    buyPrice: '',
    barcode: '',
    stockAlert: '',
    openingStock: '',
    isService,
  };
}

/** Paisa → the "75.50" text the form shows. Empty when there is no price yet. */
export function paisaToInput(paisa: number | null | undefined): string {
  if (paisa === null || paisa === undefined) return '';
  const taka = Math.trunc(paisa / 100);
  const fraction = Math.abs(paisa % 100);
  return fraction === 0 ? String(taka) : `${taka}.${String(fraction).padStart(2, '0')}`;
}

/** Thousandths → "12.5" (trailing zeros dropped). */
export function milliToInput(milli: number | null | undefined): string {
  if (!milli) return '';
  const whole = Math.trunc(milli / 1000);
  const fraction = String(Math.abs(milli % 1000))
    .padStart(3, '0')
    .replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : String(whole);
}

export function formValuesFromProduct(product: Product, isService: boolean): ProductFormValues {
  return {
    name: product.name,
    nameEn: product.nameEn ?? '',
    categoryId: product.categoryId,
    unitCode: product.unitCode,
    // Cost is null for a cashier; the form is owner/manager-only, so in practice
    // this is a number.
    sellPrice: paisaToInput(product.sellPricePaisa),
    buyPrice: paisaToInput(product.buyPricePaisa),
    barcode: product.barcode ?? '',
    stockAlert: milliToInput(product.stockAlertMilli),
    openingStock: milliToInput(isService ? 0 : product.stockMilli),
    isService,
  };
}

export type ProductDraft = {
  input: ProductInput;
  /** Opening stock is not a product column: it becomes a stock movement. */
  openingStockMilli: number;
};

/**
 * Converts validated form values into the numbers the API and database expect.
 * Throws only if called on invalid values — the resolver runs first.
 */
export function toProductInput(
  values: ProductFormValues,
  context: { tenantId: string; isEdit: boolean },
): ProductDraft {
  const sellPricePaisa = parseTakaToPaisa(values.sellPrice);
  const buyPricePaisa = values.buyPrice.trim() === '' ? 0 : parseTakaToPaisa(values.buyPrice);
  const stockAlertMilli = parseQuantityToMilli(values.stockAlert) ?? 0;
  const openingStockMilli = context.isEdit ? 0 : (parseQuantityToMilli(values.openingStock) ?? 0);

  if (sellPricePaisa === null || buyPricePaisa === null) {
    throw new RangeError('toProductInput called with an invalid price');
  }

  const barcode = values.barcode.trim();

  return {
    input: {
      tenantId: context.tenantId,
      name: values.name.trim(),
      nameEn: values.nameEn.trim() || null,
      categoryId: values.categoryId,
      unitCode: values.unitCode,
      barcode: barcode === '' ? null : barcode,
      sku: null,
      sellPricePaisa,
      buyPricePaisa,
      wholesalePricePaisa: null,
      stockAlertMilli,
      isService: values.isService,
      isActive: true,
    },
    openingStockMilli: values.isService ? 0 : openingStockMilli,
  };
}

export function buildCategorySchema(t: Translate) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t('categories.required'))
      .max(CATEGORY_MAX, t('categories.tooLong', { max: CATEGORY_MAX })),
  });
}

export type CategoryFormValues = z.infer<ReturnType<typeof buildCategorySchema>>;
