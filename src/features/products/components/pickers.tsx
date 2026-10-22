import { Check, Plus } from 'lucide-react';
import { useState } from 'react';

import { NumberText } from '@/components/common/NumberText';
import { Button } from '@/components/ui/button';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { cn } from '@/lib/utils';
import { UNIT_CODES, type UnitCode } from '@/packs';

import type { Category } from '../types';
import { Field } from './Field';
import { inputClass } from './fieldStyles';

/**
 * Chip rows for the two things a shopkeeper picks constantly: category and unit.
 * Chips (not dropdowns) because they are one tap, visible without scrolling and
 * large enough for a thumb.
 */

type CategoryChipsProps = {
  categories: Category[];
  value: string | null;
  onChange: (value: string | null) => void;
  /** Shows a "+ নতুন ক্যাটাগরি" chip that opens an inline name field. */
  allowCreate?: boolean;
  onCreate?: ((name: string) => Promise<void> | void) | undefined;
  creating?: boolean;
};

export function CategoryChips({
  categories,
  value,
  onChange,
  allowCreate = false,
  onCreate,
  creating = false,
}: CategoryChipsProps) {
  const { t } = useAppTranslation('products');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const submitNew = async () => {
    const trimmed = name.trim();
    if (!trimmed || !onCreate) return;
    await onCreate(trimmed);
    setName('');
    setAdding(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('form.category')}>
        <Chip selected={value === null} onClick={() => onChange(null)}>
          {t('form.noCategory')}
        </Chip>
        {categories.map((category) => (
          <Chip
            key={category.id}
            selected={value === category.id}
            onClick={() => onChange(category.id)}
          >
            {category.name}
          </Chip>
        ))}

        {allowCreate ? (
          <button
            type="button"
            onClick={() => setAdding((open) => !open)}
            className="inline-flex min-h-touch items-center gap-1 rounded-full border border-dashed border-input px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <Plus aria-hidden="true" className="size-4" />
            {t('form.newCategory')}
          </button>
        ) : null}
      </div>

      {adding ? (
        <div className="flex items-end gap-2">
          <Field id="new-category" label={t('categories.nameLabel')} className="flex-1">
            <input
              id="new-category"
              value={name}
              autoFocus
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void submitNew();
                }
              }}
              placeholder={t('categories.namePlaceholder')}
              className={inputClass}
            />
          </Field>
          <Button
            type="button"
            onClick={() => void submitNew()}
            disabled={!name.trim() || creating}
            className="mb-0"
          >
            {t('categories.save')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-touch items-center gap-1 rounded-full border px-3 text-sm font-medium transition',
        selected
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-secondary/40 text-muted-foreground hover:text-foreground',
      )}
    >
      {selected ? <Check aria-hidden="true" className="size-4" /> : null}
      {children}
    </button>
  );
}

type UnitPickerProps = {
  value: UnitCode;
  onChange: (value: UnitCode) => void;
  /** The pack's usual units come first; the rest stay available. */
  preferred?: readonly UnitCode[] | undefined;
};

export function UnitPicker({ value, onChange, preferred = [] }: UnitPickerProps) {
  const { t } = useAppTranslation('products');

  const ordered = [
    ...preferred.filter((unit) => UNIT_CODES.includes(unit)),
    ...UNIT_CODES.filter((unit) => !preferred.includes(unit)),
  ];

  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('form.unit')}>
      {ordered.map((unit) => (
        <Chip key={unit} selected={value === unit} onClick={() => onChange(unit)}>
          {t(`common:units.${unit}`, { ns: 'common' })}
        </Chip>
      ))}
    </div>
  );
}

/** Small "12 items" chip used by the category list. */
export function CountChip({ count }: { count: number }) {
  return (
    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
      <NumberText value={count} />
    </span>
  );
}
