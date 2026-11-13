# Career Diya counsellor platform — setup and runbook

MVP described in [ADR-015](./architecture/adr/ADR-015-counsellor-platform-mvp.md).
Architecture board: https://claude.ai/artifact/KWj2ZfPSanwgMVS1c1cvrw

## What's in it

| Who | Pages |
|---|---|
| Clients | `/counsellors` (directory + search), `/counsellors/[id]` (profile, book, pay), `/my-sessions`, `/my-sessions/[id]` (status, meeting link, report) |
| Counsellors | `/counsellor` (onboarding / overview), `/counsellor/availability`, `/counsellor/clients`, `/counsellor/sessions/[id]` (private notes, meeting link, report), `/counsellor/profile` (profile, contact, certificates), `/counsellor/templates` |
| Admins | `/admin/counselling` (verify counsellors, bookings, payments, refunds to process) |

The static `counselling.html` page links to `/counsellors`.

## One-time setup

1. **Database.** Apply migration `20261113000043_career_diya_counselling.sql`
   (`pnpm db:migrate`, or the Supabase dashboard SQL editor). It creates the `core.cd_*`
   tables, RLS, RPCs and the private storage buckets `cd-certificates` and `cd-reports`.
2. **Make yourself admin** (SQL editor, once):
   ```sql
   INSERT INTO core.cd_admin (user_id)
   SELECT id FROM auth.users WHERE email = 'you@example.com';
   ```
3. **App environment** (`.env.local` / Vercel):
   ```
   RAZORPAY_KEY_ID=rzp_test_...       # public key id, sent to the browser for Checkout
   RAZORPAY_KEY_SECRET=...            # server only — never expose
   ```
   Restart after changing.
4. **Edge functions:**
   ```bash
   supabase functions deploy counselling-razorpay-webhook --workdir packages/db
   supabase functions deploy counselling-notify --workdir packages/db
   supabase secrets set --workdir packages/db \
     RAZORPAY_WEBHOOK_SECRET=... APP_BASE_URL=https://careerdiya.in \
     RESEND_API_KEY=... NOTIFY_FROM_EMAIL="Career Diya <sessions@careerdiya.in>"
   # Optional WhatsApp (Meta Cloud API, approved templates with 4 body params):
   #   WHATSAPP_TOKEN WHATSAPP_PHONE_NUMBER_ID WHATSAPP_TEMPLATE_LANG
   #   WHATSAPP_TEMPLATE_BOOKING_CONFIRMED WHATSAPP_TEMPLATE_BOOKING_CANCELLED WHATSAPP_TEMPLATE_REMINDER_24H
   ```
   Channels without secrets mark their messages `skipped`; nothing breaks.
5. **Razorpay dashboard → Settings → Webhooks:** add
   `https://<project-ref>.supabase.co/functions/v1/counselling-razorpay-webhook`, with the same
   secret as `RAZORPAY_WEBHOOK_SECRET`, and events `payment.captured`, `order.paid`,
   `payment.failed`, `refund.processed`. **Without the webhook no booking is ever confirmed.**
6. **Schedule the notifier** every 5 minutes (sends messages, queues reminders, releases unpaid
   holds). With `pg_cron` + `pg_net` enabled:
   ```sql
   SELECT cron.schedule('counselling-notify', '*/5 * * * *', $$
     SELECT net.http_post(
       url := 'https://<project-ref>.supabase.co/functions/v1/counselling-notify',
       headers := jsonb_build_object('Authorization', 'Bearer <service-role-key>',
                                     'Content-Type', 'application/json'),
       body := '{}'::jsonb);
   $$);
   ```
   (Store the key in Vault rather than inline if you prefer.)

## How a booking works

1. Client picks a slot → `cd_book_slot` creates a `pending_payment` booking and holds the slot
   for 15 minutes. Free sessions (fee ₹0) are confirmed immediately.
2. Browser calls `POST /api/v1/counselling/bookings/{id}/order` → server creates the Razorpay
   order and records it (`cd_attach_payment_order`) → Razorpay Checkout opens.
3. Razorpay calls the webhook → signature verified → `cd_apply_payment_event` marks the payment
   paid, confirms the booking, books the slot, copies the counsellor's meeting link, and queues
   confirmation + 24-hour reminder messages. The client's page polls until it shows confirmed.
4. Unpaid holds expire (notifier). A payment that lands just after expiry still confirms if the
   slot is free; otherwise it's flagged on the admin page as a refund to process.

Refunds are done manually in the Razorpay dashboard; the `refund.processed` webhook updates the
payment. Counsellor payouts are manual in v1.

## Privacy rules (enforced in the database)

- Session notes: only the counsellor who wrote them. Not the client, not admins.
- Reports: the client sees a report only after the counsellor shares it.
- Certificates: the counsellor and admins only. Meeting links: the counsellor, and clients on
  their own confirmed bookings.
- Guest (anonymous) sessions can browse but cannot book or become counsellors.

## Testing

- Unit tests run with `pnpm test` (rules, Razorpay order creation and webhook signatures,
  notification wording, the order API route).
- Database behaviour: `psql "$TEST_DB_URL" -v ON_ERROR_STOP=1 -f packages/db/tests/counselling/rls.test.sql`
  against a disposable database with the migration applied. It switches between visitor,
  guest, client, counsellor, admin and service-role, and fails on any leak. Ends with
  `ALL COUNSELLING RLS TESTS PASSED`; everything is rolled back.
- Razorpay test mode: use `rzp_test_` keys and Razorpay's test cards/UPI.
