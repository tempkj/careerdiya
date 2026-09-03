# ADR-CAREERDIY-0014 — Career Diya Pre-Application and Offline Admissions Boundary

## Status
Accepted

## Context
Career Diya may surface college/programme opportunities supplied through a connected admissions ecosystem. The downstream admissions process is not fully online: admissions partner personnel may contact the candidate, guide them through documents/payment/application steps, and complete the process offline or through partner systems.

Career Diya therefore needs a trustworthy way to capture application intent without pretending that a university/college application has already been submitted.

## Decision
Career Diya will own a **Pre-Application** record, not the downstream admissions application.

When a user submits the Career Diya application form, Career Diya will:

1. validate and capture the applicant's contact/academic information;
2. capture the selected college, programme and specialization;
3. generate a human-readable **Career Diya Pre-Application ID** in the form `CD-PA-YYYY-XXXXXX`;
4. store the pre-application in `public.admissions_pre_applications`;
5. show a clear confirmation that the request has been received;
6. tell the user that the admissions partner will contact them soon regarding the remaining process.

Career Diya will **not** submit the partner's `apply-university.php` request, generate partner payment links, upload documents to the partner, or synchronize downstream application status as part of this launch scope.

## Boundary

```text
Career Diya
  College / programme selection
        ↓
  Pre-Application form
        ↓
  CD-PA-2026-XXXXXX
        ↓
  "Our admissions partner will contact you soon"
        ║
        ║ offline operations / partner process
        ▼
  Admissions partner
```

## Naming rule
The Career Diya identifier is explicitly a **Pre-Application ID**. It must not be described as a university application number, confirmed application number, payment reference, or admission confirmation.

## Data shape
Persistent records include `shared_user_id` when a valid Career Diya authenticated session is available. Anonymous submissions may leave it `NULL`. This preserves compatibility with ADR-ECOSYSTEM-0001 without introducing a shared identity service now.

## Security / access
The browser may insert pre-application records through Supabase using the public/anon key under insert-only RLS. The client is deliberately not granted general select/update/delete access to the table.

## UX rules
The confirmation must state:

- the selected college/programme;
- the Career Diya Pre-Application ID;
- that the request has been received;
- that the admissions partner will contact the applicant;
- that additional documents/payment/other steps may be required later.

Career Diya must not claim that admission is successful or that a formal university application has been submitted unless a future operational integration establishes that fact.

## Explicitly not in scope

- Career Diya → admissions-partner API adapter
- automated payment-link generation
- partner document submission
- partner application-status synchronization
- automated admissions approval/rejection decisions
- partner-specific application form mirroring

## Future extension
If the offline process later becomes operationally mature and the partner provides a supported API/webhook contract, a newer ADR may add a partner integration boundary. Such an ADR must supersede this one rather than silently expanding the current scope.
