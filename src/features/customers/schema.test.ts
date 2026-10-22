import { describe, expect, it } from 'vitest';

import bn from '@/locales/bn/customers.json';

import {
  buildCustomerFormSchema,
  EMPTY_CUSTOMER_FORM,
  toCustomerInput,
  toFormValues,
} from './schema';

/**
 * The form rules in form space: the shopkeeper types taka and a phone number as
 * text, and only `toCustomerInput` turns them into paisa and E.164.
 */

// A stand-in for i18next: returns the Bangla string, with interpolation applied.
const t = ((key: string, options?: Record<string, unknown>) => {
  const [scope, leaf] = key.split('.');
  const table = bn as unknown as Record<string, unknown>;
  const raw =
    leaf === undefined
      ? (table[scope ?? ''] as string | undefined)
      : ((table[scope ?? ''] as Record<string, string> | undefined)?.[leaf] ?? key);

  if (typeof raw !== 'string') return key;
  return raw.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options?.[name] ?? ''));
}) as unknown as Parameters<typeof buildCustomerFormSchema>[0];

const schema = buildCustomerFormSchema(t);

const parse = (patch: Partial<typeof EMPTY_CUSTOMER_FORM> = {}) =>
  schema.safeParse({ ...EMPTY_CUSTOMER_FORM, ...patch });

describe('customer form schema', () => {
  it('accepts a name alone: that is all a khata needs', () => {
    expect(parse({ name: 'রহিম ভাই' }).success).toBe(true);
  });

  it('rejects an empty name', () => {
    const result = parse({ name: '   ' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(bn.form.nameRequired);
  });

  it('accepts every way a Bangladeshi number is written', () => {
    for (const phone of ['01712345678', '+8801712345678', '8801712345678', '০১৭১২৩৪৫৬৭৮']) {
      expect(parse({ name: 'রহিম', phone }).success, phone).toBe(true);
    }
  });

  it('rejects a number that is not a BD mobile', () => {
    expect(parse({ name: 'রহিম', phone: '12345' }).success).toBe(false);
    expect(parse({ name: 'রহিম', phone: '0171234567' }).success).toBe(false);
  });

  it('accepts an empty credit limit but not a broken one', () => {
    expect(parse({ name: 'রহিম', creditLimit: '' }).success).toBe(true);
    expect(parse({ name: 'রহিম', creditLimit: '2000' }).success).toBe(true);
    expect(parse({ name: 'রহিম', creditLimit: '১২.৫০' }).success).toBe(true);
    expect(parse({ name: 'রহিম', creditLimit: 'lots' }).success).toBe(false);
  });

  it('rejects a note longer than the column allows', () => {
    expect(parse({ name: 'রহিম', note: 'ক'.repeat(301) }).success).toBe(false);
  });
});

describe('toCustomerInput', () => {
  it('trims, converts bangla digits and drops empty optional fields to null', () => {
    expect(
      toCustomerInput({
        name: '  রহিম ভাই ',
        phone: ' ০১৭১২৩৪৫৬৭৮ ',
        address: '   ',
        note: '',
        creditLimit: '২,০০০',
      }),
    ).toEqual({
      name: 'রহিম ভাই',
      phone: '০১৭১২৩৪৫৬৭৮',
      address: null,
      note: null,
      creditLimitPaisa: 200000,
    });
  });

  it('converts taka to paisa without floating point drift', () => {
    const input = toCustomerInput({
      ...EMPTY_CUSTOMER_FORM,
      name: 'রহিম',
      creditLimit: '12.29',
    });
    expect(input.creditLimitPaisa).toBe(1229);
  });
});

describe('toFormValues', () => {
  it('round-trips a stored customer back into the form', () => {
    const values = toFormValues({
      name: 'রহিম',
      phone: '+8801712345678',
      address: 'নতুন বাজার',
      note: null,
      creditLimitPaisa: 200000,
    });

    expect(values).toEqual({
      name: 'রহিম',
      phone: '+8801712345678',
      address: 'নতুন বাজার',
      note: '',
      creditLimit: '2000.00',
    });
  });

  it('leaves the limit field empty when there is no limit', () => {
    expect(
      toFormValues({ name: 'x', phone: null, address: null, note: null, creditLimitPaisa: null })
        .creditLimit,
    ).toBe('');
  });
});
