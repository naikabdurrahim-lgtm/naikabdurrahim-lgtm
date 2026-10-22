import type { PackId } from '@/packs';

/**
 * Some business types sell things that are not "stock" in the shelf sense:
 * a restaurant menu item and a salon service are both sold without a stock
 * count in v1 (PROJECT_RULES 8 keeps table/appointment flow out of scope).
 *
 * Keeping the rule in one function means Phase 8 can change it in one place.
 */
const SERVICE_LIKE_PACKS: readonly PackId[] = ['restaurant', 'service'];

export function packHasStockedProducts(packId: PackId): boolean {
  return !SERVICE_LIKE_PACKS.includes(packId);
}

/** Human-readable count, used in the onboarding summary. */
export function describeSampleSelection(count: number, total: number): string {
  if (count === 0) return '0';
  if (count === total) return `${total}/${total}`;
  return `${count}/${total}`;
}
