import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/useAuth';
import { useProducts } from '@/features/products/queries';

import { createSale, fetchPosSettings, fetchReceipt, voidSale } from './api';
import type { SalePayload } from './cart';
import type { PosSettings } from './types';

/**
 * POS data hooks.
 *
 * The product list reuses the catalogue query (same cache, same server-side
 * search) with `includeInactive: false`: a discontinued product must never be
 * sold by accident.
 */

export const posKeys = {
  all: ['pos'] as const,
  settings: (tenantId: string) => ['pos', 'settings', tenantId] as const,
  receipt: (tenantId: string, saleId: string) => ['pos', 'receipt', tenantId, saleId] as const,
};

export function usePosProducts(tenantId: string, query: string) {
  return useProducts(tenantId, {
    query,
    categoryId: null,
    lowStock: false,
    includeInactive: false,
  });
}

export function usePosSettings(tenantId: string) {
  return useQuery({
    queryKey: posKeys.settings(tenantId),
    queryFn: () => fetchPosSettings(tenantId),
    enabled: tenantId !== '',
    staleTime: 5 * 60_000,
  });
}

/** Whether this user may give a discount: role first, then the shop setting. */
export function useCanDiscount(): boolean {
  const role = useAuth().activeTenant?.role;
  const tenantId = useAuth().activeTenant?.tenantId ?? '';
  const settings = usePosSettings(tenantId);
  const isManager = role === 'owner' || role === 'manager';
  return isManager || (settings.data?.allowCashierDiscount ?? true);
}

export function useSubmitSale(tenantId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: SalePayload) => createSale(tenantId, payload),
    onSuccess: () => {
      // Stock changed and a due sale changed a customer balance: refetch both
      // rather than trying to patch numbers in the cache.
      void client.invalidateQueries({ queryKey: ['products'] });
      void client.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useVoidSale(tenantId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ saleId, reason }: { saleId: string; reason: string }) =>
      voidSale(tenantId, saleId, reason),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['products'] });
      void client.invalidateQueries({ queryKey: posKeys.all });
    },
  });
}

export function useReceipt(tenantId: string, saleId: string) {
  return useQuery({
    queryKey: posKeys.receipt(tenantId, saleId),
    queryFn: () => fetchReceipt(tenantId, saleId),
    enabled: tenantId !== '' && saleId !== '',
    staleTime: 60_000,
  });
}

export const DEFAULT_POS_SETTINGS: PosSettings = {
  receiptFooter: '',
  receiptHeader: null,
  allowCashierDiscount: true,
  allowNegativeStock: false,
};
