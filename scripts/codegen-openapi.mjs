#!/usr/bin/env node
// Generates TypeScript types from the FROZEN OpenAPI contract into packages/api-types.
// The contract is the source of truth; types are derived, never hand-edited.
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const input = resolve(root, 'contracts/careerasana_openapi_v1.yaml');
const output = resolve(root, 'packages/api-types/generated/generated.ts');
console.log('Generating API types from frozen contract…');
execSync(`pnpm exec openapi-typescript ${input} -o ${output}`, { stdio: 'inherit', cwd: root });
console.log(`Wrote ${output}`);
