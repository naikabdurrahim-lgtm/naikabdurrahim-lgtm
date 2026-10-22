import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import {
  fetchRecentSales,
  fetchSalesReport,
  fetchToday,
  fetchTopProducts,
  rangeDates,
} from './api';
import type { ReportRange } from './types';

/**
 * Report hooks. Everything is keyed by the date range, so switching between আজ
 * / ৭ দিন / ৩০ দিন is instant after the first visit and never shows a stale total
 * next to a new heading.
 */

export const reportKeys = {
  all: ['reports'] as const,
  today: (tenantId: string, date?: string) =>
    ['reports', tenantId, 'today', date ?? 'now'] as const,
  recent: (tenantId: string, date?: string) =>
    ['reports', tenantId, 'recent', date ?? 'all'] as const,
  range: (tenantId: string, from: string, to: string) =>
    ['reports', tenantId, 'range', from, to] as const,
  top: (tenantId: string, from: string, to: string) =>
    ['reports', tenantId, 'top', from, to] as const,
};

export function useToday(tenantId: string, date?: string) {
  return useQuery({
    queryKey: reportKeys.today(tenantId, date),
    queryFn: () => fetchToday(tenantId, date),
    enabled: tenantId !== '',
    // The counter changes every minute; half a minute stale is plenty.
    staleTime: 30_000,
  });
}

export function useRecentSales(tenantId: string, date?: string) {
  return useInfiniteQuery({
    queryKey: reportKeys.recent(tenantId, date),
    queryFn: ({ pageParam }) => {
      const options: { limit: number; offset: number; date?: string } = {
        limit: 20,
        offset: pageParam,
      };
      if (date) options.date = date;
      return fetchRecentSales(tenantId, options);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => (lastPage.length < 20 ? undefined : pages.length * 20),
    enabled: tenantId !== '',
    staleTime: 20_000,
  });
}

export function useSalesReport(tenantId: string, range: ReportRange, enabled = true) {
  const { from, to } = rangeDates(range);
  return useQuery({
    queryKey: reportKeys.range(tenantId, from, to),
    queryFn: () => fetchSalesReport(tenantId, from, to),
    enabled: enabled && tenantId !== '',
    staleTime: 60_000,
  });
}

export function useTopProducts(tenantId: string, range: ReportRange, enabled = true) {
  const { from, to } = rangeDates(range);
  return useQuery({
    queryKey: reportKeys.top(tenantId, from, to),
    queryFn: () => fetchTopProducts(tenantId, from, to),
    enabled: enabled && tenantId !== '',
    staleTime: 60_000,
  });
}
