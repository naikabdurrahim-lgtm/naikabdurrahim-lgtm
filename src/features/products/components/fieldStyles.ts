/**
 * Aria wiring shared by the catalogue form inputs.
 *
 * Kept out of `Field.tsx` because a module that exports both a component and
 * constants breaks React Fast Refresh (`react-refresh/only-export-components`).
 * The input style itself lives in `components/ui/input.ts`, because the POS
 * needs the same control.
 */

export { inputClass } from '@/components/ui/input';

/** Points the input at its error or hint paragraph, whichever is showing. */
export function describedBy(id: string, error?: string, hint?: string): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}
