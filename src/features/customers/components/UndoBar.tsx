import { useEffect, useState } from 'react';
import { Loader2, Undo2 } from 'lucide-react';

import { MoneyText } from '@/components/common/MoneyText';
import { toBanglaDigits } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { usePreferences } from '@/features/settings/preferences';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';

/** How long a collection can be taken back (PROJECT_RULES 3.1 #10). */
export const UNDO_SECONDS = 10;

type UndoBarProps = {
  amountPaisa: number;
  onUndo: () => void;
  onExpire?: () => void;
  pending?: boolean;
};

/**
 * The ten seconds after a collection in which a mis-tap can be undone.
 *
 * Undo writes a reversing entry through `void_payment()`; the payment row stays
 * and the khata shows both lines. It sits in the page, not in a floating toast,
 * so it never covers the big primary button on a small phone.
 */
export function UndoBar({ amountPaisa, onUndo, onExpire, pending = false }: UndoBarProps) {
  const { t } = useAppTranslation('customers');
  const { t: tc } = useAppTranslation('common');
  const numerals = usePreferences((s) => s.numerals);
  const [left, setLeft] = useState(UNDO_SECONDS);

  useEffect(() => {
    if (left <= 0) {
      onExpire?.();
      return;
    }
    const timer = window.setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
    // `onExpire` is intentionally not a dependency: it is called once, on zero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-xl border border-money-in/40 bg-money-in/10 p-3"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-money-in">
          <MoneyText paisa={amountPaisa} className="font-semibold" /> {t('undo.collected')}
        </p>
        <p className="bn-digits text-xs text-muted-foreground">
          {t('undo.window', {
            seconds: numerals === 'bn' ? toBanglaDigits(String(left)) : left,
          })}
        </p>
      </div>
      <Button variant="secondary" disabled={pending} onClick={onUndo}>
        {pending ? (
          <Loader2 aria-hidden="true" className="animate-spin" />
        ) : (
          <Undo2 aria-hidden="true" />
        )}
        {pending ? t('undo.working') : tc('actions.undo')}
      </Button>
    </div>
  );
}
