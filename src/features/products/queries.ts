import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import {
  PRODUCT_PAGE_SIZE,
  createCategory,
  createProduct,
  fetchCategories,
  fetchProduct,
  fetchProducts,
  renameCategory,
  setCategoryDeleted,
  setProductDeleted,
  updateProduct,
} from './api';
import type { ProductDraft } from './schema';
import type { ProductInput, ProductListFilters } from './types';

/**
 * Query keys and hooks for the catalogue.
 *
 * One rule: anything that changes a product also invalidates the category list,
 * because the per-category counts are computed from products.
 */

export const productKeys = {
  all: ['products'] as const,
  list: (tenantId: string, filters: ProductListFilters) =>
    [
      'products',
      tenantId,
      filters.query,
      filters.categoryId,
      filters.lowStock,
      filters.includeInactive ?? true,
    ] as const,
  detail: (tenantId: string, productId: string) =>
    ['products', tenantId, 'detail', productId] as const,
  categories: (tenantId: string) => ['categories', tenantId] as const,
};

function invalidateCatalogue(client: QueryClient) {
  void client.invalidateQueries({ queryKey: productKeys.all });
  void client.invalidateQueries({ queryKey: ['categories'] });
}

export function useProducts(tenantId: string, filters: ProductListFilters) {
  return useInfiniteQuery({
    queryKey: productKeys.list(tenantId, filters),
    queryFn: ({ pageParam }) => fetchProducts(tenantId, filters, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === PRODUCT_PAGE_SIZE ? pages.length * PRODUCT_PAGE_SIZE : undefined,
    // The catalogue changes rarely; refetching on every focus would flash the list.
    staleTime: 30_000,
  });
}

export function useProduct(tenantId: string, productId: string, enabled = true) {
  return useQuery({
    queryKey: productKeys.detail(tenantId, productId),
    queryFn: () => fetchProduct(tenantId, productId),
    enabled: enabled && productId !== 'new',
    staleTime: 0,
  });
}

export function useCategories(tenantId: string) {
  return useQuery({
    queryKey: productKeys.categories(tenantId),
    queryFn: () => fetchCategories(tenantId),
    staleTime: 30_000,
  });
}

export function useCreateProduct() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ draft, reason }: { draft: ProductDraft; reason: string }) =>
      createProduct(draft.input, draft.openingStockMilli, reason),
    onSuccess: () => invalidateCatalogue(client),
  });
}

export function useUpdateProduct(tenantId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, input }: { productId: string; input: ProductInput }) =>
      updateProduct(productId, input),
    onSuccess: (_data, variables) => {
      void client.invalidateQueries({
        queryKey: productKeys.detail(tenantId, variables.productId),
      });
      invalidateCatalogue(client);
    },
  });
}

export function useToggleProductDeleted(tenantId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, deleted }: { productId: string; deleted: boolean }) =>
      setProductDeleted(tenantId, productId, deleted),
    onSuccess: () => invalidateCatalogue(client),
  });
}

export function useCreateCategory(tenantId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createCategory(tenantId, name),
    onSuccess: () => invalidateCatalogue(client),
  });
}

export function useRenameCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, name }: { categoryId: string; name: string }) =>
      renameCategory(categoryId, name),
    onSuccess: () => invalidateCatalogue(client),
  });
}

export function useToggleCategoryDeleted() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, deleted }: { categoryId: string; deleted: boolean }) =>
      setCategoryDeleted(categoryId, deleted),
    onSuccess: () => invalidateCatalogue(client),
  });
}
