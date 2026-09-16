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
