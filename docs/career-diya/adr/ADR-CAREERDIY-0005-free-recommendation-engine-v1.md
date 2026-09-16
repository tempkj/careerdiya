# ADR-CAREERDIY-0005: Free Recommendation Engine v1

- **Status:** Accepted
- **Date:** 2026-08-19
- **Specification:** `../product/recommendation-matrix-v1.md`

## Context

The initial prototype used a primary-trait/secondary-trait rule with additive bonuses. That approach under-used answers and was difficult to explain or calibrate.

## Decision

Use a deterministic, data-driven, six-category profile model.

### Scored categories

- Interests: 20%
- Strengths: 20%
- Work/problem preference: 15%
- Work style: 15%
- Values: 20%
- Practical fit: 10%

The stage/context question is routing only and is not scored.

### Canonical math

For each category:

```text
user dimension vector
        ↓
career/direction dimension vector
        ↓
cosine similarity (0-100)
```

Then:

```text
overall fit =
  interest similarity × 20%
+ strength similarity × 20%
+ work preference similarity × 15%
+ work style similarity × 15%
+ values similarity × 20%
+ practical fit similarity × 10%
```

Then apply constraint / incompatibility penalties.

Do not use additive point matching between dimensions as a substitute for the category-level cosine calculation.

### Signal thresholds

The initial values are **provisional calibration defaults**, not validated psychometric thresholds:

- strong: score >= 75 AND top-recommendation margin >= 7;
- moderate: score 62-74;
- early: score below 62 OR margin below 7.

Thresholds must be configurable and may be recalibrated using real outcomes and expert review.

### Recommendation selection

Do not blindly return the top three scores. Prefer:

1. best overall match;
2. strong alternative with meaningful profile difference;
3. adjacent direction worth testing.

## Consequences

The engine is explainable, deterministic and tunable. Numeric scores are internal and should not be presented as scientifically validated percentages in the free experience.
