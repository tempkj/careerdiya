// Coarse-buckets raw gate answers before they enter the identification cache key
// (see identificationCache.ts). This is the production cache-hit-rate lever: the fewer
// buckets, the more unrelated users with "close enough" answers collapse onto the same
// cache key. Start coarse, widen only if hit-rate data justifies more granularity.
//
// Deliberately reusable beyond the cache: ADR-013 §1's feasibility check (timeline ×
// weeklyHours = budget, compared against path cost) will want the same timeline bucket,
// not a second parallel parse of the same free text.

export type TimelineBucket = 'urgent' | 'moderate' | 'relaxed' | 'unspecified';
export type ExperienceBucket = 'none' | 'some' | 'substantial';

export interface GateBucket {
  timeline: TimelineBucket;
  relevantExperience: ExperienceBucket;
}

interface BucketableGateAnswers {
  timeline?: string;
  checkedSkills?: string[];
  relevantExperienceText?: string;
}

// weeklyHours is deliberately NOT bucketed here: identify()'s actual call site
// (blueprint/identify route) never passes weeklyHours into identify() today — it only
// flows into derivePaths for effort/calendar math, per the Blueprint-gates backlog
// decision. Bucketing an input identification doesn't consume yet would be dead code.
// Add a weeklyHoursBand field here (and thread it into computeCacheKeyHash's inputs)
// when ADR-013 §1's feasibility check actually wires weeklyHours into identification.

// Heuristic only — not real NLU. Free text is genuinely ambiguous; this is a best-effort
// coarse split, not a classifier. Same "heuristic, not real classification" honesty as
// taskIdentifier.ts's mockTaskType.
//
// Order matters, and was previously wrong: negation was checked first on the theory
// that it's unambiguous. It isn't — real answers like "4 years backend, but never owned
// a roadmap myself" or "two years of reporting, no ML experience" describe substantial
// relevant experience while containing an incidental negation about one specific
// sub-task. Checking substantialSignals first means a concrete duration mention (a much
// stronger, harder-to-produce-by-accident signal) wins over a bare negation word buried
// in a qualifying clause. Found via real harness output, not a synthetic test case.
function bucketExperience(raw: string): ExperienceBucket {
  const text = raw.trim().toLowerCase();
  if (!text) return 'some';

  const substantialSignals =
    /\b(\d+\+?\s*(years?|yrs?))\b|\b(professionally|extensive|expert|many years|decade)\b/;
  if (substantialSignals.test(text)) return 'substantial';

  const noneSignals = /\b(no|none|never|haven't|have not|not any|zero|new to|no prior)\b/;
  if (noneSignals.test(text)) return 'none';

  return 'some';
}

// Parses free text for a month/week/year duration mention, normalizes to months, then
// buckets. Absent or unparseable -> 'unspecified' (neutral bucket) rather than guessing —
// timeline isn't collected by the UI yet (backlog decision), so this will mostly bucket
// to 'unspecified' until that lands; that's expected, not a bug in the parser.
function bucketTimeline(raw: string | undefined): TimelineBucket {
  if (!raw) return 'unspecified';
  const text = raw.trim().toLowerCase();
  if (!text) return 'unspecified';

  const match = text.match(/(\d+(?:\.\d+)?)\s*(day|week|month|year)s?/);
  if (!match) return 'unspecified';

  const value = parseFloat(match[1]!);
  const unit = match[2]!;
  const months =
    unit === 'day' ? value / 30 : unit === 'week' ? value / 4.345 : unit === 'year' ? value * 12 : value;

  if (months < 3) return 'urgent';
  if (months < 9) return 'moderate';
  return 'relaxed';
}

// relevantExperience bucket is debug/inspection-only now (see identificationCache.ts's
// computeCacheKeyHash comment — the bucket left the cache key after the false-attribution fix,
// then the sub-slice 3 checklist redesign replaced the single free-text field it was bucketing).
// Prefers the free-text elaboration when present (same heuristic as before, unchanged); falls
// back to a coarse presence check on checkedSkills otherwise — checkbox selections don't carry
// the same "none/some/substantial" texture as free text, so "any checked" collapses to 'some'
// rather than inventing false granularity.
export function bucketGateProfile(gateAnswers: BucketableGateAnswers): GateBucket {
  const relevantExperience = gateAnswers.relevantExperienceText?.trim()
    ? bucketExperience(gateAnswers.relevantExperienceText)
    : (gateAnswers.checkedSkills?.length ?? 0) > 0
      ? 'some'
      : 'none';

  return {
    timeline: bucketTimeline(gateAnswers.timeline),
    relevantExperience,
  };
}
