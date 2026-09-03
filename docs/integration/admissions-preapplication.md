# Career Diya Admissions Pre-Application — v1

## Scope
Career Diya captures a candidate's **interest to apply** to a specific college/programme and creates a Career Diya Pre-Application record.

The downstream admissions process is handled offline by the admissions partner. Career Diya does not submit the partner's internal application form or automate payment/document/application status in this phase.

## Launch flow

1. User selects a verified college + programme.
2. Career Diya opens `admissions.html` with query parameters for the selected opportunity.
3. User submits applicant and academic details and consent.
4. Browser inserts one row into `public.admissions_pre_applications` using Supabase REST + insert-only RLS.
5. Career Diya shows a human-readable ID such as `CD-PA-2026-ABC123`.
6. User is told that the admissions partner will contact them with next steps.

## Suggested link contract

```text
admissions.html?
  collegeId=<canonical college id>&
  collegeName=<college name>&
  programmeId=<programme id>&
  programmeName=<programme name>&
  specialization=<optional>&
  audience=<parent|student|professional>
```

## Operational boundary
Supabase Table Editor is the launch operational view for pre-applications. The Career Diya row is a request/lead for admissions assistance, not proof that the partner/university has submitted or accepted an application.

## Future work
If the admissions partner later provides a supported API/webhook contract, add a superseding ADR and a partner adapter. Do not silently expand this contract into an automated admissions system.
