import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TextBlock } from '@anthropic-ai/sdk/resources/messages';
import { AI_MODE, getAnthropicClient } from '@/lib/ai';
import type {
  SubstratePayloadV1,
  RoleSubstrate,
  GeneratedSubstrate,
  SubstrateGenerator,
} from '../domain/types';
import { validateAndRepairSubstrate } from './substrateValidation';

// ── Normalization ──────────────────────────────────────────────────────────────

export function normalizeRoleKey(desiredRole: string): string {
  return desiredRole.trim().toLowerCase();
}

// ── Mock fixtures ──────────────────────────────────────────────────────────────

const DEFAULT_FIXTURE: SubstratePayloadV1 = {
  skills: [
    { name: 'domain knowledge', proficiency: 'working', criticality: 'required', basis: 'inferred' },
    { name: 'communication', proficiency: 'working', criticality: 'required', basis: 'inferred' },
    { name: 'problem solving', proficiency: 'working', criticality: 'preferred', basis: 'inferred' },
  ],
  market: {
    demand_signal: 'moderate',
    demand_basis: 'AI-inferred, no live signal',
  },
};

const MOCK_FIXTURES: Record<string, SubstratePayloadV1> = {
  'product manager': {
    skills: [
      { name: 'product strategy', proficiency: 'expert', criticality: 'required', basis: 'inferred' },
      { name: 'stakeholder management', proficiency: 'working', criticality: 'required', basis: 'inferred' },
      { name: 'data analysis', proficiency: 'working', criticality: 'required', basis: 'inferred' },
      { name: 'roadmap planning', proficiency: 'working', criticality: 'required', basis: 'inferred' },
      { name: 'user research', proficiency: 'awareness', criticality: 'preferred', basis: 'inferred' },
    ],
    market: {
      demand_signal: 'high',
      demand_basis: 'AI-inferred, no live signal',
      typical_yoe_range: [3, 7],
      common_entry_paths: ['software engineer → pm', 'mba → pm', 'analyst → pm'],
    },
    adjacent_roles: [
      { role_key: 'software engineer', direction: 'lateral' },
      { role_key: 'senior product manager', direction: 'step_up' },
      { role_key: 'business analyst', direction: 'lateral' },
    ],
  },

  'data scientist': {
    skills: [
      { name: 'python', proficiency: 'expert', criticality: 'required', basis: 'inferred' },
      { name: 'machine learning', proficiency: 'working', criticality: 'required', basis: 'inferred' },
      { name: 'sql', proficiency: 'working', criticality: 'required', basis: 'inferred' },
      { name: 'statistics', proficiency: 'expert', criticality: 'required', basis: 'inferred' },
      { name: 'data visualisation', proficiency: 'awareness', criticality: 'preferred', basis: 'inferred' },
    ],
    market: {
      demand_signal: 'high',
      demand_basis: 'AI-inferred, no live signal',
      typical_yoe_range: [2, 6],
      common_entry_paths: ['analyst → ds', 'msc statistics → ds', 'software engineer → ds'],
    },
    adjacent_roles: [
      { role_key: 'data analyst', direction: 'step_down' },
      { role_key: 'ml engineer', direction: 'lateral' },
      { role_key: 'ai researcher', direction: 'step_up' },
    ],
  },

  'ux designer': {
    skills: [
      { name: 'figma', proficiency: 'expert', criticality: 'required', basis: 'inferred' },
      { name: 'user research', proficiency: 'working', criticality: 'required', basis: 'inferred' },
      { name: 'interaction design', proficiency: 'working', criticality: 'required', basis: 'inferred' },
      { name: 'design systems', proficiency: 'awareness', criticality: 'preferred', basis: 'inferred' },
      { name: 'prototyping', proficiency: 'working', criticality: 'required', basis: 'inferred' },
    ],
    market: {
      demand_signal: 'moderate',
      demand_basis: 'AI-inferred, no live signal',
      typical_yoe_range: [2, 5],
      common_entry_paths: ['graphic designer → ux', 'self-taught portfolio → ux'],
    },
    adjacent_roles: [
      { role_key: 'product designer', direction: 'lateral' },
      { role_key: 'ui developer', direction: 'lateral' },
      { role_key: 'design lead', direction: 'step_up' },
    ],
  },

  'software engineer': {
    skills: [
      { name: 'data structures and algorithms', proficiency: 'working', criticality: 'required', basis: 'inferred' },
      { name: 'system design', proficiency: 'awareness', criticality: 'preferred', basis: 'inferred' },
      { name: 'version control (git)', proficiency: 'working', criticality: 'required', basis: 'inferred' },
      { name: 'testing and debugging', proficiency: 'working', criticality: 'required', basis: 'inferred' },
      { name: 'cloud fundamentals', proficiency: 'awareness', criticality: 'preferred', basis: 'inferred' },
    ],
    market: {
      demand_signal: 'high',
      demand_basis: 'AI-inferred, no live signal',
      typical_yoe_range: [0, 4],
      common_entry_paths: ['bootcamp → swe', 'cs degree → swe', 'self-taught → swe'],
    },
    adjacent_roles: [
      { role_key: 'product manager', direction: 'lateral' },
      { role_key: 'senior software engineer', direction: 'step_up' },
      { role_key: 'devops engineer', direction: 'lateral' },
    ],
  },

  // Novel role with no O*NET equivalent — first-class fixture, not a fallback.
  // Validates that the store and TransitionService handle onetCode = null correctly.
  'ai content creator': {
    skills: [
      { name: 'prompt engineering', proficiency: 'working', criticality: 'required', basis: 'inferred' },
      { name: 'content strategy', proficiency: 'working', criticality: 'required', basis: 'inferred' },
      { name: 'ai tool fluency', proficiency: 'expert', criticality: 'required', basis: 'inferred' },
      { name: 'audience analytics', proficiency: 'awareness', criticality: 'preferred', basis: 'inferred' },
    ],
    market: {
      demand_signal: 'high',
      demand_basis: 'AI-inferred, no live signal',
      typical_yoe_range: [0, 3],
      common_entry_paths: ['content creator → ai content creator', 'marketer → ai content creator'],
    },
    adjacent_roles: [
      { role_key: 'content strategist', direction: 'lateral' },
      { role_key: 'ai product manager', direction: 'step_up' },
    ],
  },
};

