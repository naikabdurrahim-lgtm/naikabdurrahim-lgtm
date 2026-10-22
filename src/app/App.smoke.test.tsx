import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import '@/lib/i18n';
import { App } from './App';

/**
 * Smoke test: the whole shell must render without throwing (providers, router,
 * i18n, preferences). Catches the "white screen" class of bug in CI.
 */
describe('App shell', () => {
  it('renders the Bangla home screen', () => {
    const html = renderToString(<App />);

    expect(html).toContain('দোকান বন্ধু');
    expect(html).toContain('বিক্রি');
    expect(html).toContain('বাকি');
    expect(html).toContain('স্টক');
  });
});
