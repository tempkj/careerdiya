import type { DraftTask } from '../domain/types';

export interface DisputeResult {
  disposition: 'agreed' | 'counter';
  message: string;
}

// Deterministic mock (ADR-013 §5 — no live AI call yet). A sound reason is
// agreed with immediately; anything else gets an honestly-labeled placeholder,
// not a persuasive-sounding fake argument — a tester must not be able to
// mistake this for real reasoning about their specific situation. The keyword
// list is a crude proxy for "sound reason" (mentions prior experience), not a
// classifier; the live version replaces this with an actual evaluation.
const SOUND_REASON_MARKERS = ['already', 'have done', 'years of', 'done this before', 'built this'];

export function evaluateDispute(task: DraftTask, reason: string): DisputeResult {
  const normalized = reason.trim().toLowerCase();
  const soundsExperienced = SOUND_REASON_MARKERS.some((marker) => normalized.includes(marker));

  if (soundsExperienced) {
    return {
      disposition: 'agreed',
      message: `Fair — sounds like you already have ground on "${task.skillName ?? task.title}". Dropping it from the plan.`,
    };
  }

  return {
    disposition: 'counter',
    message:
      '[Mock placeholder — live reasoning about your specific situation is not built yet.] ' +
      'The system would normally weigh why this task was suggested against what you just said, ' +
      'then defer to your judgment either way. For now: keep or drop it yourself.',
  };
}
