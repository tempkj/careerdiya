#!/usr/bin/env node
// Phase 2 — Substrate commit.
// Reads generated/*.json (after human review), validates, upserts to knowledge.role_substrate.
// Run AFTER pnpm substrate:generate and after reviewing generated/.
//
// Usage: pnpm substrate:commit
// Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment
// Uses service role key — this is an operational script, not a request path (A5 not violated).

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAndSanitise } from './validate.mjs';

const __dir       = dirname(fileURLToPath(import.meta.url));
const GENERATED   = resolve(__dir, 'generated');
const SEED_FILE   = resolve(__dir, 'seed-roles.json');

// ── Safety guards ─────────────────────────────────────────────────────────────

if (!process.env.SUPABASE_URL) {
  console.error('ERROR: SUPABASE_URL is not set.');
  process.exit(1);
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY is not set.');
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL.replace(/\/$/, '');
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 90-day expiry (fix 2): ai_generated substrates are eventually-due, not immortal.
// Staleness audit (§5.2) needs a visible valid_until to surface rows needing refresh.
const VALID_UNTIL = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

// ── Load seed for adjacency cross-reference ───────────────────────────────────

const seeds = JSON.parse(readFileSync(SEED_FILE, 'utf8'));
const seedRoleKeys = new Set(seeds.map((r) => r.role_key));

// ── Collect generated artifact files ─────────────────────────────────────────

let files;
try {
  files = readdirSync(GENERATED).filter(
    (f) => f.endsWith('.json') && !f.startsWith('_'),
  );
} catch {
  console.error(`ERROR: generated/ directory not found at ${GENERATED}`);
  console.error('Run pnpm substrate:generate first.');
  process.exit(1);
}

if (files.length === 0) {
  console.log('No artifact files found in generated/. Run pnpm substrate:generate first.');
  process.exit(0);
}

console.log(`Found ${files.length} artifact(s) to commit.\n`);

// ── Upsert via Supabase REST (knowledge schema) ───────────────────────────────

async function upsertRow(row) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/role_substrate`, {
    method: 'POST',
    headers: {
      apikey:            SERVICE_KEY,
      Authorization:     `Bearer ${SERVICE_KEY}`,
      'Content-Type':    'application/json',
      'Content-Profile': 'knowledge',
      'Accept-Profile':  'knowledge',
      Prefer:            'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify([row]),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${body}`);
  }
}

// ── Commit loop ───────────────────────────────────────────────────────────────

const results   = { committed: [], skipped: [] };
const unknownAdjacencies = new Map(); // seed-expansion signal (fix 3)

for (const file of files) {
  const filePath = resolve(GENERATED, file);
  const roleName = basename(file, '.json');
  process.stdout.write(`  committing: ${roleName} … `);

  let artifact;
  try {
    artifact = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.log(`✗ (cannot parse file: ${err.message})`);
    results.skipped.push({ file, reason: 'parse_error' });
    continue;
  }

  // Re-validate after human review (humans may have edited the file)
  const { valid, payload, errors } = validateAndSanitise(artifact.payload);
  if (!valid) {
    console.log(`✗ (invalid payload: ${errors.join('; ')})`);
    results.skipped.push({ file, reason: 'validation_failed', errors });
    continue;
  }

  // Track adjacency references not in the seed list (fix 3: aggregate, don't just log)
  for (const adj of payload.adjacent_roles ?? []) {
    if (!seedRoleKeys.has(adj.role_key)) {
      unknownAdjacencies.set(adj.role_key, (unknownAdjacencies.get(adj.role_key) ?? 0) + 1);
    }
  }

  const row = {
    role_key:       artifact.role_key,
    region:         artifact.region ?? 'IN',
    onet_code:      artifact.onet_code ?? null,   // always from seed, never from model payload
    payload,
    basis:          'inferred',
    source:         'ai_generated',
    schema_version: 'substrate/v1',
    computed_at:    artifact.generated_at ?? new Date().toISOString(),
    valid_until:    VALID_UNTIL,
  };

  try {
    await upsertRow(row);
    console.log('✓');
    results.committed.push(artifact.role_key);
  } catch (err) {
    console.log(`✗ (upsert failed: ${err.message})`);
    results.skipped.push({ file, reason: 'upsert_failed', error: String(err) });
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n── Summary ─────────────────────────────────────────`);
console.log(`  Committed: ${results.committed.length} / ${files.length}`);
console.log(`  Skipped:   ${results.skipped.length} / ${files.length}`);
console.log(`  valid_until set to: ${VALID_UNTIL}`);

if (results.skipped.length > 0) {
  console.log(`\n  Skipped:`);
  for (const s of results.skipped) {
    const detail = s.errors ? s.errors.join('; ') : (s.error ?? s.reason);
    console.log(`    ✗ ${s.file} — ${detail}`);
  }
}

if (unknownAdjacencies.size > 0) {
  const sorted = [...unknownAdjacencies.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`\n── Seed expansion signal ───────────────────────────`);
  console.log(`  Adjacent roles written to DB but not in seed list`);
  console.log(`  (frequency = how many substrates reference this role):`);
  for (const [key, count] of sorted) {
    console.log(`    ${count}x  ${key}`);
  }
  console.log(`\n  Add high-frequency entries to seed-roles.json for next generation run.`);
}
