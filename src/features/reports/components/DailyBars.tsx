import { useState } from 'react';

import { MoneyText } from '@/components/common/MoneyText';
import { usePreferences } from '@/features/settings/preferences';
import { formatDhakaDate } from '@/lib/datetime';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { cn } from '@/lib/utils';

import { maxOf, type DayPoint } from '../types';

/**
 * A day-by-day bar chart with no chart library.
 *
 * Seven to thirty bars of one value need eleven lines of CSS, not 90 kB of
 * JavaScript; and a bar that is a `<button>` is tappable and keyboard-readable,
 * which is exactly what the shopkeeper needs on a phone in the sun.
 */
export function DailyBars({
  days,
  metric,
}: {
  days: readonly DayPoint[];
  metric: 'sales' | 'profit';
}) {
  const { t } = useAppTranslation('reports');
  const numerals = usePreferences((s) => s.numerals);
  const [selected, setSelected] = useState<number | null>(null);

  const values = days.map((day) => (metric === 'sales' ? day.salesPaisa : day.profitPaisa));
  const max = maxOf(values);
  const active = selected !== null ? days[selected] : undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {active ? formatDhakaDate(active.date, numerals) : t('chart.hint')}
        </p>
        {active ? (
          <p className="text-sm font-semibold">
            <MoneyText
              paisa={metric === 'sales' ? active.salesPaisa : active.profitPaisa}
              tone={metric === 'sales' ? 'in' : 'default'}
            />
          </p>
        ) : null}
      </div>

      <div className="flex h-32 items-end gap-1" role="group" aria-label={t('chart.label')}>
        {days.map((day, index) => {
          const value = values[index] ?? 0;
          // A zero day still gets a sliver, so the axis does not look broken.
          const height = max === 0 ? 2 : Math.max(2, Math.round((value / max) * 100));
          const isActive = selected === index;

          return (
            <button
              key={day.date}
              type="button"
              aria-pressed={isActive}
              aria-label={`${formatDhakaDate(day.date, numerals)}: ${
                metric === 'sales' ? day.salesPaisa / 100 : day.profitPaisa / 100
              }`}
              onClick={() => setSelected(isActive ? null : index)}
              className={cn(
                'group flex h-full flex-1 flex-col justify-end rounded-t-md transition-colors',
                isActive ? 'bg-primary/20' : 'hover:bg-secondary/60',
              )}
            >
              <span
                className={cn(
                  'w-full rounded-t-md',
                  metric === 'sales' ? 'bg-money-in/70' : 'bg-primary/70',
                  isActive && (metric === 'sales' ? 'bg-money-in' : 'bg-primary'),
                )}
                style={{ height: `${height}%` }}
              />
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {days.length > 0 ? formatDhakaDate(days[0]?.date ?? '', numerals) : ''}
        {days.length > 1
          ? ` — ${formatDhakaDate(days[days.length - 1]?.date ?? '', numerals)}`
          : ''}
      </p>
    </div>
  );
}
