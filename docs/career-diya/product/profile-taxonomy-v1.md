# Career Diya Profile Taxonomy v1

## Purpose

The authenticated Career Diya profile is a structured personalization layer. Standardized values are preferred for analytics, recommendations and future archetype/collective-intelligence work. Users can still capture genuine edge cases through explicit `Other` values.

## Bounded concepts

- Country
- Education level
- Field of study
- Role family
- Industry
- Experience bucket
- Experience/knowledge domain
- Exposure type
- Exposure level
- Career interests
- Career goals
- Strengths
- Development areas
- Learning preferences

## Multiple-background model

A person may have more than one academic stream or meaningful domain of experience/knowledge.

`career_profile_education` stores multiple formal education records.

`career_profile_experience` stores multiple areas with domain + exposure type + exposure level and optional role family/duration.

This avoids forcing a hybrid user into one field while keeping the vocabulary bounded.

## Compatibility

`career_profiles` retains its existing current-state fields so existing authenticated dashboard/profile behaviour does not have to be rewritten at once. `shared_user_id` remains present for future cross-arm identity compatibility; no additional identity machinery is introduced by this change.
