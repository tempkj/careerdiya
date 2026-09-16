#!/usr/bin/env node
// Phase 1 — Substrate generation.
// Reads seed-roles.json, calls AI for each role, validates, writes to generated/.
// Does NOT touch the database. Run commit.mjs after human review.
//
// Usage: pnpm substrate:generate
// Requires: ANTHROPIC_API_KEY in environment (set AI_MODE=live or it exits early)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAndSanitise } from './validate.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const SEED_FILE      = resolve(__dir, 'seed-roles.json');
const GENERATED_DIR  = resolve(__dir, 'generated');
const FAILURES_DIR   = resolve(__dir, 'generated/_failures');
const MODEL          = process.env.AI_DEFAULT_MODEL ?? 'claude-sonnet-4-6';
const ANTHROPIC_URL  = 'https://api.anthropic.com/v1/messages';

// ── Safety guard ───────────────────────────────────────────────────────────────

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY is not set. This script makes live AI calls.');
  process.exit(1);
}

// ── Setup ─────────────────────────────────────────────────────────────────────

mkdirSync(GENERATED_DIR, { recursive: true });
mkdirSync(FAILURES_DIR,  { recursive: true });

const seeds = JSON.parse(readFileSync(SEED_FILE, 'utf8'));

// ── Prompt ────────────────────────────────────────────────────────────────────

function buildPrompt(role) {
  return `Generate a substrate for this role: "${role.display_name}"
Region: India (IN)

Return exactly this JSON shape — no prose, no markdown fences, no extra keys:
{
  "skills": [
    {
      "name": "skill name (concise, lowercase preferred)",
      "canonical_name": "optional longer form",
      "proficiency": "awareness|working|expert",
      "criticality": "required|preferred|differentiating",
      "basis": "inferred"
    }
  ],
  "market": {
    "demand_signal": "high|moderate|low",
    "demand_basis": "AI-inferred, India market, no live signal",
    "typical_yoe_range": [min, max],
    "common_entry_paths": ["path description"]
  },
  "adjacent_roles": [
    { "role_key": "normalized lowercase role name", "direction": "lateral|step_up|step_down" }
  ]
}

Rules:
- skills: 6–12 entries covering the role comprehensively for India hiring context in 2025–2026
- proficiency: "awareness" = knows it exists; "working" = applies independently; "expert" = teaches or architects
- criticality: "required" = gatekeeping (filters candidates); "preferred" = differentiates; "differentiating" = top-10% marker
- basis: always exactly "inferred" — this is model knowledge, not verified data
- demand_signal: realistic for India market 2025–2026 (not aspirational)
- demand_basis: always exactly "AI-inferred, India market, no live signal"
- typical_yoe_range: [min, max] integer years for entry to this role in India
- common_entry_paths: 2–4 realistic India-specific transition paths (e.g. "cs degree → swe", "ca → financial analyst")
- adjacent_roles: 2–4 roles; role_key must be lowercase normalized (e.g. "data analyst" not "Data Analyst")
- Do NOT include onet_code or onet_skill_id — omit those fields entirely`;
}

// ── Generation loop ───────────────────────────────────────────────────────────

const results = { generated: [], failed: [] };
const seedRoleKeys = new Set(seeds.map((r) => r.role_key));
const unknownAdjacencies = new Map(); // role_key → count (seed-expansion signal)

for (const role of seeds) {
  const label = role.role_key;
  process.stdout.write(`  generating: ${label} … `);

  let raw;
  try {
    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system:
          'You are a career intelligence engine specialising in the Indian labour market. ' +
          'Generate structured role substrates. Return ONLY valid JSON — no prose, no markdown fences.',
        messages: [{ role: 'user', content: buildPrompt(role) }],
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`HTTP ${resp.status}: ${body}`);
    }

    const data = await resp.json();
    const text = data.content?.[0]?.type === 'text' ? data.content[0].text : '';
    // Strip markdown fences if the model adds them despite instructions
    const jsonText = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```\s*$/m, '').trim();
    raw = JSON.parse(jsonText);
  } catch (err) {
    const failPath = resolve(FAILURES_DIR, `${label.replace(/\s+/g, '-')}.json`);
    writeFileSync(failPath, JSON.stringify({ role_key: label, error: String(err), raw_output: null }, null, 2));
    console.log(`✗ (API/parse error: ${err.message})`);
    results.failed.push({ role_key: label, reason: 'api_or_parse_error', error: String(err) });
    continue;
  }

  const { valid, payload, errors } = validateAndSanitise(raw);

  if (!valid) {
    const failPath = resolve(FAILURES_DIR, `${label.replace(/\s+/g, '-')}.json`);
    writeFileSync(failPath, JSON.stringify({ role_key: label, validation_errors: errors, raw_output: raw }, null, 2));
    console.log(`✗ (validation: ${errors.join('; ')})`);
    results.failed.push({ role_key: label, reason: 'validation_failed', errors });
    continue;
  }

  // Track adjacent_roles that aren't in the seed list (seed-expansion signal)
  for (const adj of payload.adjacent_roles ?? []) {
    if (!seedRoleKeys.has(adj.role_key)) {
      unknownAdjacencies.set(adj.role_key, (unknownAdjacencies.get(adj.role_key) ?? 0) + 1);
    }
  }

  const artifact = {
    role_key:       role.role_key,
    display_name:   role.display_name,
    onet_code:      role.onet_code ?? null,  // from seed only, never from model
    region:         role.region,
    generated_at:   new Date().toISOString(),
    model:          MODEL,
    payload,
  };

  const outPath = resolve(GENERATED_DIR, `${label.replace(/\s+/g, '-')}.json`);
  writeFileSync(outPath, JSON.stringify(artifact, null, 2));
  console.log('✓');
  results.generated.push(label);
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n── Summary ─────────────────────────────────────────`);
console.log(`  Generated: ${results.generated.length} / ${seeds.length}`);
console.log(`  Failed:    ${results.failed.length} / ${seeds.length}`);

if (results.failed.length > 0) {
  console.log(`\n  Failures (see generated/_failures/ for raw output):`);
  for (const f of results.failed) {
    console.log(`    ✗ ${f.role_key} — ${f.reason}`);
  }
}

if (unknownAdjacencies.size > 0) {
  const sorted = [...unknownAdjacencies.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`\n── Seed expansion signal ───────────────────────────`);
  console.log(`  Adjacent roles referenced but not in seed list`);
  console.log(`  (frequency = how many substrates point to this role):`);
  for (const [key, count] of sorted) {
    console.log(`    ${count}x  ${key}`);
  }
  console.log(`\n  Add high-frequency entries to seed-roles.json to expand coverage.`);
}

console.log(`\n  Review generated/ before running pnpm substrate:commit`);
