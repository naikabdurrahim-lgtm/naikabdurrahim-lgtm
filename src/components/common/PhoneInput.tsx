import { useId } from 'react';
import { cn } from '@/lib/utils';

type PhoneInputProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
};

/**
 * Bangladeshi mobile entry. The +880 prefix is fixed and visible, so the user
 * types the familiar 11-digit local number (01712345678) and nothing else.
 * Accepts Bangla digits, spaces and dashes, because phones paste all three.
 */
export function PhoneInput({
  value,
  onChange,
  label,
  hint,
  error,
  disabled = false,
  autoFocus = false,
}: PhoneInputProps) {
  const id = useId();

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div
        className={cn(
          'flex min-h-cta items-center rounded-xl border bg-secondary/40 ps-3',
          error ? 'border-destructive' : 'border-input',
          'focus-within:border-primary',
        )}
      >
        <span className="select-none pe-2 text-sm font-semibold text-muted-foreground" dir="ltr">
          +880
        </span>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          autoFocus={autoFocus}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="1712345678"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className="min-w-0 flex-1 bg-transparent pe-3 text-lg tracking-wide outline-none placeholder:text-muted-foreground/60"
          dir="ltr"
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-sm text-money-out">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
