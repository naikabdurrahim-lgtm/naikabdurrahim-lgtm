import { useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, Save, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/useAuth';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { setProductDeleted } from '../api';

import { Field } from '@/components/common/Field';
import { describedBy, inputClass } from '../components/fieldStyles';
import { CategoryChips, UnitPicker } from '../components/pickers';
import { ErrorPanel, ProductListSkeleton } from '../components/States';
import {
  useCategories,
  useCreateCategory,
  useCreateProduct,
  useProduct,
  useToggleProductDeleted,
  useUpdateProduct,
} from '../queries';
import {
  buildProductFormSchema,
  emptyProductForm,
  formValuesFromProduct,
  toProductInput,
  type ProductFormValues,
} from '../schema';
import { ProductApiError } from '../types';
import { useCatalogueTerms } from '../useCatalogueTerms';

/**
 * Add or edit one product.
 *
 * The first screen of the app that a shopkeeper uses every day, so it is a
 * single column, no wizard, no modal: name → price → save. Everything else is
 * optional and below the fold.
 */
export function ProductFormPage() {
  const { productId } = useParams<{ productId: string }>();
  const isEdit = Boolean(productId);
  const { t } = useAppTranslation('products');
  const { singular, pack } = useCatalogueTerms();
  const tenant = useAuth().activeTenant;
  const tenantId = tenant?.tenantId ?? '';
  const navigate = useNavigate();

  const productQuery = useProduct(tenantId, productId ?? 'new', isEdit);
  const categoriesQuery = useCategories(tenantId);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct(tenantId);
  const toggleDeleted = useToggleProductDeleted(tenantId);
  const createCategory = useCreateCategory(tenantId);

  const defaultUnit = pack.defaultUnits[0] ?? 'piece';
  const schema = useMemo(() => buildProductFormSchema(t), [t]);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyProductForm(defaultUnit, pack.id === 'restaurant' || pack.id === 'service'),
    mode: 'onBlur',
  });

  const intent = useRef<'save' | 'another'>('save');
  const nameRef = useRef<HTMLInputElement | null>(null);
  const nameField = form.register('name');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Fill the form once the product arrives (edit mode only).
  useEffect(() => {
    if (!isEdit || !productQuery.data) return;
    form.reset(formValuesFromProduct(productQuery.data, productQuery.data.isService));
  }, [isEdit, productQuery.data, form]);

  const { errors } = form.formState;
  const isService = form.watch('isService');
  const pending = createProduct.isPending || updateProduct.isPending;

  const errorMessage = (error: unknown): string => {
    const code = error instanceof ProductApiError ? error.code : 'unknown';
    return t(`errors.${code}`);
  };

  const onValid = async (values: ProductFormValues) => {
    if (!tenantId) return;
    setFormError(null);

    try {
      const draft = toProductInput(values, { tenantId, isEdit });

      if (isEdit && productId) {
        await updateProduct.mutateAsync({ productId, input: draft.input });
        toast.success(t('form.saved'));
        navigate('/products');
        return;
      }

      await createProduct.mutateAsync({ draft, reason: t('form.openingReason') });
      toast.success(t('form.saved'));

      if (intent.current === 'another') {
        // Keep the unit and the service flag: they rarely change between two
        // products added back to back.
        form.reset(emptyProductForm(values.unitCode, values.isService));
        nameRef.current?.focus();
        return;
      }
      navigate('/products');
    } catch (error) {
      setFormError(errorMessage(error));
    }
  };

  const handleDelete = async () => {
    if (!productId) return;
    try {
      await toggleDeleted.mutateAsync({ productId, deleted: true });
      navigate('/products');
      toast.success(t('form.deleted', { product: singular }), {
        // Undo must last long enough to be noticed (PROJECT_RULES 3.1 #10).
        duration: 10_000,
        action: {
          label: t('form.undo'),
          onClick: () => {
            void setProductDeleted(tenantId, productId, false).then(() => {
              toast.success(t('form.restored', { product: singular }));
            });
          },
        },
      });
    } catch (error) {
      setFormError(errorMessage(error));
    }
  };

  if (isEdit && productQuery.isPending) {
    return (
      <div className="space-y-4">
        <BackLink label={t('common:actions.back', { ns: 'common' })} />
        <ProductListSkeleton rows={2} />
      </div>
    );
  }

  if (isEdit && productQuery.isError) {
    return (
      <div className="space-y-4">
        <BackLink label={t('common:actions.back', { ns: 'common' })} />
        <ErrorPanel
          message={
            productQuery.error instanceof ProductApiError && productQuery.error.code === 'not_found'
              ? t('form.notFound', { product: singular })
              : t('loadFailed')
          }
          retryLabel={t('retry')}
          onRetry={() => void productQuery.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <BackLink label={t('common:actions.back', { ns: 'common' })} />

      <h1 className="text-2xl font-bold">
        {isEdit
          ? t('form.editTitle', { product: singular })
          : t('form.newTitle', { product: singular })}
      </h1>

      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => {
          intent.current = 'save';
          return onValid(values);
        })}
      >
        <section className="app-card space-y-4 p-4">
          <Field
            id="name"
            label={t('form.name')}
            error={errors.name?.message}
            hint={t('form.namePlaceholder')}
          >
            <input
              id="name"
              autoFocus
              maxLength={160}
              placeholder={t('form.namePlaceholder')}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={describedBy(
                'name',
                errors.name?.message,
                t('form.namePlaceholder'),
              )}
              className={inputClass}
              name={nameField.name}
              onChange={nameField.onChange}
              onBlur={nameField.onBlur}
              ref={(node) => {
                nameField.ref(node);
                nameRef.current = node;
              }}
            />
          </Field>

          <Field id="nameEn" label={t('form.nameEn')} error={errors.nameEn?.message}>
            <input
              id="nameEn"
              dir="ltr"
              maxLength={160}
              placeholder={t('form.nameEnPlaceholder')}
              className={inputClass}
              {...form.register('nameEn')}
            />
          </Field>
        </section>

        <section className="app-card space-y-3 p-4">
          <p className="text-sm font-medium">{t('form.category')}</p>
          <CategoryChips
            categories={categoriesQuery.data ?? []}
            value={form.watch('categoryId')}
            onChange={(value) => form.setValue('categoryId', value, { shouldDirty: true })}
            allowCreate
            creating={createCategory.isPending}
            onCreate={async (name) => {
              try {
                const id = await createCategory.mutateAsync(name);
                form.setValue('categoryId', id, { shouldDirty: true });
              } catch (error) {
                setFormError(
                  error instanceof ProductApiError && error.code === 'duplicate_category'
                    ? t('categories.duplicate')
                    : errorMessage(error),
                );
              }
            }}
          />
        </section>

        <section className="app-card space-y-4 p-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('form.unit')}</p>
            <UnitPicker
              value={form.watch('unitCode')}
              onChange={(unit) => form.setValue('unitCode', unit, { shouldDirty: true })}
              preferred={pack.defaultUnits}
            />
          </div>

          <Field id="sellPrice" label={t('form.sellPrice')} error={errors.sellPrice?.message}>
            <div className="flex items-center gap-2 rounded-xl border border-input bg-secondary/40 ps-3 focus-within:border-primary">
              <span aria-hidden="true" className="text-lg text-muted-foreground">
                ৳
              </span>
              <input
                id="sellPrice"
                inputMode="decimal"
                placeholder={t('form.pricePlaceholder')}
                aria-invalid={Boolean(errors.sellPrice)}
                aria-describedby={describedBy('sellPrice', errors.sellPrice?.message)}
                className={`${inputClass} border-0 bg-transparent ps-0`}
                {...form.register('sellPrice')}
              />
            </div>
          </Field>

          <Field
            id="buyPrice"
            label={t('form.buyPrice')}
            hint={t('form.buyPriceHint')}
            error={errors.buyPrice?.message}
          >
            <div className="flex items-center gap-2 rounded-xl border border-input bg-secondary/40 ps-3 focus-within:border-primary">
              <span aria-hidden="true" className="text-lg text-muted-foreground">
                ৳
              </span>
              <input
                id="buyPrice"
                inputMode="decimal"
                placeholder={t('form.pricePlaceholder')}
                className={`${inputClass} border-0 bg-transparent ps-0`}
                {...form.register('buyPrice')}
              />
            </div>
          </Field>
        </section>

        <section className="app-card space-y-4 p-4">
          <Field
            id="barcode"
            label={t('form.barcode')}
            hint={t('form.barcodeHint')}
            error={errors.barcode?.message}
          >
            <input
              id="barcode"
              dir="ltr"
              inputMode="numeric"
              maxLength={64}
              className={inputClass}
              {...form.register('barcode')}
            />
          </Field>

          <Field
            id="stockAlert"
            label={t('form.stockAlert')}
            hint={t('form.stockAlertHint')}
            error={errors.stockAlert?.message}
          >
            <input
              id="stockAlert"
              inputMode="decimal"
              placeholder="0"
              className={inputClass}
              {...form.register('stockAlert')}
            />
          </Field>

          {!isEdit ? (
            <Field
              id="openingStock"
              label={t('form.openingStock')}
              hint={t('form.openingStockHint')}
              error={errors.openingStock?.message}
            >
              <input
                id="openingStock"
                inputMode="decimal"
                placeholder="0"
                disabled={isService}
                className={inputClass}
                {...form.register('openingStock')}
              />
            </Field>
          ) : null}

          <label className="flex min-h-touch items-center gap-3 rounded-xl bg-secondary/40 px-3">
            <input
              type="checkbox"
              className="size-5 rounded border-input"
              {...form.register('isService')}
            />
            <span className="text-sm">{t('form.isService')}</span>
          </label>
        </section>

        {formError ? (
          <p role="alert" className="rounded-xl bg-money-out/10 p-3 text-sm text-money-out">
            {formError}
          </p>
        ) : null}

        <div className="space-y-2">
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              <Save aria-hidden="true" />
            )}
            {pending ? t('form.saving') : t('form.save')}
          </Button>

          {!isEdit ? (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={pending}
              onClick={() => {
                intent.current = 'another';
                void form.handleSubmit(onValid)();
              }}
            >
              {t('form.saveAnother')}
            </Button>
          ) : null}
        </div>
      </form>

      {isEdit ? (
        <section className="app-card space-y-3 p-4">
          {confirmingDelete ? (
            <div
              className="space-y-3"
              role="alertdialog"
              aria-label={t('form.deleteTitle', { product: singular })}
            >
              <p className="font-medium">{t('form.deleteTitle', { product: singular })}</p>
              <p className="text-sm text-muted-foreground">{t('form.deleteBody')}</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  className="flex-1"
                  disabled={toggleDeleted.isPending}
                  onClick={() => void handleDelete()}
                >
                  {t('form.delete')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setConfirmingDelete(false)}
                >
                  {t('common:actions.cancel', { ns: 'common' })}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="w-full text-money-out"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 aria-hidden="true" />
              {t('form.delete')}
            </Button>
          )}
        </section>
      ) : null}
    </div>
  );
}

function BackLink({ label }: { label: string }) {
  return (
    <Link
      to="/products"
      className="inline-flex min-h-touch items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {label}
    </Link>
  );
}
