#!/usr/bin/env node
// Governance gate: every enum in the frozen OpenAPI contract must exactly match the
// DB-side controlled vocabulary (packages/db/vocab.json, from Database Design Spec v1.3 §6.6).
// This is the single most drift-prone seam between API and DB. CI fails on any mismatch.
//
// Usage: node scripts/check-enum-parity.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import yaml from 'js-yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const spec = yaml.load(readFileSync(resolve(root, 'contracts/careerasana_openapi_v1.yaml'), 'utf8'));
const { vocab, _apiEnumMap: map } = JSON.parse(
  readFileSync(resolve(root, 'packages/db/vocab.json'), 'utf8'),
);

const norm = (a) => [...a].map(String).sort();
const eq = (a, b) => a.length === b.length && norm(a).every((v, i) => v === norm(b)[i]);

let failures = 0;
for (const [dbKey, apiPath] of Object.entries(map).filter(([k]) => !k.startsWith('_'))) {
  const [schema, , prop] = [apiPath.split('.')[0], 'properties', apiPath.split('.')[1]];
  const apiEnum = spec?.components?.schemas?.[schema]?.properties?.[prop]?.enum;
  const dbEnum = vocab[dbKey];
  if (!apiEnum) {
    console.error(`✗ ${apiPath}: enum not found in OpenAPI`);
    failures++;
    continue;
  }
  if (!eq(apiEnum, dbEnum)) {
    console.error(`✗ DRIFT ${dbKey} ↔ ${apiPath}\n    DB : ${JSON.stringify(dbEnum)}\n    API: ${JSON.stringify(apiEnum)}`);
    failures++;
  } else {
    console.log(`✓ ${dbKey} ↔ ${apiPath}`);
  }
}

if (failures) {
  console.error(`\nEnum parity FAILED: ${failures} mismatch(es). API and DB v1.3 have drifted.`);
  process.exit(1);
}
console.log('\nEnum parity OK — API contract matches DB vocab v1.3.');