// ── MockSubstrateGenerator ─────────────────────────────────────────────────────

export class MockSubstrateGenerator implements SubstrateGenerator {
  generate(roleKey: string, _region: string): Promise<GeneratedSubstrate> {
    const payload = MOCK_FIXTURES[roleKey] ?? DEFAULT_FIXTURE;
    return Promise.resolve({
      payload,
      basis: 'inferred' as const,
      source: 'mock' as const,
      onetCode: null, // never set in mock — avoids FK issues; tests the null path first-class
      validUntil: null,
    });
  }
}

// ── LiveSubstrateGenerator ───────────────────────────────────────────────────────
//
// v1 — knowledge-only generation (basis: 'inferred', source: 'ai_generated'), on-demand,
// validated before return. This is the same generate→validate shape the offline
// scripts/substrate/generate.mjs + commit.mjs pipeline used for the 25 seeded roles, moved
// in-request: SubstrateStore.get() persists the result via the caller's own authenticated
// client (migration 027 grants authenticated INSERT for exactly this). O*NET grounding
// (basis: 'grounded', source: 'crawl') is v2 — see planning/Backlog.md.

let _cachedSubstratePromptBody: string | null = null;

function findRepoRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('substrate.ts: could not locate repo root (pnpm-workspace.yaml not found)');
}

function loadSubstrateGenerationPrompt(): string {
  if (_cachedSubstratePromptBody) return _cachedSubstratePromptBody;

  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = findRepoRoot(here);
  const filePath = join(repoRoot, 'packages/prompts/substrate-generation/v1.md');
  const raw = readFileSync(filePath, 'utf-8');

  // Strip the YAML front matter (--- ... ---); the body after it is the system prompt.
  const match = raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  _cachedSubstratePromptBody = (match ? match[1]! : raw).trim();
  return _cachedSubstratePromptBody;
}

