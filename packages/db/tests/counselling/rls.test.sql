-- Behavioural test for migration 043 (Career Diya counsellor platform, ADR-015).
--
-- Exercises RLS, column grants and the booking/payment RPCs as each kind of user.
-- Run against a disposable database that has the migration applied (it inserts fixtures
-- into auth.users), as a superuser:
--
--   psql "$TEST_DB_URL" -v ON_ERROR_STOP=1 -f packages/db/tests/counselling/rls.test.sql
--
-- Every check raises on failure, so a clean run ending in "ALL COUNSELLING RLS TESTS PASSED"
-- is the pass signal. Everything runs in one transaction that is rolled back at the end.

\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA IF NOT EXISTS cdtest;
GRANT USAGE ON SCHEMA cdtest TO anon, authenticated, service_role;

-- Act as a user: p_kind is 'user', 'guest' (anonymous sign-in), 'anon' (no session) or 'service'.
CREATE OR REPLACE FUNCTION cdtest.act(p_kind text, p_uid uuid DEFAULT NULL, p_email text DEFAULT NULL)
  RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    CASE WHEN p_uid IS NULL THEN ''
         ELSE json_build_object('sub', p_uid, 'email', p_email, 'role', 'authenticated',
                                'is_anonymous', p_kind = 'guest')::text END, true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  EXECUTE format('SET LOCAL ROLE %I', CASE p_kind WHEN 'anon' THEN 'anon'
                                                  WHEN 'service' THEN 'service_role'
                                                  ELSE 'authenticated' END);
END;
$$;
GRANT EXECUTE ON FUNCTION cdtest.act(text, uuid, text) TO anon, authenticated, service_role;

-- Asserts that a statement fails.
CREATE OR REPLACE FUNCTION cdtest.must_fail(p_sql text, p_label text)
  RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN others THEN
    RETURN;
  END;
  RAISE EXCEPTION 'FAIL: expected an error: %', p_label;
