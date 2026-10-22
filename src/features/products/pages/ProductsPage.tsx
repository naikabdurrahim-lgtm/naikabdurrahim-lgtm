import { useMemo, useState } from 'react';
import { Plus, Search, Tags, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/useAuth';
import { useAppTranslation } from '@/lib/i18n/useAppTranslation';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

import { ProductCard } from '../components/ProductCard';
import { EmptyPanel, ErrorPanel, ProductListSkeleton } from '../components/States';
import { useCategories, useProducts } from '../queries';
import { useCatalogueTerms } from '../useCatalogueTerms';

/**
 * The catalogue.
 *
 * Search and paging happen on the server (`search_products`, migration 0012), so
 * a pharmacy with thousands of SKUs does not download them all. The category
 * chips are filtered client-side because the list is at most a few dozen rows.
 */
export function ProductsPage() {
  const { t } = useAppTranslation('products');
  const { plural, singular } = useCatalogueTerms();
  const tenant = useAuth().activeTenant;
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [lowStock, setLowStock] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 250);

  const filters = useMemo(
    () => ({ query: debouncedSearch, categoryId, lowStock }),
    [debouncedSearch, categoryId, lowStock],
  );

  const products = useProducts(tenant?.tenantId ?? '', filters);
  const categories = useCategories(tenant?.tenantId ?? '');

  const items = products.data?.pages.flat() ?? [];
  const isSearching = debouncedSearch.trim() !== '' || categoryId !== null || lowStock;
  const total = items.length;

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{plural}</h1>
          {total > 0 ? (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
              {total}
              {products.hasNextPage ? '+' : ''}
            </span>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="ms-auto"
            onClick={() => navigate('/products/categories')}
          >
            <Tags aria-hidden="true" />
            {t('openCategories')}
          </Button>
        </div>

        <div className="flex min-h-cta items-center gap-2 rounded-xl border border-input bg-secondary/40 px-3 focus-within:border-primary">
          <Search aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchLabel', { product: singular })}
            className="min-h-cta w-full bg-transparent text-base outline-none"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label={t('common:actions.cancel', { ns: 'common' })}
              className="grid size-8 place-items-center rounded-full text-muted-foreground hover:text-foreground"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          ) : null}
        </div>

        {categories.data && categories.data.length > 0 ? (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group">
            <FilterChip
              selected={!lowStock && categoryId === null}
              onClick={() => {
                setCategoryId(null);
                setLowStock(false);
              }}
              label={t('all')}
            />
            {categories.data.map((category) => (
              <FilterChip
                key={category.id}
                selected={categoryId === category.id}
                onClick={() => setCategoryId(category.id)}
                label={category.name}
                count={category.productCount}
              />
            ))}
            <FilterChip
              selected={lowStock}
              onClick={() => {
                setLowStock((on) => !on);
                setCategoryId(null);
              }}
              label={t('lowStockOnly')}
            />
          </div>
        ) : null}

        <Button size="lg" className="w-full" onClick={() => navigate('/products/new')}>
          <Plus aria-hidden="true" />
          {t('add', { product: singular })}
        </Button>
      </header>

      {products.isPending ? <ProductListSkeleton /> : null}

      {products.isError ? (
        <ErrorPanel
          message={t('loadFailed')}
          retryLabel={t('retry')}
          onRetry={() => void products.refetch()}
        />
      ) : null}

      {products.isSuccess && items.length === 0 ? (
        <EmptyPanel
          title={isSearching ? t('emptySearchTitle') : t('emptyTitle', { product: singular })}
          body={isSearching ? t('emptySearchBody', { product: singular }) : t('emptyBody')}
          actionLabel={isSearching ? undefined : t('add', { product: singular })}
          onAction={isSearching ? undefined : () => navigate('/products/new')}
          searching={isSearching}
        />
      ) : null}

      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((product) => (
            <li key={product.id}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      ) : null}

      {products.hasNextPage ? (
        <Button
          variant="secondary"
          className="w-full"
          disabled={products.isFetchingNextPage}
          onClick={() => void products.fetchNextPage()}
        >
          {products.isFetchingNextPage ? t('loadingMore') : t('loadMore')}
        </Button>
      ) : null}
    </div>
  );
}

function FilterChip({
  selected,
  onClick,
  label,
  count,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={
        selected
          ? 'min-h-touch shrink-0 rounded-full border border-primary bg-primary/10 px-3 text-sm font-medium text-primary'
          : 'min-h-touch shrink-0 rounded-full border border-border bg-secondary/40 px-3 text-sm font-medium text-muted-foreground'
      }
    >
      {label}
      {typeof count === 'number' && count > 0 ? (
        <span className="ms-1.5 text-xs opacity-70">{count}</span>
      ) : null}
    </button>
  );
}
