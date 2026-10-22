import { formatPaisa } from '@/lib/money';
import { usePreferences } from '@/features/settings/preferences';
import { cn } from '@/lib/utils';

type MoneyTextProps = {
  paisa: number;
  className?: string;
  withSymbol?: boolean;
  showDecimals?: boolean;
  tone?: 'default' | 'in' | 'out';
};

/**
 * The only component allowed to render money. Converts integer paisa to the
 * user's chosen numeral style (PROJECT_RULES 3.1 #7, 5.3).
 */
export function MoneyText({
  paisa,
  className,
  withSymbol = true,
  showDecimals = true,
  tone = 'default',
}: MoneyTextProps) {
  const numerals = usePreferences((s) => s.numerals);

  return (
    <span
      className={cn(
        'bn-digits tabular-nums',
        tone === 'in' && 'text-money-in',
        tone === 'out' && 'text-money-out',
        className,
      )}
      // The visible text is formatted; screen readers get the exact amount too.
      aria-label={formatPaisa(paisa, { numerals: 'en' })}
    >
      {formatPaisa(paisa, { numerals, withSymbol, showDecimals })}
    </span>
  );
}
