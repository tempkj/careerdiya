// The closed set of adult free-exploration direction ids — must stay in lockstep with
// DIRECTION_PROFILES.adult in apps/web/public/assets/decision-data.js and
// CAREER_LIBRARY_MAPPINGS' keys in apps/web/public/assets/career-mapping.js. Duplicated
// here (rather than imported) because decision-data.js is a browser script, not a module;
// keeping this list to id+label only (no scoring profile) bounds the duplication.
export const DIRECTION_LABELS = {
  software: 'Software Engineering',
  data: 'Data, Science & Research',
  product: 'Product, Business & Operations',
  finance: 'Finance, Economics & Risk',
  design: 'Design, UX & Creative Technology',
  marketing: 'Marketing, Media & Communication',
  people: 'People, Education & HR',
  law: 'Law, Policy & Public Affairs',
  health: 'Health, Life Sciences & Care',
  built: 'Architecture, Built & Applied Design',
  hospitality: 'Hospitality, Travel & Service',
  entrepreneurship: 'Entrepreneurship & Independent Work',
} as const;

export type DirectionId = keyof typeof DIRECTION_LABELS;

export const DIRECTION_IDS = Object.keys(DIRECTION_LABELS) as DirectionId[];

const DIRECTION_ID_SET = new Set<string>(DIRECTION_IDS);

export function isDirectionId(value: unknown): value is DirectionId {
  return typeof value === 'string' && DIRECTION_ID_SET.has(value);
}
