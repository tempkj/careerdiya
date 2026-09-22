import type { DirectionId } from './directions';

// The 7 bounded free-exploration answers (decision-engine.js's PROFESSIONAL_QUESTIONS ids).
// stage/intent affect deterministic routing client-side; all 7 are echoed into the
// enrichment prompt/cache key so the enrichment text is grounded in the same inputs the
// deterministic engine used.
export interface BoundedAnswers {
  stage: string;
  intent: string;
  work: string;
  environment: string;
  priority: string;
  learning: string;
  commitment: string;
}

export const BOUNDED_ANSWER_OPTIONS = {
  stage: ['early', 'mid', 'senior'],
  intent: ['choice', 'switch', 'growth', 'learning', 'stuck'],
  work: ['analytical', 'builder', 'creative', 'people', 'quality'],
  environment: ['structured', 'dynamic', 'collaborative', 'independent'],
  priority: ['stability', 'growth', 'impact', 'flexibility'],
  learning: ['project', 'structured', 'mentor', 'self'],
  commitment: ['explore', 'validate', 'plan', 'act'],
} as const;

export function isBoundedAnswers(value: unknown): value is BoundedAnswers {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (Object.keys(BOUNDED_ANSWER_OPTIONS) as (keyof typeof BOUNDED_ANSWER_OPTIONS)[]).every((key) => {
    const candidate = row[key];
    return typeof candidate === 'string' &&
      (BOUNDED_ANSWER_OPTIONS[key] as readonly string[]).includes(candidate);
  });
}

export interface CourseRecommendation {
  title: string;
  provider: string;
  type: string;
}

// The one thing the model is allowed to produce. Deliberately has no `direction` field —
// the rendered direction is never sourced from here (ADR-CAREERDIY-0015). shadowDirection
// is carried separately (application/enrichment.ts) and is never part of this type, so a
// caller that only has a CareerDiyaEnrichment in hand cannot accidentally render it.
export interface CareerDiyaEnrichment {
  advice: string;
  courseRecommendations: CourseRecommendation[];
}

export interface RecommendRequestBody {
  role: string;
  answers: BoundedAnswers;
  chosenDirectionId: DirectionId;
}

// ── Edge guide (ADR-CAREERDIY-0016) ─────────────────────────────────────────────────

// Closed on purpose — today's only caller is the student "stream not listed" case. The
// route's shape is generic (streamOrRole/intent, not studentStream specifically) so a
// future second caller doesn't need a contract change, but nothing else is wired to it
// yet; don't widen this set speculatively.
export const GUIDE_INTENTS = ['stream_unlisted'] as const;
export type GuideIntent = (typeof GUIDE_INTENTS)[number];

export function isGuideIntent(value: unknown): value is GuideIntent {
  return typeof value === 'string' && (GUIDE_INTENTS as readonly string[]).includes(value);
}

// The one thing the edge-guide model is allowed to produce. Deliberately has no field for
// a single named career, a fit score, or a confidence claim — territories is the only
// output shape, so there is no schema slot for a personalised verdict to occupy even
// before containsVerdictLanguage (guideCache.ts) screens the text itself.
export interface CareerDiyaGuideOutput {
  territories: string[];
}

export interface GuideRequestBody {
  streamOrRole: string;
  intent: GuideIntent;
}
