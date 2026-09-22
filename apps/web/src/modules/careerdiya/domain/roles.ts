export const BOUNDED_ROLE_VALUES = [
  'software engineer','software developer','application developer','application engineer',
  'frontend developer','front end developer','backend developer','back end developer',
  'full stack developer','full-stack developer','web developer','senior software engineer',
  'senior software developer','technical developer',
  'data scientist','data analyst','research analyst','researcher','machine learning engineer',
  'machine learning scientist','ml engineer',
  'product manager','product owner','business analyst','operations manager','operations analyst',
  'program manager','project manager','business operations',
  'ux designer','ui designer','ui ux designer','ui/ux designer','product designer',
  'interaction designer','visual designer','graphic designer',
  'marketing manager','marketing executive','digital marketer','digital marketing manager',
  'content marketer','content writer','communications manager','brand manager','growth marketer',
  'hr manager','human resources manager','hr executive','human resources executive','recruiter',
  'talent acquisition','learning and development','l&d manager','trainer','teacher',
  'career counsellor','career counselor',
  'financial analyst','finance analyst','accountant','auditor','risk analyst','risk manager',
  'investment analyst','finance manager',
  'lawyer','legal counsel','legal analyst','policy analyst','public policy analyst',
  'compliance analyst','government relations',
  'doctor','physician','nurse','clinical researcher','biologist','pharmacist',
  'healthcare professional','medical officer',
  'architect','architecture designer','civil engineer','structural engineer','interior designer',
  'industrial designer',
  'hotel manager','hospitality manager','travel consultant','travel manager',
  'guest relations manager','restaurant manager','event manager',
  'founder','cofounder','co-founder','entrepreneur','business owner','freelancer',
  'independent consultant',
] as const;

const BOUNDED_ROLE_SET = new Set<string>(BOUNDED_ROLE_VALUES);

export function normalizeBoundedRole(value: string): string {
  return value.trim().toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').replace(/[.,]+$/, '');
}

export function isBoundedRoleValue(value: unknown): value is string {
  return typeof value === 'string' && BOUNDED_ROLE_SET.has(normalizeBoundedRole(value));
}
