import type { DraftTask, CalendarRange } from '../domain/types';

// Single source of truth for the effort-sum + calendar-range arithmetic.
// Used by derivePaths (assembling a fresh path) and by the edit-view UI
// (recomputing displayed totals as the user reorders/removes tasks) — both
// must agree, or the totals shown after an edit silently disagree with the
// formula that produced the original numbers.

export function computeEffortTotal(tasks: DraftTask[]): number {
  return tasks.reduce((sum, task) => sum + task.effortHours, 0);
}

export function computeCalendarRange(effortTotalHours: number, intensityHoursPerWeek: number): CalendarRange {
  const baseWeeks = effortTotalHours / intensityHoursPerWeek;
  return {
    minWeeks: Math.ceil(baseWeeks * 0.8),
    maxWeeks: Math.ceil(baseWeeks * 1.5),
  };
}

export function computePathTotals(
  tasks: DraftTask[],
  intensityHoursPerWeek: number,
): { effortTotalHours: number; calendarRange: CalendarRange } {
  const effortTotalHours = computeEffortTotal(tasks);
  return { effortTotalHours, calendarRange: computeCalendarRange(effortTotalHours, intensityHoursPerWeek) };
}
