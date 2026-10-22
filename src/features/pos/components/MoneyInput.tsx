import { useEffect, useState } from 'react';

import { inputClass } from '@/components/ui/input';
import { formatPaisa, parseTakaToPaisa } from '@/lib/money';
import { cn } from '@/lib/utils';

type MoneyInputProps = {
  id: string;
  label: string;
  valuePaisa: number;
  onChange: (paisa: number) => void;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
  /** Renders the amount in Bangla numerals (display only, editing is ASCII). */
  numerals?: 'bn' | 'en';
  className?: string;
};

/**
 * Taka entry for a shopkeeper: the field shows what they type, and the value is
 * converted to integer paisa once, on every keystroke.
 *
 * A partially typed "12." is kept as text and reported as 1200 paisa, so the
 * caret never jumps and nothing is lost mid-typing.
 */
export function MoneyInput({
  id,
  label,
  valuePaisa,
  onChange,
  placeholder,
  hint,
  disabled = false,
  numerals = 'en',
  className,
}: MoneyInputProps) {
  const [text, setText] = useState(() => toText(valuePaisa));

  // Keep the field in step when the amount changes from outside (quick chips,
  // "exact amount", a cleared bill) without fighting the user's typing.
  useEffect(() => {
    const current = parseTakaToPaisa(text);
    if (current !== valuePaisa) setText(toText(valuePaisa));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuePaisa]);

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-xl border border-input bg-secondary/40 ps-3 focus-within:border-primary">
        <span aria-hidden="true" className="text-lg text-muted-foreground">
          ৳
        </span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={cn(inputClass, 'border-0 bg-transparent ps-0')}
          onChange={(event) => {
            const next = event.target.value;
            setText(next);
            // Empty means zero here: "no discount" and "0 taka discount" agree.
            const paisa = next.trim() === '' ? 0 : parseTakaToPaisa(next);
            onChange(paisa ?? 0);
          }}
          onBlur={() => setText(toText(valuePaisa))}
        />
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      <span className="sr-only">{formatPaisa(valuePaisa, { numerals })}</span>
    </div>
  );
}

/** 0 → "", 1250 → "12.50", 1200 → "12" — the way people type money. */
function toText(paisa: number): string {
  if (!paisa) return '';
  const taka = Math.trunc(paisa / 100);
  const fraction = Math.abs(paisa % 100);
  return fraction === 0 ? String(taka) : `${taka}.${String(fraction).padStart(2, '0')}`;
}
