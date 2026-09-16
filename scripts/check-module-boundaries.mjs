#!/usr/bin/env node
// Governance gate (invariant A1): a module may import another module ONLY via its public
// index.ts, and only where an allowed dependency exists. Deep imports into another module's
// internals fail the build. This is the modular-monolith boundary made mechanical.
//
// Allowed cross-module dependencies are declared below. Anything else is a violation.
// Usage: node scripts/check-module-boundaries.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODULES_DIR = resolve(root, 'apps/web/src/modules');

// Published anchors every module may depend on (the OHS-style shared surfaces).
const ANCHORS = new Set(['identity']);

// Declared allowed dependencies: module -> modules it may import (via their index only).
// Reflects the read relationships in the Blueprint context map (kept deliberately tight).
const ALLOWED = {
  activation: ['identity', 'twin', 'knowledge'],
  twin: ['identity'],
  blueprint: ['identity', 'twin', 'readiness', 'knowledge'],
  readiness: ['identity', 'twin', 'planner', 'outcome', 'knowledge'],
  planner: ['identity', 'blueprint'],
  outcome: ['identity'],
  coach: ['identity', 'twin', 'blueprint', 'planner', 'knowledge', 'outcome'],
  knowledge: ['identity'],
  feedback: ['identity'],
  identity: [],
  // Free CareerDiya surface (not part of the CareerAsana paid contract) — auth comes from
  // apps/web/middleware.ts + @/lib/supabase/server, not the identity module, so no
  // cross-module dependency is needed today. Named 'careerdiya' (no hyphen), not
  // 'career-diya' — moduleRefRe below only matches [a-z]+, so a hyphenated module name
  // would be silently truncated to 'career' and this check would stop meaning anything
  // for it.
  careerdiya: [],
};

const modules = readdirSync(MODULES_DIR).filter((d) => statSync(join(MODULES_DIR, d)).isDirectory());
const walk = (dir) =>
  readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') || p.endsWith('.tsx') ? [p] : [];
  });

const importRe = /from\s+['"]([^'"]+)['"]/g;
const moduleRefRe = /modules\/([a-z]+)(\/[^'"]+)?/;

let violations = 0;
for (const mod of modules) {
  const allowed = new Set([...(ALLOWED[mod] ?? []), ...ANCHORS, mod]);
  for (const file of walk(join(MODULES_DIR, mod))) {
    const src = readFileSync(file, 'utf8');
    for (const [, spec] of src.matchAll(importRe)) {
      const m = spec.match(moduleRefRe);
      if (!m) continue;
      const target = m[1];
      const subpath = m[2]; // anything after the module name
      const rel = file.replace(root + '/', '');
      if (target === mod) continue;
      if (!allowed.has(target)) {
        console.error(`✗ ${rel}\n    illegal dependency: '${mod}' imports '${target}' (not in allowed list)`);
        violations++;
      } else if (subpath && !/^\/index(\.ts)?$/.test(subpath)) {
        console.error(`✗ ${rel}\n    deep import into '${target}${subpath}'; use '${target}' public index only`);
        violations++;
      }
    }
  }
}

if (violations) {
  console.error(`\nModule-boundary check FAILED: ${violations} violation(s) of invariant A1.`);
  process.exit(1);
}
console.log(`Module-boundary check OK — ${modules.length} modules, boundaries intact.`);
