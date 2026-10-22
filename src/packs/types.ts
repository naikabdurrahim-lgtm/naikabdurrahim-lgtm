/**
 * Business Pack contract (PROJECT_RULES 5.2).
 *
 * A pack is configuration, not code paths: adding a business type means adding
 * one object here, and nothing in `features/` changes. Behaviour that a pack
 * needs (batches, variants, barcode) is switched on through `modules` and read
 * by the feature that owns it.
 */

export type PackId = 'grocery' | 'pharmacy' | 'clothing' | 'restaurant' | 'service' | 'general';

export type ModuleKey =
  | 'batches'
  | 'expiryAlerts'
  | 'variants'
  | 'weightUnits'
  | 'barcode'
  | 'wholesalePrice'
  | 'tables' // later
  | 'appointments'; // later

/**
 * Mirrors the `units` table exactly (`supabase/migrations/0003_catalog.sql`).
 * Order matters: it is the order the unit picker shows — count units first,
 * then weight and volume, which are rarer in a small shop.
 */
export const UNIT_CODES = [
  'piece',
  'dozen',
  'packet',
  'strip',
  'box',
  'bottle',
  'kg',
  'gram',
  'litre',
  'ml',
] as const;

export type UnitCode = (typeof UNIT_CODES)[number];

export function isUnitCode(value: unknown): value is UnitCode {
  return typeof value === 'string' && (UNIT_CODES as readonly string[]).includes(value);
}

export type SampleProduct = {
  nameBn: string;
  nameEn: string;
  /** Suggested category, matching one of the pack's defaultCategories. */
  categoryBn: string;
  unit: UnitCode;
  /** Paisa. Kept as integers for the same reason as every other price. */
  buyPaisa: number;
  sellPaisa: number;
  /** Opening stock, in thousandths (like numeric(14,3)). */
  stockMilli: number;
};

export type PackCategory = {
  nameBn: string;
  nameEn: string;
  icon: string;
};

export type BusinessPack = {
  id: PackId;
  labelBn: string;
  labelEn: string;
  /** Shown on the business-type picker under the name. */
  hintBn: string;
  hintEn: string;
  /** Lucide icon name; the picker maps it to a component. */
  icon: string;
  /** Colour used for the picker card and the pack badge. */
  tone: 'emerald' | 'sky' | 'rose' | 'amber' | 'violet' | 'slate';
  /** Overrides for words that differ from the generic core vocabulary. */
  terminology: {
    product: string;
    products: string;
    /** Empty string means "use the default wording". */
    sale: string;
  };
  defaultCategories: PackCategory[];
  defaultUnits: UnitCode[];
  modules: ModuleKey[];
  sampleProducts: SampleProduct[];
};

export function hasModule(pack: BusinessPack, module: ModuleKey): boolean {
  return pack.modules.includes(module);
}

/** Narrows an untrusted string (e.g. from the database) to a pack id. */
export function isPackId(value: unknown): value is PackId {
  return (
    value === 'grocery' ||
    value === 'pharmacy' ||
    value === 'clothing' ||
    value === 'restaurant' ||
    value === 'service' ||
    value === 'general'
  );
}
