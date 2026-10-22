import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { Field } from '@/components/common/Field';
import { MoneyInput } from '@/components/common/MoneyInput';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/input';
import { useAuth } from '@/features/auth/useAuth';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';

import { useCreateCustomer, useCustomer, useUpdateCustomer } from '../queries';
import {
  buildCustomerFormSchema,
  EMPTY_CUSTOMER_FORM,
  toCustomerInput,
  toFormValues,
  type CustomerFormValues,
} from '../schema';
import { CustomerApiError } from '../types';

/**
 * Add or edit one customer.
 *
 * Two required fields at most (name, and the phone if they have one at hand):
 * a shopkeeper adds a khata while the person is standing at the counter, so
 * everything else is optional and below the fold.
 */
export function CustomerFormPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const isEdit = Boolean(customerId);
  const { t } = useAppTranslation('customers');
  const { t: tc } = useAppTranslation('common');
  const tenant = useAuth().activeTenant;
  const tenantId = tenant?.tenantId ?? '';
  const navigate = useNavigate();

  const customerQuery = useCustomer(tenantId, customerId ?? '');
  const createCustomer = useCreateCustomer(tenantId);
  const updateCustomer = useUpdateCustomer(tenantId, customerId ?? '');

  const schema = useMemo(() => buildCustomerFormSchema(t), [t]);
  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_CUSTOMER_FORM,
    mode: 'onBlur',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [creditLimitPaisa, setCreditLimitPaisa] = useState(0);

  useEffect(() => {
    if (!isEdit || !customerQuery.data) return;
    const values = toFormValues(customerQuery.data);
    form.reset(values);
    setCreditLimitPaisa(customerQuery.data.creditLimitPaisa ?? 0);
  }, [isEdit, customerQuery.data, form]);

  const { errors } = form.formState;
  const pending = createCustomer.isPending || updateCustomer.isPending;

  const onValid = async (values: CustomerFormValues) => {
    if (!tenantId) return;
    setFormError(null);

    const input = toCustomerInput(values);

    try {
      if (isEdit && customerId) {
        await updateCustomer.mutateAsync(input);
        toast.success(t('form.saved'));
        navigate(`/customers/${customerId}`);
        return;
      }

      const created = await createCustomer.mutateAsync({
        name: input.name,
        phone: input.phone,
        address: input.address,
        note: input.note,
        creditLimitPaisa: input.creditLimitPaisa,
      });
      toast.success(t('form.saved'));
      navigate(`/customers/${created.id}`);
    } catch (cause) {
      const code = cause instanceof CustomerApiError ? cause.code : 'unknown';
      setFormError(
        code === 'duplicate_phone'
          ? t('form.duplicatePhone')
          : code === 'invalid_phone'
            ? t('form.phoneInvalid')
            : code === 'forbidden'
              ? t('form.forbidden')
              : t('form.failed'),
      );
    }
  };

  if (isEdit && customerQuery.isPending) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-9 w-40" />
        <div className="skeleton h-14 w-full" />
        <div className="skeleton h-14 w-full" />
        <div className="skeleton h-14 w-full" />
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onValid)} noValidate>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(isEdit && customerId ? `/customers/${customerId}` : '/customers')}
        >
          <ArrowLeft aria-hidden="true" />
          {tc('actions.back')}
        </Button>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-bold">{isEdit ? t('form.editTitle') : t('form.newTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('form.subtitle')}</p>
      </header>

      <Field id="customer-name" label={t('form.name')} error={errors.name?.message}>
        <input
          id="customer-name"
          {...form.register('name')}
          autoComplete="off"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? 'customer-name-error' : undefined}
          placeholder={t('form.namePlaceholder')}
          className={inputClass}
        />
      </Field>

      <Field
        id="customer-phone"
        label={t('form.phone')}
        hint={t('form.phoneHint')}
        error={errors.phone?.message}
      >
        <input
          id="customer-phone"
          {...form.register('phone')}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          aria-invalid={errors.phone ? true : undefined}
          aria-describedby={errors.phone ? 'customer-phone-error' : 'customer-phone-hint'}
          placeholder="01XXXXXXXXX"
          className={inputClass}
        />
      </Field>

      <Field id="customer-address" label={t('form.address')} error={errors.address?.message}>
        <input
          id="customer-address"
          {...form.register('address')}
          autoComplete="off"
          className={inputClass}
          placeholder={t('form.addressPlaceholder')}
        />
      </Field>

      {/* The money input owns paisa; the form value mirrors it as taka text so
          the schema can validate what the user actually typed. */}
      <MoneyInput
        id="customer-credit-limit"
        label={t('form.creditLimit')}
        valuePaisa={creditLimitPaisa}
        onChange={(paisa) => {
          setCreditLimitPaisa(paisa);
          form.setValue('creditLimit', paisa === 0 ? '' : String(paisa / 100), {
            shouldValidate: true,
          });
        }}
        hint={t('form.creditLimitHint')}
      />

      <Field id="customer-note" label={t('form.note')} error={errors.note?.message}>
        <textarea
          id="customer-note"
          {...form.register('note')}
          rows={2}
          maxLength={300}
          aria-invalid={errors.note ? true : undefined}
          aria-describedby={errors.note ? 'customer-note-error' : undefined}
          className={`${inputClass} py-2`}
          placeholder={t('form.notePlaceholder')}
        />
      </Field>

      {formError ? (
        <p role="alert" className="text-sm text-money-out">
          {formError}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? (
          <Loader2 aria-hidden="true" className="animate-spin" />
        ) : (
          <Save aria-hidden="true" />
        )}
        {pending ? t('form.saving') : tc('actions.save')}
      </Button>
    </form>
  );
}
