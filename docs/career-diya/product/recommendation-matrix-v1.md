# Career Diya Free Exploration Recommendation Matrix v1.0

## Product boundary

This matrix powers the free exploration only. It produces broad directions worth exploring and is not a validated psychometric assessment.

## Scored categories

| Category | Weight |
|---|---:|
| Interests | 20% |
| Strengths | 20% |
| Work / problem preference | 15% |
| Work style | 15% |
| Values | 20% |
| Practical fit | 10% |

Stage/context is routing-only.

## Internal dimensions

### Core

- analytical
- creative
- people
- builder
- communication
- organizing
- research
- commercial
- service
- autonomy
- variety
- structure
- hands_on
- deep_focus

### Values

- learning
- stability
- impact
- income
- freedom

## Canonical scoring

For each category:

```text
similarity = cosine(user_category_vector, direction_category_vector)
```

Convert similarity to a 0-100 category score.

Then:

```text
overall fit =
  interest_similarity × 0.20
+ strength_similarity × 0.20
+ work_preference_similarity × 0.15
+ work_style_similarity × 0.15
+ values_similarity × 0.20
+ practical_fit_similarity × 0.10
```

Apply explicit mismatch / constraint penalties after the weighted aggregation.

## Signal thresholds

Initial calibration defaults only; not validated constants:

- Strong: score >= 75 AND top recommendation margin >= 7
- Moderate: score 62-74
- Early: score < 62 OR margin < 7

These values must remain configurable.

## Direction profiles (16+)

1. Technology & Engineering
2. Data, Science & Research
3. Product, Business & Operations
4. Finance, Economics & Risk
5. Design, UX & Creative Technology
6. Marketing, Media & Communication
7. People, Education & HR
8. Law, Policy & Public Affairs
9. Health, Life Sciences & Care
10. Architecture, Built & Applied Design
11. Hospitality, Travel & Service
12. Entrepreneurship & Independent Work

## Parent direction profiles

1. Technology & Engineering
2. Science, Research & Data
3. Business & Leadership
4. Design, Media & Communication
5. People, Education & Society
6. Health & Life Sciences
7. Architecture, Built & Applied
8. Hospitality, Travel & Service

## Recommendation selection

Do not simply take the top three scores. Select:

1. best overall match;
2. strong alternative from a meaningfully different profile;
3. adjacent direction worth testing.

## Explanation

Every displayed recommendation should be explainable from actual contributing signals. Do not invent rationale that is not supported by the answers.
