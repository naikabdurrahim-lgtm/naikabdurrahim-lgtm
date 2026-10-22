import { NumberText } from '@/components/common/NumberText';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { cn } from '@/lib/utils';

/**
 * A quantity with its unit: "৪.৫ কেজি". The number is in thousandths (the same
 * scale as `numeric(14,3)`) and the unit label comes from the shared vocabulary
 * in `common.json`.
 */
export function QuantityText({
  milli,
  unitCode,
  className,
  showUnit = true,
}: {
  milli: number;
  unitCode: string;
  className?: string;
  showUnit?: boolean;
}) {
  const { t } = useAppTranslation('common');
  const unit = t(`units.${unitCode}`);

  return (
    <span className={cn('inline-flex items-baseline gap-1', className)}>
      <NumberText value={milli / 1000} />
      {showUnit ? <span className="text-xs text-muted-foreground">{unit}</span> : null}
    </span>
  );
}
