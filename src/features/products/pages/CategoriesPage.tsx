import { useMemo, useState } from 'react';
import { ArrowLeft, Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/useAuth';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { usePreferences } from '@/features/settings/preferences';
import { formatInteger } from '@/lib/format';

import { setCategoryDeleted } from '../api';
import { Field } from '../components/Field';
import { inputClass } from '../components/fieldStyles';
import { EmptyPanel, ErrorPanel, ProductListSkeleton } from '../components/States';
import {
  useCategories,
  useCreateCategory,
  useRenameCategory,
  useToggleCategoryDeleted,
} from '../queries';
import { buildCategorySchema } from '../schema';
import { ProductApiError } from '../types';
import { useCatalogueTerms } from '../useCatalogueTerms';

/**
 * Category management: the screen a shopkeeper opens once a week, not daily.
 * Add, rename and remove — nothing else. Removing a category never removes the
 * products in it; they simply become uncategorised.
 */
export function CategoriesPage() {
  const { t } = useAppTranslation('products');
  const { singular } = useCatalogueTerms();
  const tenantId = useAuth().activeTenant?.tenantId ?? '';

  const categories = useCategories(tenantId);
  const createCategory = useCreateCategory(tenantId);
  const renameCategory = useRenameCategory();
  const toggleDeleted = useToggleCategoryDeleted();

  const schema = useMemo(() => buildCategorySchema(t), [t]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const numerals = usePreferences((s) => s.numerals);

  const describe = (cause: unknown) => {
    if (cause instanceof ProductApiError && cause.code === 'duplicate_category') {
      return t('categories.duplicate');
    }
    const code = cause instanceof ProductApiError ? cause.code : 'unknown';
    return t(`errors.${code}`);
  };

  const addCategory = async () => {
    const parsed = schema.safeParse({ name });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t('categories.required'));
      return;
    }
    setError(null);
    try {
      await createCategory.mutateAsync(parsed.data.name);
      setName('');
    } catch (cause) {
      setError(describe(cause));
    }
  };

  const saveRename = async (categoryId: string) => {
    const parsed = schema.safeParse({ name: editName });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t('categories.required'));
      return;
    }
    setError(null);
    try {
      await renameCategory.mutateAsync({ categoryId, name: parsed.data.name });
      setEditingId(null);
    } catch (cause) {
      setError(describe(cause));
    }
  };

  const removeCategory = async (categoryId: string) => {
    try {
      await toggleDeleted.mutateAsync({ categoryId, deleted: true });
      toast.success(t('categories.deleted'), {
        duration: 10_000,
        action: {
          label: t('categories.undo'),
          onClick: () => {
            void setCategoryDeleted(categoryId, false);
          },
        },
      });
    } catch (cause) {
      setError(describe(cause));
    }
  };

  return (
    <div className="space-y-4 pb-4">
      <Link
        to="/products"
        className="inline-flex min-h-touch items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('common:actions.back', { ns: 'common' })}
      </Link>

      <header className="space-y-1">
        <h1 className="text-2xl font-bold">{t('categories.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('categories.subtitle')}</p>
      </header>

      <section className="app-card space-y-3 p-4">
        <Field id="category-name" label={t('categories.nameLabel')} error={error ?? undefined}>
          <input
            id="category-name"
            value={name}
            maxLength={60}
            placeholder={t('categories.namePlaceholder')}
            aria-invalid={Boolean(error)}
            className={inputClass}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void addCategory();
              }
            }}
          />
        </Field>
        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={createCategory.isPending || name.trim() === ''}
          onClick={() => void addCategory()}
        >
          {createCategory.isPending ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : (
            <Plus aria-hidden="true" />
          )}
          {t('categories.add')}
        </Button>
      </section>

      {categories.isPending ? <ProductListSkeleton rows={3} /> : null}

      {categories.isError ? (
        <ErrorPanel
          message={t('loadFailed')}
          retryLabel={t('retry')}
          onRetry={() => void categories.refetch()}
        />
      ) : null}

      {categories.isSuccess && categories.data.length === 0 ? (
        <EmptyPanel title={t('categories.empty')} body={t('categories.emptyBody')} />
      ) : null}

      <ul className="space-y-2">
        {(categories.data ?? []).map((category) => (
          <li key={category.id} className="app-card p-3">
            {editingId === category.id ? (
              <div className="flex items-center gap-2">
                <input
                  value={editName}
                  autoFocus
                  maxLength={60}
                  aria-label={t('categories.rename')}
                  className={inputClass}
                  onChange={(event) => setEditName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void saveRename(category.id);
                    }
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  aria-label={t('categories.save')}
                  disabled={renameCategory.isPending}
                  onClick={() => void saveRename(category.id)}
                >
                  <Check aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={t('common:actions.cancel', { ns: 'common' })}
                  onClick={() => setEditingId(null)}
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{category.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('categories.itemCount', {
                      total: formatInteger(category.productCount, numerals),
                      product: singular,
                    })}
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`${t('categories.rename')} — ${category.name}`}
                  onClick={() => {
                    setEditingId(category.id);
                    setEditName(category.name);
                  }}
                >
                  <Pencil aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-money-out"
                  aria-label={`${t('categories.delete')} — ${category.name}`}
                  disabled={toggleDeleted.isPending}
                  onClick={() => setConfirmingId(category.id)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            )}

            {confirmingId === category.id ? (
              <div className="mt-3 space-y-2 border-t border-border/60 pt-3" role="alertdialog">
                <p className="text-sm">
                  {category.productCount > 0
                    ? t('categories.productNote', {
                        total: formatInteger(category.productCount, numerals),
                        product: singular,
                      })
                    : t('categories.delete')}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    className="flex-1"
                    disabled={toggleDeleted.isPending}
                    onClick={() => {
                      setConfirmingId(null);
                      void removeCategory(category.id);
                    }}
                  >
                    {t('categories.delete')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1"
                    onClick={() => setConfirmingId(null)}
                  >
                    {t('common:actions.cancel', { ns: 'common' })}
                  </Button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
