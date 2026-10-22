/**
 * Shared input styling and aria wiring for the catalogue forms.
 *
 * Kept out of `Field.tsx` because a module that exports both a component and
 * constants breaks React Fast Refresh (`react-refresh/only-export-components`).
 */

/** One input style for the whole catalogue screens: 56px tall, 16px text. */
export const inputClass =
  'min-h-cta w-full rounded-xl border border-input bg-secondary/40 px-3 text-lg outline-none transition-colors focus-visible:border-primary disabled:opacity-60 aria-[invalid=true]:border-money-out';

/** Points the input at its error or hint paragraph, whichever is showing. */
export function describedBy(id: string, error?: string, hint?: string): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}
