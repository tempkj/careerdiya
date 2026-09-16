import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TextBlock } from '@anthropic-ai/sdk/resources/messages';
import { AI_MODE, getAnthropicClient, AI_MODEL } from '@/lib/ai';
import { SubstrateStore, computeTransition, normalizeRoleKey } from '@modules/knowledge';
import type { TransitionDelta } from '@modules/knowledge';
import type {
  ActivationInput,
  ActivationResult,
  AdjacentRoleSuggestion,
  GapItem,
  JourneyEntry,
} from '../domain/types';
import {
  GAP_ANALYSIS_PROMPT_VERSION,
  computeGapAnalysisCacheKeyHash,
  validateAndRepairGapAnalysis,
  GapAnalysisCacheStore,
} from './gapAnalysisCache';

export interface AIActivationResult {
  desiredPosition: { role: string; onetCode: string | null };
  currentTopSkills: string[];
  gap: GapItem[];
  firstAction: string;
}

function mockActivationAI(
  input: ActivationInput,
  transition?: TransitionDelta,
): AIActivationResult {
  const requestedRole = input.desiredRole.trim();
  const r = requestedRole.toLowerCase();

  // Mock mode must preserve the user's actual destination. The old implementation
  // classified every role containing "engineer"/"developer" as Software Engineer,
  // which meant e.g. "Renewable Energy Engineering" silently produced a Software
  // Engineer result and Software Engineer gap skills. That is unacceptable for a
  // Career Diya handoff because the selected Career Library career is authoritative.
  const isDesign = /design|ux|\bui\b/.test(r);
  const isData = /\bdata\b|analyst|scientist|analytics/.test(r);
  const isProduct = /product manager|product management/.test(r);
  const isSoftware = /software engineer|software engineering/.test(r);

  if (isDesign) {
    return {
      desiredPosition: { role: requestedRole, onetCode: null },
      currentTopSkills: transition?.transferable.slice(0, 3).map((s) => s.name) ?? ['collaboration', 'communication', 'problem-solving'],
      gap: [
        { skill: 'Figma / design tooling', have: false, confidence: { value: 0.80, basis: 'inferred' } },
        { skill: 'user research methods', have: false, confidence: { value: 0.70, basis: 'inferred' } },
        { skill: 'design systems', have: false, confidence: { value: 0.65, basis: 'inferred' } },
      ],
      firstAction: `Find three ${requestedRole} job postings and list the design tools each requires.`,
    };
  }

  if (isData) {
    return {
      desiredPosition: { role: requestedRole, onetCode: null },
      currentTopSkills: transition?.transferable.slice(0, 3).map((s) => s.name) ?? ['analytical thinking', 'statistics', 'problem-solving'],
      gap: [
        { skill: 'Python / pandas / scikit-learn', have: false, confidence: { value: 0.75, basis: 'inferred' } },
        { skill: 'machine learning fundamentals', have: false, confidence: { value: 0.70, basis: 'inferred' } },
        { skill: 'SQL for analytics', have: false, confidence: { value: 0.60, basis: 'inferred' } },
      ],
      firstAction: `Complete one beginner project that demonstrates a core skill used in ${requestedRole}.`,
    };
  }

  if (isProduct) {
    return {
      desiredPosition: { role: requestedRole, onetCode: null },
      currentTopSkills: transition?.transferable.slice(0, 3).map((s) => s.name) ?? ['communication', 'stakeholder management', 'problem-solving'],
      gap: [
        { skill: 'product strategy', have: false, confidence: { value: 0.75, basis: 'inferred' } },
        { skill: 'stakeholder management', have: false, confidence: { value: 0.65, basis: 'inferred' } },
        { skill: 'roadmap planning', have: false, confidence: { value: 0.60, basis: 'inferred' } },
      ],
      firstAction: `Review three ${requestedRole} job postings and extract their most common requirements.`,
    };
  }

  if (isSoftware) {
    return {
      desiredPosition: { role: requestedRole, onetCode: null },
      currentTopSkills: transition?.transferable.slice(0, 3).map((s) => s.name) ?? ['logical reasoning', 'attention to detail', 'communication'],
      gap: [
        { skill: 'data structures & algorithms', have: false, confidence: { value: 0.80, basis: 'inferred' } },
        { skill: 'system design fundamentals', have: false, confidence: { value: 0.65, basis: 'inferred' } },
        { skill: 'version control (Git)', have: false, confidence: { value: 0.55, basis: 'inferred' } },
      ],
      firstAction: `Solve one beginner coding problem in the language you plan to use as a ${requestedRole}.`,
    };
  }

  // For other destinations, use the computed transition when available. This keeps
  // the mock path grounded in the selected destination substrate instead of mapping
  // unrelated roles to Software Engineer.
  const transitionGap = [
    ...(transition?.netNew ?? []),
    ...(transition?.upskill ?? []),
  ]
    .filter((s) => s.criticality === 'required')
    .slice(0, 5)
    .map((s) => ({
      skill: s.name,
      have: false,
      confidence: { value: s.basis === 'grounded' ? 0.85 : 0.65, basis: s.basis } as const,
    }));

  return {
    desiredPosition: { role: requestedRole, onetCode: null },
    currentTopSkills:
      transition?.transferable.slice(0, 3).map((s) => s.name) ??
      ['communication', 'problem-solving', 'adaptability'],
    gap: transitionGap.length > 0
      ? transitionGap
      : [
          { skill: `${requestedRole} domain knowledge`, have: false, confidence: { value: 0.60, basis: 'inferred' } },
          { skill: `${requestedRole} technical requirements`, have: false, confidence: { value: 0.55, basis: 'inferred' } },
          { skill: 'portfolio / proof of work', have: false, confidence: { value: 0.50, basis: 'inferred' } },
        ],
    firstAction: `Review three ${requestedRole} job postings and note the three most-common required skills.`,
  };
}

