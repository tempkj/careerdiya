Career Diya + Skill Diya — End-to-End Workflow & Service-Boundary Specification
Purpose: map EVERY user state, what each state can access (service boundary), how each is personalized, and what infrastructure each requires — across Career Diya (guidance) and Skill Diya (learning, currently surfaced inside Career Diya). This is the master reference the individual feature specs (exploration model, booking flow, message system, profile) plug into.
Guiding frames (already decided, carried in):
* Launch-first, build-on-evidence. Most depth here is post-launch; this doc says WHAT the system is, not that it all gets built now.
* Honesty is the product (no fake validity, no dark patterns, "no catch" promise must hold at every state).
* Skill Diya currently lives as a section inside Career Diya; courses are Skill-Diya-owned data displayed in Career Diya.

1. The user-state ladder (the core matrix)
Every visitor is in exactly ONE of these states. Personalization and service access are defined per-state. States are progressive — each unlocks more.
#	State	Identified?	Contactable?	Paid?	Core question the product answers
S0	Anonymous browser	No	No	No	"What is this? Is it for me?"
S1	Anonymous explorer (took free check, no contact)	No (browser-local)	No	No	"Where could I go?"
S2	Lead (gave email/phone for results, not registered)	Pseudonymous (email)	Yes	No	"Send me my result / keep me posted"
S3	Registered user (account, no purchase)	Yes	Yes	No	"Save my journey, personalize, go deeper"
S4	Paid — Career Diya service (counselling/assessment)	Yes	Yes	Yes (CD)	"Give me real human guidance / deep assessment"
S5	Paid — Skill Diya (course/cohort, when live)	Yes	Yes	Yes (SD)	"Teach me what supports my direction"
S6	Practitioner / trainer (supply side, Skill Diya)	Yes (separate role)	Yes	N/A (earns)	"Let me teach / run a cohort"
Note S4 and S5 are not mutually exclusive (a user can buy both). S6 is a different actor class (supply, not demand) — flagged here for completeness; mostly out of near-term scope.

