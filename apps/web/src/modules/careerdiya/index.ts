// Public surface of the 'careerdiya' module. Other modules import ONLY from here (invariant A1).
export type { DirectionId } from './domain/directions';
export { DIRECTION_IDS, DIRECTION_LABELS, isDirectionId } from './domain/directions';
export type { BoundedAnswers, CareerDiyaEnrichment, CourseRecommendation, RecommendRequestBody } from './domain/types';
export type { CareerDiyaGuideOutput, GuideIntent, GuideRequestBody } from './domain/types';
export { GUIDE_INTENTS, isGuideIntent } from './domain/types';

export { getEnrichment, mockEnrichment } from './application/enrichment';
export { CAREER_DIYA_ENRICHMENT_PROMPT_VERSION } from './application/enrichmentCache';
export { getGuide, mockGuide } from './application/guide';
export { CAREER_DIYA_GUIDE_PROMPT_VERSION } from './application/guideCache';
