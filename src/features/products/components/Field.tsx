import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type FieldProps = {
  id: string;
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: ReactNode;
  className?: string;
};

/**
 * Label + control + hint/error, wired with the right ids so a screen reader
 * announces the message with the field (PROJECT_RULES 3.1 #15).
 */
export function Field({ id, label, hint, error, children, className }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-money-out">
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