2. Per-state: what they can DO (service boundary) and how it's PERSONALIZED
S0 — Anonymous browser
* Can access: homepage, the contrarian message, career library/explore pages (read-only public content), the "start free check" entry, honest course browsing (Skill Diya section, full catalogue view), external-links-shown honesty. Everything genuinely public.
* Cannot: get a personalized result (haven't done the check), save anything, book/pay.
* Personalization: audience selector only (parent/student/professional) → adapts copy/CTA. No identity, no profile. Approximate-country localization (transient, not stored).
* Goal of this state: convert to S1 (take the check) — the free muffin.
S1 — Anonymous explorer (completed free check, no contact given)
* Can access: their free-check RESULT (directional read + explore-directions + honest signal band), the contextual "courses that support this direction" (browse + register-interest), career-library depth for their direction.
* Cannot: save result across devices/sessions reliably (it's browser-local only), get it emailed, build history, book/pay.
* Personalization: driven by their exploration (audience + answers + result). Browser-local self-contained snapshot (per exploration spec) — persists in THAT browser, promotable on later registration.
* Conversion asks (honest, non-catch): "Email me my result" → S2. "Save your journey / create a free account" → S3. "Want courses for this?" → interest capture (a Lead signal even if anonymous, if they give email).
* Boundary rule: result is FREE and ungated (no wall). We do NOT hold the result hostage for registration (decided: pre-result wall rejected).
S2 — Lead (gave contact for result / "notify me", not registered)
* Can access: everything S1 can, PLUS we can now REACH them (email result, notify on Phase-2 features, notify when a course cohort opens).
* Cannot: logged-in workspace, saved multi-exploration history, personalized dashboard (no account yet), paid services (until they pay).
* Personalization: we hold their email + the exploration/interest context (leads table, tagged source/segment/interest). Not a full profile — a contactable pseudonymous record.
* Infra: the leads table (BUILT, verified) — this state already works. This is the demand-capture backbone.
* Conversion asks: re-engage via email → register (S3) or purchase (S4/S5). This is the ~98% fence-sitter bucket; its value is contactability.
S3 — Registered user (account, no purchase)
* Can access: logged-in workspace/dashboard (their profile, exploration history per the free/paid limits, saved directions, "next moves"), profile creation (optional fields, benefit- framed), the free tier fully, honest course browsing + interest capture, entry points to paid services.
* Cannot: the paid deep assessment, paid counselling, paid Skill Diya cohorts (until purchase); the deep CareerĀsanā-backed personalization (gap analysis/blueprint — that's paid/later).
* Personalization: profile-driven (the whole personalization architecture). Normal workspace personalized by current profile; opening an old exploration = exploration-driven view (per exploration state-machine spec). Free-tier exploration limits apply (visibleCount/storageLimit free config).
* Infra: auth (Supabase Auth), profile table, exploration table (many-rows-per-user), all under shared identity (shared_user_id per ADR-ECOSYSTEM-0001). This is where auth/identity gets built — deferred until the registered experience is worth it.
* Conversion asks: upgrade to paid (counselling/assessment/deeper tier), or Skill Diya course.
S4 — Paid: Career Diya service (counselling and/or deep assessment)
* Can access: the booking flow (token-hold → pay → confirm), the paid deep assessment (routed to co-branded, delivered as Career Diya experience, zero-redirect), counselling sessions (Zoom), follow-ups, and — later — the CareerĀsanā-backed deeper personalization (gap analysis, blueprint, tracked plan) as that tier is built.
* Personalization: deepest — profile + exploration history + (later) Twin/gap-analysis. This is where "genuinely deeper = personalized + longitudinal + actionable" lives.
* Infra: bookings table (state machine), Razorpay (server-verified webhooks), Calendar/slots, email/WhatsApp notifications, Zoom, admin view, auto-release job. (Full booking-workflow spec.) Later: CareerĀsanā headless backend for the deep personalization tier.
* Boundary rule: paid services are the revenue; free tier feeds them. Output ceiling on free tier protects this.
S5 — Paid: Skill Diya (course/cohort — when Skill Diya goes live)
* Can access: enrolled course/cohort delivery, practitioner-led sessions, cohort materials, progress.
* Personalization: course recommendations (from Career Diya bridge) + their learning progress.
* Infra: Skill Diya delivery platform (the standalone build, currently dark) — cohort mgmt, practitioner tools, enrollment, payment. This is the trigger to actually stand up standalone Skill Diya (demand signal from S1/S2/S3 course-interest capture + supply readiness).
* Near-term: S5 doesn't fully exist yet — currently "register interest" (S2-style capture) is the Skill Diya path. Real S5 = when standalone Skill Diya launches.
S6 — Practitioner / trainer (Skill Diya supply side)
* Can access: practitioner onboarding, cohort/workshop creation, their teaching tools.
* Infra: the practitioner-facing side of Skill Diya (part of the deferred standalone build). The workshop on-ramp format lives here.
* Near-term: out of scope for the Career-Diya-embedded phase; activates with standalone Skill Diya. Recruit practitioners now (relationships), build tools when standalone launches.

3. The transitions (how users move up the ladder)
S0 anonymous browser
   │ takes free check
   ▼
S1 anonymous explorer ──── gives email (result/notify) ────► S2 lead
   │ registers                                                │ registers
   ▼                                                          ▼
S3 registered user ◄────────────────────────────────────────┘
   │ buys CD service            │ buys SD course
   ▼                            ▼
S4 paid (Career Diya)      S5 paid (Skill Diya)
Key transition rules:
* S1→S2 and S1/S2→S3 are the money transitions for demand-sensing (contactability + accounts).
* Anonymous work is never lost: S1's browser-local self-contained exploration snapshot promotes to E1 on registration (S3) — idempotent promotion, no recompute (per exploration spec).
* Every up-transition is honest & un-catch-y: no forced walls, benefit-framed asks. The "no catch" promise governs every transition.
* Contactability is captured as early as possible (S2) because the ~98% who won't register are retained only by being reachable.

4. Personalization model summary (who drives what)
State	Personalization source
S0	Audience selector only (transient)
S1	The exploration (audience+answers+result), browser-local
S2	Exploration/interest context held against email (leads)
S3	Profile (current state) for workspace; exploration snapshot for exploration views; free-tier limits
S4	Profile + exploration history + (later) CareerĀsanā Twin/gap/blueprint
S5	Recommendations + learning progress
Hard invariants (from prior specs, carried in):
* Opening an old exploration = exploration-driven view; never rewrites profile.
* Parent-safety keys off the exploration's audience, not the profile.
* Profile is mutable current state; explorations are immutable snapshots.

5. Infrastructure map (what each tier needs)
Capability	Infra	Status
Public site, free check (client-side engine)	Static hosting (Hostinger) + decision-data/engine.js	LIVE
Lead capture (S2), course interest	swakojo-shared.leads table, insert-only RLS	LIVE, verified
Analytics / funnel	Plausible/Umami + custom events + leads	To add (cheap)
Auth / accounts (S3)	Supabase Auth, shared_user_id identity	verify if built and built correctly or not, if not build now
Profile (S3)	Profile table (RLS: own-row only), shared project	verify if built and built correctly or not, if not build now
Exploration history (S3)	Exploration table (id-PK, many-per-user), snapshot model	DB migration worth doing early; UI at paid time
Paid booking (S4)	bookings table (state machine), Razorpay+webhooks, Calendar/slots, email/WhatsApp, Zoom, admin, auto-release job	Build post-launch, carefully (handles money)
Deep personalization (S4)	CareerĀsanā headless backend (Twin/gap/blueprint)	partially built in careerasana, integrate post launch
Skill Diya delivery (S5)	Standalone Skill Diya platform (cohorts, enrollment, payment)	Dark build; launch on demand+supply signal
Practitioner tools (S6)	Skill Diya practitioner side	as of now integrate the practitioner platform built for skill diya in career diya itself … will be seperated later … to be integrated post launch
Data ownership (which project):
* Cross-arm/shared (leads, bookings, shared identity, shared admin) → swakojo-shared.
* Career Diya consumer/exploration/profile data → careerĀsanā-backed project (the "intelligence backend" project) or swakojo-shared for the shared-identity parts. Keep profile/exploration cross-arm-joinable under shared_user_id.
* Skill Diya courses/delivery → Skill Diya project (courses = Skill-Diya-owned, displayed in CD).

6. The service-boundary rules (what's free vs paid, and the honesty around it)
1. Free (S0–S3): the direction check, the directional result, honest course browsing (incl. external links shown), career-library depth, the workspace/history (within free limits). Output ceiling on the free result protects the paid tier.
2. Paid Career Diya (S4): deep validated assessment + human counselling; later, the CareerĀsanā-backed deeper personalization (gap/blueprint/tracking).
3. Paid Skill Diya (S5): the actual courses/cohorts.
4. Honesty invariants across ALL boundaries: no fake validity on free tier; no dark patterns at any up-transition; "no catch" holds; course recommendations are fit-based not profit-based, with external options honestly shown; paid tiers clearly what they are, no bait-and-switch.

7. What to actually build now vs. defer (sequencing)
Now / near-term (launch + immediate):
* Keep S0–S2 fully working (LIVE): public site, free check, lead capture, course-interest capture.
* Add funnel analytics (cheap, high value).
* Do the exploration DB migration to id-PK/many-per-user + self-contained anonymous snapshot capture — cheap now (near-zero data), painful later; and the snapshot data should accrue from first users.
* Keep the honest message system + course honesty.
Post-launch, evidence-gated (build when the state's demand is real):
* S3 auth/profile/workspace (when registered experience is worth building).
* S4 booking flow (when there's demand to pay for counselling) — build carefully, handles money.
* S4 deep personalization / CareerĀsanā backend (when demand for depth proven).
* S5/S6 standalone Skill Diya (when course-interest signal + practitioner supply justify it).
The through-line: the ladder is fully specified so nothing contradicts, but you build each rung when real users are standing on the rung below it pushing up. Right now users are at S0–S2; the next rung to genuinely build is whichever the S1/S2 signal says is most wanted (likely S3 accounts or S4 paid counselling), decided by real Phase-1 data.
