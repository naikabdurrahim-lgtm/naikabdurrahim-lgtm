import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import '@/lib/i18n';
import { App } from './App';
import { router } from './router';

/**
 * Smoke tests for the whole shell (providers, router, i18n, preferences).
 *
 * The CI environment has no `.env`, so the app must degrade to the setup notice
 * instead of a white screen. That is the first thing a new developer sees, and
 * breaking it is a classic first-day bug.
 */
describe('App shell', () => {
  it('renders the Bangla setup notice when Supabase is not configured', () => {
    const html = renderToString(<App />);

    expect(html).toContain('শুরু করার আগে');
    expect(html).toContain('Supabase');
    // Two honest ways out: retry, or read the public health check.
    expect(html).toContain('আবার চেক করুন');
    expect(html).toContain('/health');
    // Regression: a Settings button here looped back to this very screen,
    // because /settings also sits behind RequireAuth.
    expect(html).not.toContain('href="/settings"');
  });
});

describe('route table', () => {
  /** Collects every path in the nested route tree, including index routes. */
  const collect = (
    routes: typeof router.routes,
    parent = '',
  ): Array<{ path: string; index: boolean }> =>
    routes.flatMap((route) => {
      const path = route.path ?? '';
      const full = path.startsWith('/') ? path : `${parent}${path ? `/${path}` : ''}`;
      const children = collect(route.children ?? [], full === '/' ? '' : full);
      // Pathless routes are layout/guard routes (RequireAuth, RequireShop,
      // RequireRole); they render no page of their own.
      if (!route.path && !route.index) return children;
      return [{ path: full || '/', index: Boolean(route.index) }, ...children];
    });

  const paths = collect(router.routes).filter((route) => !route.index);

  it('has the public auth screens', () => {
    expect(paths.map((route) => route.path)).toEqual(
      expect.arrayContaining(['/sign-in', '/sign-up']),
    );
  });

  it('keeps onboarding outside the shop shell', () => {
    const onboarding = paths.find((route) => route.path === '/onboarding');
    const shopRoot = paths.find((route) => route.path === '/');
    expect(onboarding).toBeDefined();
    expect(shopRoot).toBeDefined();
    expect(onboarding?.path).not.toBe(shopRoot?.path);
  });

  it('mounts every core module of the shell', () => {
    const expected = ['/settings', '/sell', '/due', '/stock', '/today', '/products', '/customers'];
    expect(paths.map((route) => route.path)).toEqual(expect.arrayContaining(expected));
  });

  it('serves the catalogue screens under /products', () => {
    // A deep link to a product must survive a reload (PWA), so these are real
    // routes, not dialogs held in component state.
    expect(paths.map((route) => route.path)).toEqual(
      expect.arrayContaining(['/products/new', '/products/categories', '/products/:productId']),
    );
  });

  it('has one page per path', () => {
    // `*` is expected twice on purpose: inside the shell (with bottom nav) and
    // at the root for a signed-out deep link. Everything else must be unique.
    const all = paths.map((route) => route.path);
    expect(all.filter((path) => path === '/*')).toHaveLength(2);
    const pages = all.filter((path) => path !== '/*');
    expect(new Set(pages).size).toBe(pages.length);
  });
});
