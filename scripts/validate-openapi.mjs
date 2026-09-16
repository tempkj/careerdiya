#!/usr/bin/env node
// Lightweight structural validation of the frozen OpenAPI contract: parses, checks
// version, resolves every internal $ref, asserts unique operationIds + responses.
// A full `openapi-spec-validator`/Spectral pass also runs in CI (contract:lint).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import yaml from 'js-yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const raw = readFileSync(resolve(root, 'contracts/careerasana_openapi_v1.yaml'), 'utf8');
const doc = yaml.load(raw);

let errors = 0;
const fail = (m) => { console.error('✗ ' + m); errors++; };

if (doc.openapi !== '3.1.0') fail(`openapi must be 3.1.0 (got ${doc.openapi})`);
if (!doc.info?.version) fail('info.version missing');

const defined = new Set();
for (const sect of ['schemas', 'parameters', 'responses', 'headers', 'securitySchemes']) {
  for (const k of Object.keys(doc.components?.[sect] ?? {})) defined.add(`#/components/${sect}/${k}`);
}
for (const ref of raw.match(/\$ref:\s*['"]?([^'"\n]+)['"]?/g) ?? []) {
  const target = ref.replace(/\$ref:\s*['"]?/, '').replace(/['"]$/, '').trim();
  if (target.startsWith('#/components/') && !defined.has(target)) fail(`unresolved $ref ${target}`);
}

const ops = [];
for (const [, item] of Object.entries(doc.paths ?? {})) {
  for (const [method, op] of Object.entries(item)) {
    if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
    if (op.operationId) ops.push(op.operationId);
    if (!op.responses) fail(`${method} operation missing responses`);
  }
}
const dupes = ops.filter((o, i) => ops.indexOf(o) !== i);
if (dupes.length) fail(`duplicate operationIds: ${[...new Set(dupes)].join(', ')}`);

if (errors) { console.error(`\nOpenAPI validation FAILED (${errors}).`); process.exit(1); }
console.log(`OpenAPI OK — ${doc.info.version}, ${Object.keys(doc.paths).length} paths, ${ops.length} operations, refs resolve.`);
