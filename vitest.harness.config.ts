// Separate config for scratch dev harnesses that make real API calls / real spend —
// deliberately NOT the root vitest.config.ts, so `pnpm test` / CI never picks these up.
// Run explicitly: pnpm exec vitest run --config vitest.harness.config.ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@modules': resolve(__dirname, 'apps/web/src/modules'),
      '@/lib': resolve(__dirname, 'apps/web/src/lib'),
    },
  },
  test: {
    include: ['scripts/**/*.harness.ts'],
    environment: 'node',
    testTimeout: 120_000, // real model calls can be slow
    hookTimeout: 60_000,
  },
});
