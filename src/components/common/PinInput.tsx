import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { PIN_LENGTH } from '@/features/auth/lib/pin';

type PinInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** Called when all digits are filled. */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  /** `new-pin` allows the OS to suggest a password; `current-pin` does not. */
  purpose?: 'current-pin' | 'new-pin';
  label: string;
  invalid?: boolean;
  id?: string;
};

/**
 * Six large digit boxes.
 *
 * Why not one input with `maxlength=6`: on a cheap Android phone a single box
 * makes it impossible to see or correct one wrong digit, and the OS keyboard
 * behaves badly with masked input. Six boxes also give a 48px target each.
 */
export function PinInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = false,
  purpose = 'current-pin',
  label,
  invalid = false,
  id = 'pin',
}: PinInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.padEnd(PIN_LENGTH, ' ').slice(0, PIN_LENGTH).split('');

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const commit = (next: string) => {
    const clean = next.replace(/\D/g, '').slice(0, PIN_LENGTH);
    onChange(clean);
    if (clean.length === PIN_LENGTH) onComplete?.(clean);
  };

  const handleChange = (index: number, raw: string) => {
    const typed = raw.replace(/\D/g, '');
    if (!typed) return;

    // Fast typing or paste lands several digits in one box: distribute them.
    if (typed.length > 1) {
      const next = `${value.slice(0, index)}${typed}`.slice(0, PIN_LENGTH);
      commit(next);
      refs.current[Math.min(next.length, PIN_LENGTH - 1)]?.focus();
      return;
    }

    const chars = value.padEnd(PIN_LENGTH, ' ').split('');
    chars[index] = typed;
    const next = chars.join('').trimEnd().replace(/ /g, '');
    commit(next);
    if (index < PIN_LENGTH - 1) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      const chars = value.padEnd(PIN_LENGTH, ' ').split('');
      if (chars[index]?.trim()) {
        chars[index] = ' ';
      } else if (index > 0) {
        chars[index - 1] = ' ';
        refs.current[index - 1]?.focus();
      }
      onChange(chars.join('').trimEnd().replace(/ /g, ''));
      return;
    }
    if (event.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus();
    if (event.key === 'ArrowRight' && index < PIN_LENGTH - 1) refs.current[index + 1]?.focus();
  };

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium">{label}</span>
      <div
        className="flex justify-between gap-2"
        role="group"
        aria-label={label}
        onPaste={(event) => {
          event.preventDefault();
          commit(event.clipboardData.getData('text'));
        }}
      >
        {digits.map((digit, index) => (
          <input
            key={index}
            id={index === 0 ? id : undefined}
            ref={(node) => {
              refs.current[index] = node;
            }}
            value={digit.trim()}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            disabled={disabled}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={purpose === 'new-pin' && index === 0 ? 'new-password' : 'off'}
            type="password"
            maxLength={PIN_LENGTH}
            aria-label={`${label} ${index + 1}`}
            aria-invalid={invalid}
            className={cn(
              'h-14 w-full min-w-0 rounded-xl border bg-secondary/40 text-center text-2xl font-semibold tracking-widest',
              'focus-visible:border-primary disabled:opacity-50',
              invalid ? 'border-destructive text-destructive' : 'border-input',
            )}
          />
        ))}
      </div>
    </div>
  );
}