// Defensive JSON extraction — mirrors taskIdentifier.ts's parseJsonResponse. The model is
// instructed to return raw JSON only, but may still wrap it in fences or add preamble.
function parseSubstrateJsonResponse(text: string): unknown {
  let candidate = text.trim();

  const fenceMatch = candidate.match(/^```(?:json)?\s*\n([\s\S]*?)\n?```$/);
  if (fenceMatch) candidate = fenceMatch[1]!.trim();

  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidate = candidate.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(candidate);
  } catch (err) {
    throw new Error(
      `LiveSubstrateGenerator: failed to parse model response as JSON — ${
        err instanceof Error ? err.message : String(err)
      }. Raw text (first 500 chars): ${text.slice(0, 500)}`,
    );
  }
}

export class LiveSubstrateGenerator implements SubstrateGenerator {
  async generate(roleKey: string, region: string): Promise<GeneratedSubstrate> {
    const systemPrompt = loadSubstrateGenerationPrompt();

    const response = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Generate a substrate for this role: "${roleKey}"\nRegion: ${region}`,
        },
      ],
    });

    // Fail loud on a missing text block — do NOT index content[0] (the exact bug that
    // silently broke gap analysis when Sonnet returns a leading `thinking` block first;
    // see start.ts's callGapAnalysisModel for the fixed pattern this mirrors).
    const textBlock = response.content.find((block): block is TextBlock => block.type === 'text');
    if (!textBlock) {
      throw new Error('LiveSubstrateGenerator: model response had no text content block');
    }

    const rawOutput = parseSubstrateJsonResponse(textBlock.text);
    const payload: SubstratePayloadV1 = validateAndRepairSubstrate(rawOutput);

    // source: 'ai_generated' + basis: 'inferred' are paired here — this generator is the sole
    // writer of 'ai_generated'; the invariant (ai_generated ⇒ inferred) is enforced at the
    // generator rather than as a DB cross-column CHECK (revisit if a second writer appears).
    // When the crawl pipeline is wired, source becomes 'crawl' and basis becomes 'grounded'.
    // onetCode is always null — v1 is knowledge-only; a real O*NET code would hard-fail the
    // FK against the still-empty knowledge.onet_occupation table (see the O*NET-grounding
    // backlog decision, planned as v2).
    //
    // validUntil: null (permanent) — deliberate, not an oversight. A blanket TTL (e.g. the
    // offline pipeline's 90 days) re-pays to regenerate every substrate on a fixed clock
    // regardless of whether it's actually wrong; roles drift over years, not quarters.
    // Refresh is handled selectively instead, by the backlogged async review queue (see the
    // "Substrate verification — Type 1 vs Type 2" backlog decision) — it corrects specific
    // substrates found to be wrong, rather than everything aging out on a timer.
    return {
      payload,
      basis: 'inferred',
      source: 'ai_generated',
      onetCode: null,
      validUntil: null,
    };
  }
}

// ── DB row → domain mapper ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: Record<string, any>): RoleSubstrate {
  return {
    id: row['id'] as string,
    roleKey: row['role_key'] as string,
    region: row['region'] as string,
    onetCode: (row['onet_code'] as string | null) ?? null,
    payload: row['payload'] as SubstratePayloadV1,
    basis: row['basis'] as 'grounded' | 'inferred',
    source: row['source'] as 'mock' | 'crawl' | 'licensed_feed' | 'ai_generated',
    schemaVersion: row['schema_version'] as string,
    computedAt: row['computed_at'] as string,
    validUntil: (row['valid_until'] as string | null) ?? null,
  };
}

// ── SubstrateStore ─────────────────────────────────────────────────────────────

export class SubstrateStore {
  constructor(
    private readonly client: SupabaseClient,
    private readonly generator: SubstrateGenerator,
  ) {}

  /**
   * Read-only cache lookup used for a user's starting/current role.
   *
   * Current roles arrive from Career Diya as free text and are not required to exist
   * in the shared role_substrate catalogue. A cache miss therefore means "no substrate
   * enrichment available", not "generate a new shared substrate during activation".
   */
  async getCached(desiredRole: string, region = 'IN'): Promise<RoleSubstrate | null> {
    const roleKey = normalizeRoleKey(desiredRole);
    if (!roleKey) return null;

    const { data: row, error } = await (this.client as any)
      .schema('knowledge')
      .from('role_substrate')
      .select('*')
      .eq('role_key', roleKey)
      .eq('region', region)
      .maybeSingle();

    if (error || !row) return null;
    if (row['valid_until'] !== null && new Date(row['valid_until']) <= new Date()) {
      return null;
    }
    return mapRow(row);
  }

  async get(desiredRole: string, region = 'IN'): Promise<RoleSubstrate> {
    const roleKey = normalizeRoleKey(desiredRole);
    if (!roleKey) throw new Error('SubstrateStore: role is required');

    // DB-first: return cached substrate if present and not expired
    const { data: row } = await (this.client as any)
      .schema('knowledge')
      .from('role_substrate')
      .select('*')
      .eq('role_key', roleKey)
      .eq('region', region)
      .maybeSingle();

    if (row && (row['valid_until'] === null || new Date(row['valid_until']) > new Date())) {
      return mapRow(row);
    }

    // Cache miss or stale — generate, then persist only for canonical sources.
    // Mock content is never persisted: mock stubs are ephemeral dev fixtures, not canonical data.
    // Persisting them would (a) pollute the shared DB with stub content, and (b) permanently block
    // future live generation for the same role because valid_until=null makes a mock row serve forever.
    const generated = await this.generator.generate(roleKey, region);

    if (generated.source === 'mock') {
      return {
        id: '', // ephemeral — never persisted, no DB identity
        roleKey,
        region,
        onetCode: generated.onetCode,
        payload: generated.payload,
        basis: generated.basis,
        source: generated.source,
        schemaVersion: 'substrate/v1',
        computedAt: new Date().toISOString(),
        validUntil: generated.validUntil,
      };
    }

    // ignoreDuplicates: true → ON CONFLICT DO NOTHING, not DO UPDATE. Required, not optional:
    // without it, Postgres must be able to plan the UPDATE arm even on a non-conflicting
    // insert, which needs UPDATE privilege — but authenticated deliberately has INSERT only
    // (migration 027; substrates are write-once). Same pattern as IdentificationCacheStore/
    // GapAnalysisCacheStore's writes.
    const { data: upserted, error } = await (this.client as any)
      .schema('knowledge')
      .from('role_substrate')
      .upsert(
        {
          role_key: roleKey,
          region,
          onet_code: generated.onetCode,
          payload: generated.payload,
          basis: generated.basis,
          source: generated.source,
          schema_version: 'substrate/v1',
          computed_at: new Date().toISOString(),
          valid_until: generated.validUntil,
        },
        { onConflict: 'role_key,region', ignoreDuplicates: true },
      )
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`SubstrateStore: upsert failed — ${error.message}`);

    if (upserted) return mapRow(upserted);

    // DO NOTHING means a genuine failure here is silent, not thrown — the conflict target
    // (role_key, region) already had a row (a concurrent writer raced us, or the row we read
    // as "expired" above is still the only one that exists). Either way a row now exists;
    // re-read and serve it rather than erroring on a benign race. A currently-expired row
    // served this way will simply be re-attempted on the next request — refreshing a stale
    // ai_generated row is a worker/background-job concern (see the Twin-recompute-worker
    // backlog precedent), not something an authenticated request needs to force inline.
    const { data: reread, error: rereadError } = await (this.client as any)
      .schema('knowledge')
      .from('role_substrate')
      .select('*')
      .eq('role_key', roleKey)
      .eq('region', region)
      .maybeSingle();

    if (rereadError || !reread) {
      throw new Error(`SubstrateStore: upsert conflicted but re-read found no row — ${rereadError?.message}`);
    }
    return mapRow(reread);
  }
}

// ── Factory — picks generator from AI_MODE ─────────────────────────────────────

export function createSubstrateStore(client: SupabaseClient): SubstrateStore {
  const generator = AI_MODE === 'mock' ? new MockSubstrateGenerator() : new LiveSubstrateGenerator();
  return new SubstrateStore(client, generator);
}
