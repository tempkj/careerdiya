// Flat ESLint config (ESLint 9+). Module-boundary enforcement is additionally
// performed by scripts/check-module-boundaries.mjs in CI (invariant A1), because it
// reasons about the cross-module import graph beyond what a single rule expresses.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/.next/**', '**/dist/**', '**/coverage/**', 'packages/api-types/generated/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // Modules must import each other only through their published index, never internals.
              group: ['**/modules/*/!(index)', '**/modules/*/!(index).*'],
              message:
                'Import other modules only via their public index.ts (invariant A1). Internals are private.',
            },
          ],
        },
      ],
    },
  },
);
