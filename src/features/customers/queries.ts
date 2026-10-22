import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createCustomer, searchCustomers } from './api';
import type { NewCustomer } from './types';

export const customerKeys = {
  all: ['customers'] as const,
  search: (tenantId: string, query: string) => ['customers', tenantId, 'search', query] as const,
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

export function useCreateCustomer(tenantId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: NewCustomer) => createCustomer(tenantId, input),
    onSuccess: () => client.invalidateQueries({ queryKey: customerKeys.all }),
  });
}
