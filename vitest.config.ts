import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

// Separate config so test-only settings do not leak into the production build.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
    },
  }),
);
