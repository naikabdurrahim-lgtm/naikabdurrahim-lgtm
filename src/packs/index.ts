import { clothingPack } from './clothing';
import { generalPack } from './general';
import { groceryPack } from './grocery';
import { pharmacyPack } from './pharmacy';
import { restaurantPack } from './restaurant';
import { servicePack } from './service';
import type { BusinessPack, PackId } from './types';

/**
 * The registry. Order is the order of the business-type picker: the three most
 * common shop types in Bangladesh come first, then the rest.
 */
export const PACKS: readonly BusinessPack[] = [
  groceryPack,
  pharmacyPack,
  clothingPack,
  restaurantPack,
  servicePack,
  generalPack,
];

const BY_ID = new Map<PackId, BusinessPack>(PACKS.map((pack) => [pack.id, pack]));

/** Falls back to the generic pack, so a bad value can never break a screen. */
export function getPack(id: PackId | string | null | undefined): BusinessPack {
  if (!id) return generalPack;
  return BY_ID.get(id as PackId) ?? generalPack;
}

export type { BusinessPack, ModuleKey, PackId, SampleProduct, UnitCode } from './types';
export { hasModule, isPackId, isUnitCode, UNIT_CODES } from './types';
