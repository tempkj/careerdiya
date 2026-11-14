// Plain-language labels for CareerĀsanā's internal task vocabulary, so the planning screens
// read like guidance rather than engine output. Display only: the stored values and the
// contract enums are unchanged.

import type { EvolveCategory } from '../domain/types';

const CATEGORY: Record<EvolveCategory, string> = {
  learn: 'Learn',
  engage: 'Engage',
  organize: 'Organise',
  visualize: 'Visualise',
  venture: 'Venture',
  elevate: 'Elevate',
};

const CRITICALITY: Record<string, string> = {
  required: 'Required',
  preferred: 'Nice to have',
  differentiating: 'Sets you apart',
};

const TASK_TYPE: Record<string, string> = {
  compound: 'Builds on other tasks',
  solo_study: 'Study on your own',
  cant_practice_alone: 'Needs real-world practice',
  near_free: 'Quick win from what you know',
  evidence: 'Creates proof of your work',
};

export function categoryLabel(category: EvolveCategory | string): string {
  return CATEGORY[category as EvolveCategory] ?? String(category);
}

/** "Learn · Required · Study on your own" — missing parts are left out, never shown as raw codes. */
export function taskMetaLine(task: {
  evolveCategory: EvolveCategory | string;
  criticality?: string | null;
  taskType?: string | null;
}): string {
  return [
    categoryLabel(task.evolveCategory),
    task.criticality ? CRITICALITY[task.criticality] ?? task.criticality : 'Added to round out the plan',
    task.taskType ? TASK_TYPE[task.taskType] : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

// The AI's explanations sometimes echo internal codes from its instructions ("netNew",
// "cant_practice_alone"). Swap them for plain words before display. The lasting fix is a new
// prompt version (ADR-003); this keeps already-generated and cached text readable meanwhile.
const CODE_WORDS: Array<[RegExp, string]> = [
  [/\bnetNew\b/g, 'new to you'],
  [/\bcant_practice_alone\b/g, "can't be practised alone"],
  [/\bsolo_study\b/g, 'self-study'],
  [/\bnear_free\b/g, 'quick win'],
  [/\bnear-free\b/g, 'almost free'],
];

export function plainText(text: string | null | undefined): string {
  if (!text) return '';
  return CODE_WORDS.reduce((s, [re, word]) => s.replace(re, word), text);
}
