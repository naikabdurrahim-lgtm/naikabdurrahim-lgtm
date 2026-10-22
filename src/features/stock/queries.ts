import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchStockMovements, fetchStockOverview, listStock, recordMovement } from './api';
import type { NewMovement, StockFilter } from './types';

/**
 * Stock hooks.
 *
 * A movement changes three things at once — the product's cached `stock_qty`,
 * the movement history and the stock value — so the invalidation is broad on
 * purpose: `['stock']` plus the catalogue cache. Patching numbers by hand is
 * how a screen ends up disagreeing with the database.
 */

export const stockKeys = {
  all: ['stock'] as const,
  list: (tenantId: string, query: string, filter: StockFilter) =>
    ['stock', tenantId, 'list', query, filter] as const,
  overview: (tenantId: string) => ['stock', tenantId, 'overview'] as const,
  movements: (tenantId: string, productId: string) =>
    ['stock', tenantId, 'movements', productId] as const,
};

const PAGE_SIZE = 30;

export function useStockOverview(tenantId: string) {
  return useQuery({
    queryKey: stockKeys.overview(tenantId),
    queryFn: () => fetchStockOverview(tenantId),
    enabled: tenantId !== '',
    staleTime: 30_000,
  });
}

export function useStock(tenantId: string, query: string, filter: StockFilter) {
  return useInfiniteQuery({
    queryKey: stockKeys.list(tenantId, query, filter),
    queryFn: ({ pageParam }) =>
      listStock(tenantId, { query, filter, limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.length < PAGE_SIZE ? undefined : pages.length * PAGE_SIZE,
    enabled: tenantId !== '',
    staleTime: 20_000,
  });
}

export function useStockMovements(tenantId: string, productId: string) {
  return useInfiniteQuery({
    queryKey: stockKeys.movements(tenantId, productId),
    queryFn: ({ pageParam }) => fetchStockMovements(tenantId, productId, { offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => (lastPage.length < 50 ? undefined : pages.length * 50),
    enabled: tenantId !== '' && productId !== '',
  });
}

export function useRecordMovement(tenantId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: NewMovement) => recordMovement(tenantId, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: stockKeys.all });
      // The catalogue shows the same number, and the POS refuses to oversell.
      void client.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
