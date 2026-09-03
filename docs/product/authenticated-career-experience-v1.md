# Career Diya — Authenticated Career Experience v1

## Purpose
Move Career Diya from a public website with a basic account into a persistent, personalised career workspace after registration.

## Implemented
- Email verification returns to `auth.html` with an explicit confirmation message instead of a dead-end/home redirect.
- Registered users can sign in and return to the saved exploration result.
- Added `career_profiles` for personal, academic, professional, career-interest and self-perception data.
- Added `profile.html` and a `My Profile` workspace tab.
- `Career Paths` becomes personalised for registered users and uses saved exploration directions.
- Added `Courses & Training` as the Career Diya-facing Skill Diya surface, with launch-stage placeholder recommendations.
- Dashboard now acts as a persistent Career Workspace with profile, exploration, paths and training entry points.
- Guest profile icon remains visible but non-clickable, with a hover explanation.
- Header avatars use initials or an available provider photo.

## Persistence
`career_exploration_results` remains the source for the saved free exploration. `career_profiles` stores explicit user-entered profile data. Both tables are user-scoped with RLS.

## Deferred
The real Career Diya → Skill Diya course suggestion engine remains a separate future build. The full CareerĀsanā / Career Twin / unified graph is not built by this change.