// Raw model call + JSON parse only — no field defaulting/coercion. That's
// validateAndRepairGapAnalysis's job (gapAnalysisCache.ts), same split as
// LiveTaskIdentifier's callTaskIdentificationModel / validateAndRepairAssessment.
async function callGapAnalysisModel(input: ActivationInput, transition?: TransitionDelta): Promise<unknown> {
  const transitionContext = transition
    ? `\nRole transition intelligence (substrate analysis):\n` +
      `- Transferable (at or above required depth): ${transition.transferable.map((s) => s.name).join(', ') || 'none'}\n` +
      `- Need depth increase: ${transition.upskill.map((s) => `${s.name} (${s.currentProficiency}→${s.proficiency})`).join(', ') || 'none'}\n` +
      `- Must acquire from scratch: ${transition.netNew.map((s) => s.name).join(', ') || 'none'}\n` +
      `- Estimated transition difficulty: ${transition.difficulty}\n` +
      `\nGround your gap[] in the above. Required netNew and required upskill take priority.\n`
    : '';

  const msg = await getAnthropicClient().messages.create({
    model: AI_MODEL,
    max_tokens: 1024,
    system:
      'You are a career intelligence engine. Analyse career goals and return a gap analysis. ' +
      'Return ONLY valid JSON — no prose, no markdown fences.',
    messages: [
      {
        role: 'user',
        content: `Current role: ${input.currentRole ?? 'not specified'}
Desired role: ${input.desiredRole}
Weekly hours available: ${input.weeklyHours ?? 'not specified'}
${transitionContext}
Return exactly this JSON shape:
{
  "desiredPosition": { "role": "normalized title", "onetCode": "XX-XXXX.XX or null" },
  "currentTopSkills": ["skill1", "skill2", "skill3"],
  "gap": [
    { "skill": "skill name", "have": false, "confidence": { "value": 0.7, "basis": "inferred" } }
  ],
  "firstAction": "One concrete step completable this week."
}

Rules:
- gap: 3-5 most critical skills to bridge the gap
- have: true when current role strongly implies this skill
- confidence.basis: "stated" (user said it), "inferred" (role-implied), "grounded" (O*NET-verified)
- confidence.value: 0.0–1.0
- firstAction: specific, ≤20 words
- desiredPosition.role: return the desired role exactly as supplied; do not substitute a broader or different role\n- onetCode: best-match O*NET 8-digit code or null`,
      },
    ],
  });

  // A missing text block (e.g. a leading `thinking` block with no text block behind it)
  // must fail loudly — silently defaulting to '{}' produces a 200 that looks like a real,
  // if unimpressive, gap analysis while actually containing nothing. Matches
  // LiveTaskIdentifier's callTaskIdentificationModel (taskIdentifier.ts).
  const textBlock = msg.content.find((block): block is TextBlock => block.type === 'text');
  if (!textBlock) {
    throw new Error('callGapAnalysisModel: model response had no text content block');
  }
  const raw = textBlock.text;
  // Strip optional markdown fences the model might add despite instructions
  const jsonText = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```\s*$/m, '').trim();
  return JSON.parse(jsonText) as unknown;
}

// Orchestrates mock vs. live, and for live: cache-first, model-on-miss, validate,
// write-through. Mirrors LiveTaskIdentifier.identify()'s shape (taskIdentifier.ts) —
// the cache check happens BEFORE the model call, so a hit never spends a token.
async function getGapAnalysis(
  client: SupabaseClient,
  input: ActivationInput,
  transition: TransitionDelta | undefined,
): Promise<AIActivationResult> {
  if (AI_MODE === 'mock' || !process.env.ANTHROPIC_API_KEY) {
    return mockActivationAI(input, transition);
  }

  const fromRoleKey = input.currentRole ? normalizeRoleKey(input.currentRole) : 'none';
  const toRoleKey = normalizeRoleKey(input.desiredRole);
  const keyHash = computeGapAnalysisCacheKeyHash(GAP_ANALYSIS_PROMPT_VERSION, fromRoleKey, toRoleKey);

  const cache = new GapAnalysisCacheStore(client);
  const cached = await cache.get(keyHash);
  if (cached) return cached;

  const rawOutput = await callGapAnalysisModel(input, transition);
  const validated = validateAndRepairGapAnalysis(rawOutput, input.desiredRole, input.desiredRole);

  await cache.put({
    keyHash,
    promptVersion: GAP_ANALYSIS_PROMPT_VERSION,
    fromRoleKey,
    toRoleKey,
    output: validated,
  });

  return validated;
}

// step_down is filtered out here, at the API boundary — see ADR-011 amendment
// (2026-07-24). The underlying domain type keeps step_down (it's still a real
// substrate fact); this suggestion list just never surfaces it to the user.
export function toAdjacentRoleSuggestions(
  adjacentRoles: { role_key: string; direction: 'lateral' | 'step_up' | 'step_down' }[] | undefined,
): AdjacentRoleSuggestion[] {
  if (!adjacentRoles) return [];
  return adjacentRoles
    .filter((r): r is { role_key: string; direction: 'lateral' | 'step_up' } => r.direction !== 'step_down')
    .map((r) => ({ roleKey: r.role_key, direction: r.direction }));
}

export async function startActivation(
  client: SupabaseClient,
  userId: string,
  input: ActivationInput,
  idempotencyKey: string | null,
  substrateStore: SubstrateStore,
): Promise<ActivationResult> {
  if (idempotencyKey) {
    const keyHash = createHash('sha256').update(idempotencyKey).digest('hex');
    const { data: hit } = await (client as any)
      .schema('core')
      .from('idempotency_key')
      .select('response_body')
      .eq('user_id', userId)
      .eq('key_hash', keyHash)
      .eq('endpoint', '/activation/start')
      .maybeSingle();
    if (hit?.response_body) return hit.response_body as ActivationResult;
    await (client as any)
      .schema('core')
      .from('idempotency_key')
      .insert({ user_id: userId, key_hash: keyHash, endpoint: '/activation/start' });
  }

  // The destination is authoritative and must always have a substrate. The starting
  // role is enrichment only: Career Diya can hand us any free-text current/most-recent
  // role, while role_substrate is a shared reference catalogue that may not contain it.
  // Never make a missing starting-role substrate block activation or trigger an inline
  // generation/write for a user-owned request.
  let transition: TransitionDelta | undefined;
  const toSubstrate = await substrateStore.get(input.desiredRole);
  const fromSubstrate = input.currentRole
    ? await substrateStore.getCached(input.currentRole)
    : null;

  if (fromSubstrate) {
    transition = computeTransition(fromSubstrate.payload, toSubstrate.payload, {
      fromRoleKey: normalizeRoleKey(input.currentRole!),
      toRoleKey:   normalizeRoleKey(input.desiredRole),
    });
  }

  const ai = await getGapAnalysis(client, input, transition);
  const now = new Date().toISOString();

  const journey: JourneyEntry[] = [
    { step: 'questions_answered', at: now },
    { step: 'current_position', at: now },
    { step: 'desired_position', at: now },
    { step: 'gap_analysis', at: now },
    { step: 'first_action', at: now },
  ];

  const { data: session, error } = await (client as any)
    .schema('core')
    .from('activation_session')
    .insert({
      user_id: userId,
      current_role: input.currentRole?.trim() || null,
      desired_role: input.desiredRole.trim(),
      onet_code: ai.desiredPosition.onetCode,
      gap: ai.gap,
      first_action: ai.firstAction,
      journey,
    })
    .select('id')
    .single();

  if (error || !session) throw new Error(`Failed to create activation session: ${error?.message}`);

  const adjacentRoles = toAdjacentRoleSuggestions(toSubstrate.payload.adjacent_roles);

  const result: ActivationResult = {
    sessionId: session.id as string,
    desiredPosition: ai.desiredPosition,
    gap: ai.gap,
    firstAction: ai.firstAction,
    completed: false,
    ...(input.currentRole?.trim()
      ? { currentPosition: { role: input.currentRole.trim(), topSkills: ai.currentTopSkills } }
      : {}),
    ...(adjacentRoles.length > 0 ? { adjacentRoles } : {}),
  };

  if (idempotencyKey) {
    const keyHash = createHash('sha256').update(idempotencyKey).digest('hex');
    await (client as any)
      .schema('core')
      .from('idempotency_key')
      .update({ response_status: 200, response_body: result })
      .eq('user_id', userId)
      .eq('key_hash', keyHash)
      .eq('endpoint', '/activation/start');
  }

  return result;
}
