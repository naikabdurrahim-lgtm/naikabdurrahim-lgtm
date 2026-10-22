import { useEffect, useState } from 'react';

/**
 * Waits until the user stops typing before returning the new value.
 *
 * Why not `useDeferredValue`: that only deprioritises rendering, it still fires
 * a query per keystroke. A search box on a Bangladeshi mobile connection needs
 * the request to wait, not just the paint.
 */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
