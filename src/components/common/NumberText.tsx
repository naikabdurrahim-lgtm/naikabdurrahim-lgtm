import { groupBangladeshi, toBanglaDigits } from '@/lib/money';
import { usePreferences } from '@/features/settings/preferences';
import { cn } from '@/lib/utils';

type NumberTextProps = {
  value: number;
  className?: string;
  /** Keeps at most this many decimals; the rest are dropped, not rounded up. */
  maxDecimals?: number;
};

/**
 * Counts, quantities and other plain numbers, in the user's numeral style.
 * Money uses MoneyText; this is for everything that is not money (badges, "12
 * items", stock counts).
 */
export function NumberText({ value, className, maxDecimals = 3 }: NumberTextProps) {
  const numerals = usePreferences((s) => s.numerals);

  const safe = Number.isFinite(value) ? value : 0;
  const fixed = safe.toFixed(maxDecimals).replace(/\.?0+$/, '');
  const [whole = '0', fraction] = fixed.split('.');

  const grouped = fraction ? `${groupBangladeshi(whole)}.${fraction}` : groupBangladeshi(whole);
  const text = numerals === 'bn' ? toBanglaDigits(grouped) : grouped;

  return (
    <span className={cn('bn-digits tabular-nums', className)} aria-label={String(value)}>
      {text}
    </span>
  );
}
