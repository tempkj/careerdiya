# Lead Capture Backend — Launch v1

## Scope
A single Supabase/Postgres `public.leads` table shared by Career Diya and Skill Diya. This is lead capture only: no auth, no accounts, no Twin, no CareerĀsanā, no admin UI.

## Database
Apply `supabase/migrations/001_create_leads.sql` and `002_grant_leads_insert.sql`. Anonymous clients can insert only. There is intentionally no anonymous SELECT/UPDATE/DELETE policy. Supabase Table Editor is the launch dashboard.

Note: an RLS policy alone does not grant table access — Postgres also requires the base `GRANT INSERT ON public.leads TO anon` (added in migration 002). Without it, anon inserts fail with `permission denied for table leads` even though the policy is correct.

## Browser integration
`assets/lead-capture.js` exposes `window.CareerDiyaLeadCapture.submitLead(payload)`. The browser uses the public Supabase anon key and the REST `/rest/v1/leads` endpoint. Never expose the service-role key.

Copy `assets/supabase-config.example.js` to `assets/supabase-config.js` and set the Supabase project URL and anon key. `supabase-config.js` is intentionally untracked/deployment-config data.

## Payload contract
- `source`: `careerdiya` | `skilldiya`
- `segment`: qualified audience/background tag
- `interest`: course/direction/general identifier
- `interest_kind`: `course` | `direction` | `general`
- `name`, `email`, `phone`: optional contact details
- `shared_user_id`: null for anonymous leads; unused at launch
- `raw`: full original form payload, including audience and UTM data

The helper validates `source`, `segment`, `interest`, and `interest_kind` before inserting. The database policy validates the same qualification fields.

## Launch verification
1. Configure `supabase-config.js`.
2. Apply the migration.
3. Submit one real Career Diya lead from the real form and verify a row appears.
4. Submit one real Skill Diya lead from its real form and verify a row appears.
5. Confirm `source`, `segment`, and `interest` are populated.
6. Confirm a client-side GET using the anon key is rejected because no SELECT policy exists.

Skill Diya's `.js-interest` forms (contact, about, trainers, writing, course pages) are wired to the same helper contract via `assets/js/interest.js`, `assets/js/lead-capture.js` and `assets/js/supabase-config.js` in the Skill Diya source tree. `segment` for Skill Diya leads is the form's page-origin tag (e.g. `contact-page`, `course-automation-testing-e2e`); `interest_kind` is `course` when the selected value matches a known course slug, otherwise `general`.
