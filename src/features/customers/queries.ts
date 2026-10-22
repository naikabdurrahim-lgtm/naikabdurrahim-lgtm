import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  collectPayment,
  createCustomer,
  deleteCustomer,
  fetchCustomer,
  fetchCustomerLedger,
  fetchDueSummary,
  listCustomers,
  searchCustomers,
  updateCustomer,
  voidPayment,
  type CollectInput,
} from './api';
import type { CustomerInput, NewCustomer } from './types';

/**
 * Customer data hooks.
 *
 * Every customer query hangs off the `['customers']` prefix, so one collection
 * can invalidate the list, the summary, the khata and the ledger in one call —
 * the alternative (patching balances in the cache) drifts the moment two
 * devices are in use.
 */

export const customerKeys = {
  all: ['customers'] as const,
  search: (tenantId: string, query: string) => ['customers', tenantId, 'search', query] as const,
  list: (tenantId: string, query: string, onlyDue: boolean) =>
    ['customers', tenantId, 'list', query, onlyDue] as const,
  summary: (tenantId: string) => ['customers', tenantId, 'summary'] as const,
  detail: (tenantId: string, customerId: string) =>
    ['customers', tenantId, 'detail', customerId] as const,
  ledger: (tenantId: string, customerId: string) =>
    ['customers', tenantId, 'ledger', customerId] as const,
};

/** Reels in matching customers while the picker sheet is open. */
export function useCustomerSearch(tenantId: string, query: string, enabled: boolean) {
  return useQuery({
    queryKey: customerKeys.search(tenantId, query),
    queryFn: () => searchCustomers(tenantId, query),
    enabled: enabled && tenantId !== '',
    staleTime: 30_000,
  });
}

const PAGE_SIZE = 30;

export function useCustomers(tenantId: string, query: string, onlyDue: boolean) {
  return useInfiniteQuery({
    queryKey: customerKeys.list(tenantId, query, onlyDue),
    queryFn: ({ pageParam }) =>
      listCustomers(tenantId, { query, onlyDue, limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.length < PAGE_SIZE ? undefined : pages.length * PAGE_SIZE,
    enabled: tenantId !== '',
    staleTime: 20_000,
  });
}

export function useDueSummary(tenantId: string) {
  return useQuery({
    queryKey: customerKeys.summary(tenantId),
    queryFn: () => fetchDueSummary(tenantId),
    enabled: tenantId !== '',
    staleTime: 20_000,
  });
}

export function useCustomer(tenantId: string, customerId: string) {
  return useQuery({
    queryKey: customerKeys.detail(tenantId, customerId),
    queryFn: () => fetchCustomer(tenantId, customerId),
    enabled: tenantId !== '' && customerId !== '',
  });
}

export function useCustomerLedger(tenantId: string, customerId: string) {
  return useInfiniteQuery({
    queryKey: customerKeys.ledger(tenantId, customerId),
    queryFn: ({ pageParam }) => fetchCustomerLedger(tenantId, customerId, { offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => (lastPage.length < 50 ? undefined : pages.length * 50),
    enabled: tenantId !== '' && customerId !== '',
  });
}

export function useCreateCustomer(tenantId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: NewCustomer) => createCustomer(tenantId, input),
    onSuccess: () => client.invalidateQueries({ queryKey: customerKeys.all }),
  });
}

export function useUpdateCustomer(tenantId: string, customerId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CustomerInput) => updateCustomer(tenantId, customerId, input),
    onSuccess: () => client.invalidateQueries({ queryKey: customerKeys.all }),
  });
}

export function useDeleteCustomer(tenantId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (customerId: string) => deleteCustomer(tenantId, customerId),
    onSuccess: () => client.invalidateQueries({ queryKey: customerKeys.all }),
  });
}

export function useCollectPayment(tenantId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CollectInput) => collectPayment(tenantId, input),
    onSuccess: () => client.invalidateQueries({ queryKey: customerKeys.all }),
  });
}

export function useVoidPayment(tenantId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) => voidPayment(tenantId, paymentId),
    onSuccess: () => client.invalidateQueries({ queryKey: customerKeys.all }),
  });
}
