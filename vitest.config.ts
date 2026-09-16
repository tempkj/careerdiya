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
    include: ['tests/**/*.spec.ts', 'apps/**/*.test.ts', 'packages/**/*.test.ts'],
    environment: 'node',
  },
});
