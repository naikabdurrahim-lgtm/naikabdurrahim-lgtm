import { z } from 'zod';

import { normaliseBdPhone } from '@/features/auth/lib/phone';
import type { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { parseTakaToPaisa } from '@/lib/money';

import type { CustomerInput } from './types';

/**
 * Customer form rules, in "form space": the shopkeeper types taka as a string,
 * and only `toCustomerInput` converts to paisa.
 *
 * Messages are built from `t` rather than defined at module level so every
 * string comes from `src/locales/**` (PROJECT_RULES 3.1 #14).
 */

export type Translate = ReturnType<typeof useAppTranslation>['t'];

const NAME_MAX = 120;
const ADDRESS_MAX = 200;
const NOTE_MAX = 300;

export type CustomerFormValues = {
  name: string;
  phone: string;
  address: string;
  note: string;
  creditLimit: string;
};

export const EMPTY_CUSTOMER_FORM: CustomerFormValues = {
  name: '',
  phone: '',
  address: '',
  note: '',
  creditLimit: '',
};

export function buildCustomerFormSchema(t: Translate) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t('form.nameRequired'))
      .max(NAME_MAX, t('form.tooLong', { max: NAME_MAX })),
    // Empty is fine: half the regulars are known by name only.
    phone: z
      .string()
      .trim()
      .refine((value) => value === '' || normaliseBdPhone(value) !== null, t('form.phoneInvalid')),
    address: z
      .string()
      .trim()
      .max(ADDRESS_MAX, t('form.tooLong', { max: ADDRESS_MAX })),
    note: z
      .string()
      .trim()
      .max(NOTE_MAX, t('form.tooLong', { max: NOTE_MAX })),
    creditLimit: z
      .string()
      .trim()
      .refine((value) => value === '' || parseTakaToPaisa(value) !== null, t('form.moneyInvalid')),
  });
}

export function toCustomerInput(values: CustomerFormValues): CustomerInput {
  const creditLimit = values.creditLimit.trim();

  return {
    name: values.name.trim(),
    phone: values.phone.trim() === '' ? null : values.phone.trim(),
    address: values.address.trim() === '' ? null : values.address.trim(),
    note: values.note.trim() === '' ? null : values.note.trim(),
    creditLimitPaisa: creditLimit === '' ? null : parseTakaToPaisa(creditLimit),
  };
}

/** Fills the form when editing an existing customer. */
export function toFormValues(customer: {
  name: string;
  phone: string | null;
  address: string | null;
  note: string | null;
  creditLimitPaisa: number | null;
}): CustomerFormValues {
  return {
    name: customer.name,
    phone: customer.phone ?? '',
    address: customer.address ?? '',
    note: customer.note ?? '',
    creditLimit:
      customer.creditLimitPaisa === null ? '' : (customer.creditLimitPaisa / 100).toFixed(2),
  };
}
