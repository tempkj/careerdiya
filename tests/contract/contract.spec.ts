import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';

// Load the frozen contract once. As endpoints come online (Phase 0+), each gets a
// conformance test here. This stub asserts the contract is present and well-formed so
// the harness is wired into CI from day one (handbook §2).
const spec = yaml.load(
  readFileSync(resolve(__dirname, '../../contracts/careerasana_openapi_v1.yaml'), 'utf8'),
) as { openapi: string; paths: Record<string, unknown> };

describe('contract harness', () => {
  it('loads the frozen OpenAPI 3.1 contract', () => {
    expect(spec.openapi).toBe('3.1.0');
    expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
  });

  it('encodes the no-direct-twin-write invariant (no PUT /twin)', () => {
    const twin = spec.paths['/twin'] as Record<string, unknown> | undefined;
    expect(twin?.put).toBeUndefined();
  });

  // TODO(phase-0+): per-operation conformance tests against a live Supabase instance:
  //   activation → twin signal → twin → readiness, plus negative RLS + jobs poll loop.
});
