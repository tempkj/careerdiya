# ADR-015: Career Diya counsellor platform (MVP)

**Status:** Proposed
**Date:** 2026-11-13
**Author:** Kunal (via Claude Code)
**Supersedes:** Nothing
**Governance impact:** DB amendment — adds migration `20261113000043_career_diya_counselling.sql`
(new `core.cd_*` tables, RLS, RPCs, two private storage buckets). **No change to
`contracts/`** (OpenAPI) and no prompt change.

## Context

Career Diya already has a counselling page (`public/counselling.html`) that only captures
leads. We want a small platform where verified counsellors (starting with founding
counsellors from the Edumilestones network) run their practice on Career Diya, and clients
can find a counsellor, book a slot and pay.

Strategy (business, not technical): **counsellor tool first, marketplace later.** Counsellors
join because the tool is useful for clients they already have (profile, booking, payments,
notes, reports). Lead generation from Career Diya comes later.

Architecture board: https://claude.ai/artifact/KWj2ZfPSanwgMVS1c1cvrw

## Decision

1. **New module `counselling`** (`apps/web/src/modules/counselling`). Like `careerdiya`, it is
   part of the free Career Diya surface, not the CareerAsana paid contract, so its routes
   live outside `contracts/careerasana_openapi_v1.yaml`. It has no cross-module
   dependencies; auth comes from `@/lib/supabase/server` (user-scoped client, RLS applies).
2. **Roles** — `client` (anyone signed in), `counsellor` (has a `core.cd_counsellor` row),
   `admin` (row in `core.cd_admin`, granted by SQL only). `core.cd_user_role()` resolves
   them. Anonymous (guest) sessions cannot become counsellors or book.
3. **Tables** (`core` schema, `cd_` prefix): `cd_admin`, `cd_counsellor`,
   `cd_counsellor_certificate`, `cd_availability_slot`, `cd_booking`, `cd_payment`,
   `cd_session_note`, `cd_report_template`, `cd_report`, `cd_notification`.
4. **RLS is the boundary** (invariant A5):
   - Verified counsellors and their open future slots are publicly readable.
   - A counsellor sees only their own slots, bookings, clients, notes and reports.
   - Session notes are visible **only** to the counsellor who wrote them (not the client,
     not admin).
   - A client sees their own bookings, payments and reports the counsellor has shared.
   - Admin can read counsellors, certificates, bookings and payments, and change a
     counsellor's verification status.
5. **State changes that cross owners go through `SECURITY DEFINER` RPCs** that check
   `auth.uid()` themselves: `cd_book_slot` (locks the slot, creates a `pending_payment`
   booking with a 15-minute hold), `cd_cancel_booking`, `cd_attach_payment_order`,
   `cd_set_counsellor_status` (admin), `cd_complete_booking` (counsellor). Clients never get
   UPDATE rights on bookings, slots or payments.
6. **Payments: Razorpay.** The Next.js route creates the Razorpay order with the API key
   secret (a provider secret, not the Supabase service role) and records it through
   `cd_attach_payment_order`. The browser opens Razorpay Checkout, so card data never touches
   our servers. **The webhook is the only thing that confirms a booking**: the
   `counselling-razorpay-webhook` edge function verifies `X-Razorpay-Signature`
   (HMAC-SHA256 of the raw body) and then calls `cd_apply_payment_event`. The client page
   polls the booking status; it never marks anything paid itself.
7. **Service role only in edge functions** (webhook + notifications). These are
   server-to-server, not user request paths, consistent with handbook §3.
8. **Notifications** go through an outbox (`cd_notification`). `counselling-notify` sends
   queued messages by email (Resend) and WhatsApp (Meta Cloud API) when those secrets are
   set, otherwise marks them `skipped`. It also queues 24-hour reminders. Run it on a
   schedule.
9. **Video:** in v1 the counsellor's own Google Meet / Zoom link is copied onto the booking
   when it is confirmed. No in-app video.
10. **Files:** private buckets `cd-certificates` and `cd-reports`; object paths start with the
    owner's user id, and storage policies mirror the table rules. Downloads use short-lived
    signed URLs.

## Not in v1

Ratings/reviews, in-app video, automatic matching, mobile apps, psychological counselling
categories, counsellor payouts/settlements (Razorpay Route), refunds initiated from the UI.

## Consequences

- One more migration; `core` gains ten `cd_` tables. Supabase must expose `core` (it already
  does) and the two buckets are created by the migration.
- Payments are only confirmed if the webhook is configured in the Razorpay dashboard and
  `RAZORPAY_WEBHOOK_SECRET` is set on the edge function. Without it, bookings stay
  `pending_payment` and the hold expires.
- Counsellor fees are collected into the Career Diya Razorpay account; paying counsellors
  their share is manual until a payouts decision is made (a later ADR).
- Session notes are deliberately invisible to admins. Support cannot read them.