END;
$$;
GRANT EXECUTE ON FUNCTION cdtest.must_fail(text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION cdtest.check(p_ok boolean, p_label text)
  RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: %', p_label; END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION cdtest.check(boolean, text) TO anon, authenticated, service_role;

-- Fixtures (superuser).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.in'),
  ('00000000-0000-0000-0000-0000000000c1', 'c1@test.in'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@test.in'),
  ('00000000-0000-0000-0000-0000000000b1', 'u1@test.in'),
  ('00000000-0000-0000-0000-0000000000b2', 'u2@test.in'),
  ('00000000-0000-0000-0000-0000000000f1', NULL);
INSERT INTO core.cd_admin (user_id) VALUES ('00000000-0000-0000-0000-0000000000a1');

\set ADMIN '00000000-0000-0000-0000-0000000000a1'
\set C1 '00000000-0000-0000-0000-0000000000c1'
\set C2 '00000000-0000-0000-0000-0000000000c2'
\set U1 '00000000-0000-0000-0000-0000000000b1'
\set U2 '00000000-0000-0000-0000-0000000000b2'
\set GUEST '00000000-0000-0000-0000-0000000000f1'

-- 1. Counsellor onboarding ----------------------------------------------------------------
SELECT cdtest.act('user', :'C1', 'c1@test.in');
INSERT INTO core.cd_counsellor (user_id, display_name, session_fee_inr)
VALUES (:'C1', 'Counsellor One', 1500);
INSERT INTO core.cd_contact (user_id, meeting_link) VALUES (:'C1', 'https://meet.google.com/abc-defg-hij');
SELECT cdtest.check((SELECT status FROM core.cd_counsellor WHERE user_id = :'C1') = 'pending',
                    'new counsellor starts pending');
SELECT cdtest.must_fail($$UPDATE core.cd_counsellor SET status = 'verified'$$,
                        'counsellor cannot verify themselves');
SELECT cdtest.must_fail($$SELECT core.cd_set_counsellor_status(
                          (SELECT id FROM core.cd_counsellor LIMIT 1), 'verified')$$,
                        'non-admin cannot call cd_set_counsellor_status');
INSERT INTO core.cd_availability_slot (counsellor_id, starts_at, ends_at)
SELECT id, now() + interval '3 days', now() + interval '3 days 1 hour' FROM core.cd_counsellor;
INSERT INTO core.cd_availability_slot (counsellor_id, starts_at, ends_at)
SELECT id, now() + interval '4 days', now() + interval '4 days 1 hour' FROM core.cd_counsellor;
SELECT cdtest.must_fail($$INSERT INTO core.cd_availability_slot (counsellor_id, starts_at, ends_at)
  SELECT id, now() + interval '3 days 30 minutes', now() + interval '3 days 90 minutes'
  FROM core.cd_counsellor$$, 'overlapping slot is rejected');
SELECT cdtest.must_fail($$INSERT INTO core.cd_counsellor_certificate (counsellor_id, title, storage_path)
  SELECT id, 'Career guide', '00000000-0000-0000-0000-0000000000b1/x.pdf' FROM core.cd_counsellor$$,
  'certificate path must be in the counsellor''s own folder');
INSERT INTO core.cd_counsellor_certificate (counsellor_id, title, storage_path)
SELECT id, 'Career guide certification', :'C1' || '/cert.pdf' FROM core.cd_counsellor;
INSERT INTO storage.objects (bucket_id, name) VALUES ('cd-certificates', :'C1' || '/cert.pdf');
SELECT cdtest.must_fail($$INSERT INTO storage.objects (bucket_id, name)
  VALUES ('cd-certificates', '00000000-0000-0000-0000-0000000000b1/evil.pdf')$$,
  'cannot upload into another user''s folder');
RESET ROLE;

-- Not visible to the public while pending.
SELECT cdtest.act('anon');
SELECT cdtest.check((SELECT count(*) FROM core.cd_counsellor) = 0, 'pending counsellor hidden from public');
SELECT cdtest.check((SELECT count(*) FROM core.cd_availability_slot) = 0, 'pending counsellor slots hidden');
RESET ROLE;

-- 2. Admin verifies ----------------------------------------------------------------------
SELECT cdtest.act('user', :'ADMIN', 'admin@test.in');
SELECT cdtest.check((SELECT count(*) FROM core.cd_counsellor_certificate) = 1, 'admin sees certificates');
SELECT cdtest.check((SELECT count(*) FROM storage.objects WHERE bucket_id = 'cd-certificates') = 1,
                    'admin can read certificate files');
SELECT core.cd_set_counsellor_status(id, 'verified', 'looks good') FROM core.cd_counsellor;
SELECT cdtest.check((SELECT status_note IS NULL FROM core.cd_counsellor), 'verified profile carries no note');
RESET ROLE;

SELECT cdtest.act('anon');
SELECT cdtest.check((SELECT count(*) FROM core.cd_counsellor) = 1, 'verified counsellor is public');
SELECT cdtest.check((SELECT count(*) FROM core.cd_availability_slot) = 2, 'open slots are public');
SELECT cdtest.must_fail($$SELECT status_note FROM core.cd_counsellor$$, 'anon cannot read admin note column');
SELECT cdtest.must_fail($$SELECT meeting_link FROM core.cd_contact$$, 'anon cannot read meeting links');
SELECT cdtest.must_fail($$SELECT core.cd_book_slot((SELECT id FROM core.cd_availability_slot LIMIT 1), 'x')$$,
                        'anon cannot book');
RESET ROLE;

SELECT cdtest.act('user', :'U2', 'u2@test.in');
SELECT cdtest.check((SELECT count(*) FROM core.cd_contact) = 0, 'other users cannot see a counsellor''s contact');
SELECT cdtest.check((SELECT count(*) FROM core.cd_counsellor_certificate) = 0, 'clients cannot see certificates');
SELECT cdtest.check((SELECT count(*) FROM storage.objects) = 0, 'clients cannot read certificate files');
RESET ROLE;

-- 3. Booking ------------------------------------------------------------------------------
SELECT cdtest.act('guest', :'GUEST');
SELECT cdtest.must_fail($$SELECT core.cd_book_slot(
  (SELECT id FROM core.cd_availability_slot ORDER BY starts_at LIMIT 1), 'Guest')$$,
  'guest (anonymous) session cannot book');
RESET ROLE;

SELECT cdtest.act('user', :'C1', 'c1@test.in');
SELECT cdtest.must_fail($$SELECT core.cd_book_slot(
  (SELECT id FROM core.cd_availability_slot ORDER BY starts_at LIMIT 1), 'Me')$$,
  'counsellor cannot book own slot');
RESET ROLE;

SELECT cdtest.act('user', :'U1', 'u1@test.in');
CREATE TEMP TABLE b1 ON COMMIT DROP AS
SELECT * FROM core.cd_book_slot(
  (SELECT id FROM core.cd_availability_slot ORDER BY starts_at LIMIT 1),
  'Client One', '+919876543210', 'Choosing between BCom and BBA');
GRANT SELECT ON b1 TO authenticated, service_role;
SELECT cdtest.check((SELECT status = 'pending_payment' AND fee_inr = 1500 AND client_email = 'u1@test.in'
                     AND hold_expires_at > now() FROM b1), 'paid booking starts pending with a hold');
SELECT cdtest.must_fail($$UPDATE core.cd_booking SET status = 'confirmed'$$, 'client cannot confirm a booking');
SELECT cdtest.must_fail($$INSERT INTO core.cd_payment (booking_id, provider_order_id, amount_paise)
  SELECT id, 'order_fake', 150000 FROM b1$$, 'client cannot insert payments');
SELECT cdtest.must_fail($$SELECT core.cd_attach_payment_order((SELECT id FROM b1), 'order_1', 100)$$,
                        'order amount must match fee');
SELECT core.cd_attach_payment_order((SELECT id FROM b1), 'order_1', 150000);
SELECT cdtest.check((SELECT count(*) FROM core.cd_payment) = 1, 'client sees own payment');
RESET ROLE;

SELECT cdtest.act('anon');
SELECT cdtest.check((SELECT count(*) FROM core.cd_availability_slot) = 1, 'held slot leaves the public list');
RESET ROLE;

SELECT cdtest.act('user', :'U2', 'u2@test.in');
SELECT cdtest.check((SELECT count(*) FROM core.cd_booking) = 0, 'other client cannot see the booking');
SELECT cdtest.check((SELECT count(*) FROM core.cd_payment) = 0, 'other client cannot see the payment');
SELECT cdtest.must_fail($$SELECT core.cd_book_slot((SELECT id FROM b1)::uuid, 'x')$$, 'bad slot id fails');
SELECT cdtest.must_fail($$SELECT core.cd_attach_payment_order((SELECT id FROM b1), 'order_x', 150000)$$,
                        'cannot pay for someone else''s booking');
RESET ROLE;

SELECT cdtest.act('user', :'C1', 'c1@test.in');
SELECT cdtest.check((SELECT count(*) FROM core.cd_booking) = 1, 'counsellor sees the booking');
SELECT cdtest.check((SELECT count(*) FROM core.cd_payment) = 0, 'counsellor does not see payment rows');
RESET ROLE;

-- 4. Webhook confirms ----------------------------------------------------------------------
SELECT cdtest.act('user', :'U1', 'u1@test.in');
SELECT cdtest.must_fail($$SELECT core.cd_apply_payment_event('evt_x','payment.captured','order_1','pay_1',150000,NULL,'{}')$$,
                        'users cannot call the webhook RPC');
RESET ROLE;

SELECT cdtest.act('service');
SELECT cdtest.check(core.cd_apply_payment_event('evt_1', 'payment.captured', 'order_1', 'pay_1', 150000, NULL, '{}')
                    = 'confirmed', 'captured payment confirms booking');
SELECT cdtest.check(core.cd_apply_payment_event('evt_1', 'payment.captured', 'order_1', 'pay_1', 150000, NULL, '{}')
                    = 'duplicate', 'replayed event is ignored');
SELECT cdtest.check(core.cd_apply_payment_event('evt_2', 'order.paid', 'order_1', 'pay_1', 150000, NULL, '{}')
                    = 'already_paid', 'second success event is a no-op');
SELECT cdtest.check(core.cd_apply_payment_event('evt_3', 'payment.captured', 'order_nope', 'pay_9', 100, NULL, '{}')
                    = 'unknown_order', 'unknown order is recorded, not applied');
SELECT cdtest.check((SELECT status = 'confirmed' AND meeting_link = 'https://meet.google.com/abc-defg-hij'
                     FROM core.cd_booking WHERE id = (SELECT id FROM b1)),
                    'booking confirmed with the counsellor''s meeting link');
SELECT cdtest.check((SELECT status FROM core.cd_availability_slot WHERE id = (SELECT slot_id FROM b1)) = 'booked',
                    'slot is booked');
SELECT cdtest.check((SELECT count(*) FROM core.cd_notification WHERE template = 'booking_confirmed') = 4,
                    'confirmation queued for client and counsellor on both channels');
SELECT cdtest.check((SELECT count(*) FROM core.cd_notification WHERE template = 'reminder_24h') = 4,
                    'reminders queued');
RESET ROLE;

SELECT cdtest.act('user', :'U1', 'u1@test.in');
SELECT cdtest.must_fail($$SELECT count(*) FROM core.cd_notification$$, 'notification outbox is not readable');
SELECT cdtest.must_fail($$SELECT core.cd_cancel_booking((SELECT id FROM b1))$$,
                        'client cannot cancel a paid session themselves');
RESET ROLE;

-- 5. Notes and reports ---------------------------------------------------------------------
SELECT cdtest.act('user', :'C1', 'c1@test.in');
INSERT INTO core.cd_session_note (booking_id, counsellor_id, body)
SELECT id, counsellor_id, 'Anxious about parents'' expectations.' FROM b1;
INSERT INTO core.cd_report (booking_id, counsellor_id, client_id, title, content)
SELECT id, counsellor_id, client_id, 'Your session summary', '[{"key":"x","title":"X","body":"Y"}]' FROM b1;
SELECT cdtest.check((SELECT count(*) FROM core.cd_report_template) = 2, 'counsellor sees system templates');
SELECT cdtest.must_fail($$UPDATE core.cd_report SET attachment_path = '00000000-0000-0000-0000-0000000000c2/other.pdf'$$,
                        'report attachment must be in the counsellor''s own folder');
UPDATE core.cd_report SET attachment_path = :'C1' || '/' || (SELECT id FROM b1) || '/report.pdf';
INSERT INTO storage.objects (bucket_id, name)
SELECT 'cd-reports', attachment_path FROM core.cd_report;
RESET ROLE;

SELECT cdtest.act('user', :'U1', 'u1@test.in');
SELECT cdtest.check((SELECT count(*) FROM core.cd_session_note) = 0, 'client cannot read session notes');
SELECT cdtest.check((SELECT count(*) FROM core.cd_report) = 0, 'client cannot read a draft report');
SELECT cdtest.check((SELECT count(*) FROM storage.objects) = 0, 'client cannot download a draft report''s PDF');
SELECT cdtest.check((SELECT count(*) FROM core.cd_report_template) = 0, 'clients do not see templates');
RESET ROLE;

SELECT cdtest.act('user', :'ADMIN', 'admin@test.in');
SELECT cdtest.check((SELECT count(*) FROM core.cd_session_note) = 0, 'admin cannot read session notes');
SELECT cdtest.check((SELECT count(*) FROM core.cd_booking) = 1, 'admin sees bookings');
SELECT cdtest.check((SELECT count(*) FROM core.cd_payment) = 1, 'admin sees payments');
RESET ROLE;

SELECT cdtest.act('user', :'C1', 'c1@test.in');
UPDATE core.cd_report SET status = 'shared';
SELECT cdtest.check((SELECT shared_at IS NOT NULL FROM core.cd_report), 'sharing stamps shared_at');
RESET ROLE;

SELECT cdtest.act('user', :'U1', 'u1@test.in');
SELECT cdtest.check((SELECT count(*) FROM core.cd_report) = 1, 'client reads a shared report');
SELECT cdtest.check((SELECT count(*) FROM storage.objects WHERE bucket_id = 'cd-reports') = 1,
                    'client can download the shared report''s PDF');
RESET ROLE;

SELECT cdtest.act('user', :'U2', 'u2@test.in');
SELECT cdtest.check((SELECT count(*) FROM storage.objects) = 0, 'other clients cannot download it');
RESET ROLE;

-- A second counsellor cannot write onto the first counsellor's booking.
SELECT cdtest.act('user', :'C2', 'c2@test.in');
INSERT INTO core.cd_counsellor (user_id, display_name, session_fee_inr) VALUES (:'C2', 'Counsellor Two', 0);
SELECT cdtest.must_fail($$INSERT INTO core.cd_session_note (booking_id, counsellor_id, body)
  SELECT id, (SELECT core.cd_my_counsellor_id()), 'sneaky' FROM b1$$,
  'another counsellor cannot add notes to the booking');
SELECT cdtest.check((SELECT count(*) FROM core.cd_booking) = 0, 'another counsellor cannot see the booking');
INSERT INTO core.cd_availability_slot (counsellor_id, starts_at, ends_at)
VALUES (core.cd_my_counsellor_id(), now() + interval '2 days', now() + interval '2 days 45 minutes');
RESET ROLE;

-- 6. Free sessions confirm immediately ------------------------------------------------------
SELECT cdtest.act('user', :'ADMIN', 'admin@test.in');
SELECT core.cd_set_counsellor_status(id, 'verified') FROM core.cd_counsellor WHERE user_id = :'C2';
RESET ROLE;

SELECT cdtest.act('user', :'U2', 'u2@test.in');
SELECT cdtest.check((SELECT status FROM core.cd_book_slot(
  (SELECT s.id FROM core.cd_availability_slot s JOIN core.cd_counsellor c ON c.id = s.counsellor_id
   WHERE c.user_id = :'C2'), 'Client Two')) = 'confirmed', 'free session is confirmed straight away');
RESET ROLE;

-- 7. Counsellor cancels a confirmed session -------------------------------------------------
SELECT cdtest.act('user', :'C1', 'c1@test.in');
SELECT cdtest.check((SELECT status FROM core.cd_cancel_booking((SELECT id FROM b1), 'Unwell')) = 'cancelled',
                    'counsellor can cancel');
SELECT cdtest.check((SELECT status FROM core.cd_availability_slot WHERE id = (SELECT slot_id FROM b1)) = 'open',
                    'cancelled future slot reopens');
RESET ROLE;

SELECT cdtest.act('service');
SELECT cdtest.check((SELECT count(*) FROM core.cd_notification
                     WHERE booking_id = (SELECT id FROM b1) AND template = 'reminder_24h') = 0,
                    'pending reminders are removed on cancel');
SELECT cdtest.check((SELECT count(*) FROM core.cd_notification
                     WHERE booking_id = (SELECT id FROM b1) AND template = 'booking_cancelled') = 4,
                    'cancellation messages queued');
RESET ROLE;

-- 8. Hold expiry and a late payment ---------------------------------------------------------
SELECT cdtest.act('user', :'U2', 'u2@test.in');
CREATE TEMP TABLE b2 ON COMMIT DROP AS
SELECT * FROM core.cd_book_slot(
  (SELECT s.id FROM core.cd_availability_slot s JOIN core.cd_counsellor c ON c.id = s.counsellor_id
   WHERE c.user_id = :'C1' ORDER BY s.starts_at DESC LIMIT 1), 'Client Two');
GRANT SELECT ON b2 TO authenticated, service_role;
SELECT core.cd_attach_payment_order((SELECT id FROM b2), 'order_2', 150000);
RESET ROLE;

UPDATE core.cd_booking SET hold_expires_at = now() - interval '1 minute' WHERE id = (SELECT id FROM b2);

SELECT cdtest.act('service');
SELECT cdtest.check(core.cd_release_expired_holds() = 1, 'expired hold is released');
SELECT cdtest.check((SELECT status FROM core.cd_booking WHERE id = (SELECT id FROM b2)) = 'expired',
                    'unpaid booking expires');
SELECT cdtest.check(core.cd_apply_payment_event('evt_9', 'payment.captured', 'order_2', 'pay_2', 150000, NULL, '{}')
                    = 'confirmed_late', 'late payment still confirms when the slot is free');
SELECT cdtest.check(core.cd_apply_payment_event('evt_10', 'payment.failed', 'order_2', 'pay_3', 150000, 'card declined', '{}')
                    = 'failed', 'failure event recorded');
SELECT cdtest.check((SELECT status FROM core.cd_payment WHERE provider_order_id = 'order_2') = 'paid',
                    'a later failure event never un-pays a captured payment');
RESET ROLE;

SELECT 'ALL COUNSELLING RLS TESTS PASSED' AS result;
ROLLBACK;
