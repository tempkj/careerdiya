-- 043: Career Diya counsellor platform (MVP) — ADR-015
--
-- Roles: client (any signed-in, non-anonymous user), counsellor (has a cd_counsellor row),
-- admin (row in cd_admin, granted by SQL only).
--
-- RLS is the boundary (invariant A5). Anything that crosses owners (booking a counsellor's
-- slot, confirming a payment, verifying a counsellor) goes through a SECURITY DEFINER RPC
-- that checks auth.uid() itself. Clients never get UPDATE on bookings, slots or payments.
--
-- Every DDL statement is schema-qualified (see CLAUDE.md: search_path does not include core).
-- The schema's default privileges give `authenticated` full DML on new core tables, so each
-- table below REVOKEs everything first and then grants exactly what it needs.

-- ── Helpers ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS core.cd_admin (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- True for a signed-in user who is not an anonymous (guest) session.
CREATE OR REPLACE FUNCTION core.cd_is_real_user()
  RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL
     AND coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;

CREATE OR REPLACE FUNCTION core.cd_is_admin()
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM core.cd_admin a WHERE a.user_id = auth.uid());
$$;

-- ── Contact details (phone for WhatsApp) — owner only ───────────────────────

CREATE TABLE IF NOT EXISTS core.cd_contact (
  user_id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_e164      text CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  whatsapp_opt_in boolean NOT NULL DEFAULT false,
  -- A counsellor's default Google Meet / Zoom link. Kept here, not on cd_counsellor,
  -- because counsellor profiles are public.
  meeting_link    text CHECK (meeting_link IS NULL OR meeting_link ~ '^https://'),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Counsellor profile ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS core.cd_counsellor (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name     text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 120),
  headline         text CHECK (headline IS NULL OR char_length(headline) <= 160),
  bio              text CHECK (bio IS NULL OR char_length(bio) <= 4000),
  city             text CHECK (city IS NULL OR char_length(city) <= 80),
  languages        text[] NOT NULL DEFAULT '{}',
  specialisations  text[] NOT NULL DEFAULT '{}',
  session_mode     text NOT NULL DEFAULT 'online' CHECK (session_mode IN ('online','in_person','both')),
  session_fee_inr  integer NOT NULL DEFAULT 0 CHECK (session_fee_inr BETWEEN 0 AND 100000),
  session_minutes  integer NOT NULL DEFAULT 60 CHECK (session_minutes BETWEEN 15 AND 240),
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','verified','suspended','rejected')),
  status_note      text,
  verified_at      timestamptz,
  verified_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cd_counsellor_status ON core.cd_counsellor(status);

CREATE OR REPLACE FUNCTION core.cd_my_counsellor_id()
  RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c.id FROM core.cd_counsellor c WHERE c.user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION core.cd_user_role()
  RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN 'anonymous'
    WHEN EXISTS (SELECT 1 FROM core.cd_admin a WHERE a.user_id = auth.uid()) THEN 'admin'
    WHEN EXISTS (SELECT 1 FROM core.cd_counsellor c WHERE c.user_id = auth.uid()) THEN 'counsellor'
    ELSE 'client'
  END;
$$;

CREATE TABLE IF NOT EXISTS core.cd_counsellor_certificate (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  counsellor_id uuid NOT NULL REFERENCES core.cd_counsellor(id) ON DELETE CASCADE,
  title         text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 200),
  issuer        text CHECK (issuer IS NULL OR char_length(issuer) <= 200),
  issued_on     date,
  storage_path  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cd_certificate_counsellor ON core.cd_counsellor_certificate(counsellor_id);

-- ── Availability ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS core.cd_availability_slot (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  counsellor_id uuid NOT NULL REFERENCES core.cd_counsellor(id) ON DELETE CASCADE,
  starts_at     timestamptz NOT NULL,
  ends_at       timestamptz NOT NULL,
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open','held','booked','cancelled')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (ends_at - starts_at <= interval '4 hours')
);

CREATE INDEX IF NOT EXISTS idx_cd_slot_counsellor_start
  ON core.cd_availability_slot(counsellor_id, starts_at);

-- A counsellor's live slots may not overlap.
CREATE OR REPLACE FUNCTION core.cd_prevent_slot_overlap()
  RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.status <> 'cancelled' AND EXISTS (
    SELECT 1 FROM core.cd_availability_slot s
    WHERE s.counsellor_id = NEW.counsellor_id
      AND s.id <> NEW.id
      AND s.status <> 'cancelled'
      AND s.starts_at < NEW.ends_at
      AND NEW.starts_at < s.ends_at
  ) THEN
    RAISE EXCEPTION 'This slot overlaps another of your slots.' USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cd_slot_no_overlap ON core.cd_availability_slot;
CREATE TRIGGER cd_slot_no_overlap
  BEFORE INSERT OR UPDATE OF starts_at, ends_at, status ON core.cd_availability_slot
  FOR EACH ROW EXECUTE FUNCTION core.cd_prevent_slot_overlap();

-- ── Bookings and payments ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS core.cd_booking (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id         uuid NOT NULL REFERENCES core.cd_availability_slot(id) ON DELETE RESTRICT,
  counsellor_id   uuid NOT NULL REFERENCES core.cd_counsellor(id) ON DELETE RESTRICT,
  client_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name     text NOT NULL CHECK (char_length(client_name) BETWEEN 1 AND 120),
  client_email    text,
  client_phone    text CHECK (client_phone IS NULL OR client_phone ~ '^\+[1-9][0-9]{7,14}$'),
  purpose         text CHECK (purpose IS NULL OR char_length(purpose) <= 1000),
  status          text NOT NULL DEFAULT 'pending_payment'
                    CHECK (status IN ('pending_payment','confirmed','completed','cancelled','expired')),
  fee_inr         integer NOT NULL CHECK (fee_inr >= 0),
  hold_expires_at timestamptz,
  meeting_link    text CHECK (meeting_link IS NULL OR meeting_link ~ '^https://'),
  confirmed_at    timestamptz,
  cancelled_at    timestamptz,
  cancelled_by    text CHECK (cancelled_by IS NULL OR cancelled_by IN ('client','counsellor','admin','system')),
  cancel_reason   text CHECK (cancel_reason IS NULL OR char_length(cancel_reason) <= 500),
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- One live booking per slot.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cd_booking_live_slot
  ON core.cd_booking(slot_id) WHERE status IN ('pending_payment','confirmed','completed');
CREATE INDEX IF NOT EXISTS idx_cd_booking_client ON core.cd_booking(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cd_booking_counsellor ON core.cd_booking(counsellor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS core.cd_payment (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id          uuid NOT NULL REFERENCES core.cd_booking(id) ON DELETE RESTRICT,
  provider            text NOT NULL DEFAULT 'razorpay' CHECK (provider IN ('razorpay')),
  provider_order_id   text NOT NULL UNIQUE,
  provider_payment_id text,
  amount_paise        integer NOT NULL CHECK (amount_paise > 0),
  currency            text NOT NULL DEFAULT 'INR',
  status              text NOT NULL DEFAULT 'created' CHECK (status IN ('created','paid','failed','refunded')),
  failure_reason      text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cd_payment_booking ON core.cd_payment(booking_id);

-- Raw webhook events, for idempotency and audit. Service role only.
CREATE TABLE IF NOT EXISTS core.cd_payment_event (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_event_id text NOT NULL UNIQUE,
  event_type        text NOT NULL,
  payload           jsonb NOT NULL,
  outcome           text,
  received_at       timestamptz NOT NULL DEFAULT now()
);

-- ── Session notes (counsellor only) and reports ─────────────────────────────

CREATE TABLE IF NOT EXISTS core.cd_session_note (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    uuid NOT NULL REFERENCES core.cd_booking(id) ON DELETE CASCADE,
  counsellor_id uuid NOT NULL REFERENCES core.cd_counsellor(id) ON DELETE CASCADE,
  body          text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 20000),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cd_note_booking ON core.cd_session_note(booking_id, created_at);

CREATE TABLE IF NOT EXISTS core.cd_report_template (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  counsellor_id uuid REFERENCES core.cd_counsellor(id) ON DELETE CASCADE, -- NULL = system template
  name          text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  description   text CHECK (description IS NULL OR char_length(description) <= 500),
  sections      jsonb NOT NULL CHECK (jsonb_typeof(sections) = 'array'),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS core.cd_report (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      uuid NOT NULL UNIQUE REFERENCES core.cd_booking(id) ON DELETE CASCADE,
  counsellor_id   uuid NOT NULL REFERENCES core.cd_counsellor(id) ON DELETE CASCADE,
  client_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id     uuid REFERENCES core.cd_report_template(id) ON DELETE SET NULL,
  title           text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 200),
  content         jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(content) = 'array'),
  attachment_path text,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','shared')),
  shared_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cd_report_client ON core.cd_report(client_id, status);

-- counsellor_id / client_id on notes and reports always come from the booking, so a
-- counsellor cannot attach a note or report to someone else's booking or client.
CREATE OR REPLACE FUNCTION core.cd_fill_from_booking()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_booking core.cd_booking%ROWTYPE;
BEGIN
  SELECT * INTO v_booking FROM core.cd_booking b WHERE b.id = NEW.booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found.' USING ERRCODE = '23503';
  END IF;
  IF v_booking.counsellor_id IS DISTINCT FROM core.cd_my_counsellor_id() THEN
    RAISE EXCEPTION 'Not your booking.' USING ERRCODE = '42501';
  END IF;
  NEW.counsellor_id := v_booking.counsellor_id;
  IF TG_TABLE_NAME = 'cd_report' THEN
    NEW.client_id := v_booking.client_id;
    IF NEW.status = 'shared' AND NEW.shared_at IS NULL THEN
      NEW.shared_at := now();
    ELSIF NEW.status = 'draft' THEN
      NEW.shared_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cd_note_fill ON core.cd_session_note;
CREATE TRIGGER cd_note_fill BEFORE INSERT OR UPDATE ON core.cd_session_note
  FOR EACH ROW EXECUTE FUNCTION core.cd_fill_from_booking();

DROP TRIGGER IF EXISTS cd_report_fill ON core.cd_report;
CREATE TRIGGER cd_report_fill BEFORE INSERT OR UPDATE ON core.cd_report
  FOR EACH ROW EXECUTE FUNCTION core.cd_fill_from_booking();

-- ── Notification outbox (service role only) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS core.cd_notification (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        uuid REFERENCES core.cd_booking(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_role    text NOT NULL CHECK (recipient_role IN ('client','counsellor')),
  channel           text NOT NULL CHECK (channel IN ('email','whatsapp')),
  template          text NOT NULL CHECK (template IN ('booking_confirmed','booking_cancelled','reminder_24h')),
  status            text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','skipped')),
  attempts          integer NOT NULL DEFAULT 0,
  last_error        text,
  send_after        timestamptz NOT NULL DEFAULT now(),
  sent_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, recipient_user_id, channel, template)
);

CREATE INDEX IF NOT EXISTS idx_cd_notification_due
  ON core.cd_notification(status, send_after);

-- ── updated_at stamps ───────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS set_updated_at ON core.cd_contact;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON core.cd_contact
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON core.cd_counsellor;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON core.cd_counsellor
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON core.cd_availability_slot;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON core.cd_availability_slot
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON core.cd_booking;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON core.cd_booking
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON core.cd_payment;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON core.cd_payment
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON core.cd_session_note;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON core.cd_session_note
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON core.cd_report_template;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON core.cd_report_template
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON core.cd_report;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON core.cd_report
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

-- ── Row Level Security ──────────────────────────────────────────────────────

ALTER TABLE core.cd_admin                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.cd_contact                ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.cd_counsellor             ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.cd_counsellor_certificate ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.cd_availability_slot      ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.cd_booking                ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.cd_payment                ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.cd_payment_event          ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.cd_session_note           ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.cd_report_template        ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.cd_report                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.cd_notification           ENABLE ROW LEVEL SECURITY;

ALTER TABLE core.cd_admin                  FORCE ROW LEVEL SECURITY;
ALTER TABLE core.cd_contact                FORCE ROW LEVEL SECURITY;
ALTER TABLE core.cd_counsellor             FORCE ROW LEVEL SECURITY;
ALTER TABLE core.cd_counsellor_certificate FORCE ROW LEVEL SECURITY;
ALTER TABLE core.cd_availability_slot      FORCE ROW LEVEL SECURITY;
ALTER TABLE core.cd_booking                FORCE ROW LEVEL SECURITY;
ALTER TABLE core.cd_payment                FORCE ROW LEVEL SECURITY;
ALTER TABLE core.cd_payment_event          FORCE ROW LEVEL SECURITY;
ALTER TABLE core.cd_session_note           FORCE ROW LEVEL SECURITY;
ALTER TABLE core.cd_report_template        FORCE ROW LEVEL SECURITY;
ALTER TABLE core.cd_report                 FORCE ROW LEVEL SECURITY;
ALTER TABLE core.cd_notification           FORCE ROW LEVEL SECURITY;

-- cd_admin: a user can see whether they are an admin. No writes from the API.
DROP POLICY IF EXISTS cd_admin_self ON core.cd_admin;
CREATE POLICY cd_admin_self ON core.cd_admin
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- cd_contact: owner only.
DROP POLICY IF EXISTS cd_contact_owner ON core.cd_contact;
CREATE POLICY cd_contact_owner ON core.cd_contact
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND core.cd_is_real_user());

-- cd_counsellor
DROP POLICY IF EXISTS cd_counsellor_public_read ON core.cd_counsellor;
CREATE POLICY cd_counsellor_public_read ON core.cd_counsellor
  FOR SELECT TO anon, authenticated USING (status = 'verified');
DROP POLICY IF EXISTS cd_counsellor_owner_read ON core.cd_counsellor;
CREATE POLICY cd_counsellor_owner_read ON core.cd_counsellor
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS cd_counsellor_admin_read ON core.cd_counsellor;
CREATE POLICY cd_counsellor_admin_read ON core.cd_counsellor
  FOR SELECT TO authenticated USING (core.cd_is_admin());
DROP POLICY IF EXISTS cd_counsellor_owner_insert ON core.cd_counsellor;
CREATE POLICY cd_counsellor_owner_insert ON core.cd_counsellor
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND core.cd_is_real_user()
              AND status = 'pending' AND verified_at IS NULL AND verified_by IS NULL);
DROP POLICY IF EXISTS cd_counsellor_owner_update ON core.cd_counsellor;
CREATE POLICY cd_counsellor_owner_update ON core.cd_counsellor
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- cd_counsellor_certificate: the counsellor and admins.
DROP POLICY IF EXISTS cd_certificate_owner ON core.cd_counsellor_certificate;
CREATE POLICY cd_certificate_owner ON core.cd_counsellor_certificate
  FOR ALL TO authenticated
  USING (counsellor_id = core.cd_my_counsellor_id())
  WITH CHECK (counsellor_id = core.cd_my_counsellor_id()
              AND split_part(storage_path, '/', 1) = auth.uid()::text);
DROP POLICY IF EXISTS cd_certificate_admin_read ON core.cd_counsellor_certificate;
CREATE POLICY cd_certificate_admin_read ON core.cd_counsellor_certificate
  FOR SELECT TO authenticated USING (core.cd_is_admin());

-- cd_availability_slot
DROP POLICY IF EXISTS cd_slot_public_read ON core.cd_availability_slot;
CREATE POLICY cd_slot_public_read ON core.cd_availability_slot
  FOR SELECT TO anon, authenticated
  USING (status = 'open' AND starts_at > now() AND EXISTS (
    SELECT 1 FROM core.cd_counsellor c
    WHERE c.id = cd_availability_slot.counsellor_id AND c.status = 'verified'));
DROP POLICY IF EXISTS cd_slot_owner_read ON core.cd_availability_slot;
CREATE POLICY cd_slot_owner_read ON core.cd_availability_slot
  FOR SELECT TO authenticated USING (counsellor_id = core.cd_my_counsellor_id());
DROP POLICY IF EXISTS cd_slot_booking_party_read ON core.cd_availability_slot;
CREATE POLICY cd_slot_booking_party_read ON core.cd_availability_slot
  FOR SELECT TO authenticated USING (
    core.cd_is_admin() OR EXISTS (
      SELECT 1 FROM core.cd_booking b
      WHERE b.slot_id = cd_availability_slot.id AND b.client_id = auth.uid()));
DROP POLICY IF EXISTS cd_slot_owner_insert ON core.cd_availability_slot;
CREATE POLICY cd_slot_owner_insert ON core.cd_availability_slot
  FOR INSERT TO authenticated
  WITH CHECK (counsellor_id = core.cd_my_counsellor_id() AND status = 'open' AND starts_at > now());
-- A counsellor may edit or cancel only slots nobody has booked.
DROP POLICY IF EXISTS cd_slot_owner_update ON core.cd_availability_slot;
CREATE POLICY cd_slot_owner_update ON core.cd_availability_slot
  FOR UPDATE TO authenticated
  USING (counsellor_id = core.cd_my_counsellor_id() AND status = 'open')
  WITH CHECK (counsellor_id = core.cd_my_counsellor_id() AND status IN ('open','cancelled'));
DROP POLICY IF EXISTS cd_slot_owner_delete ON core.cd_availability_slot;
CREATE POLICY cd_slot_owner_delete ON core.cd_availability_slot
  FOR DELETE TO authenticated
  USING (counsellor_id = core.cd_my_counsellor_id() AND status IN ('open','cancelled')
         AND NOT EXISTS (SELECT 1 FROM core.cd_booking b WHERE b.slot_id = cd_availability_slot.id));

-- cd_booking: read by the client, the counsellor, admins. Writes via RPCs, except the
-- counsellor may change the meeting link on their own booking (column grant below).
DROP POLICY IF EXISTS cd_booking_party_read ON core.cd_booking;
CREATE POLICY cd_booking_party_read ON core.cd_booking
  FOR SELECT TO authenticated
  USING (client_id = auth.uid() OR counsellor_id = core.cd_my_counsellor_id() OR core.cd_is_admin());
DROP POLICY IF EXISTS cd_booking_counsellor_link ON core.cd_booking;
CREATE POLICY cd_booking_counsellor_link ON core.cd_booking
  FOR UPDATE TO authenticated
  USING (counsellor_id = core.cd_my_counsellor_id() AND status IN ('pending_payment','confirmed'))
  WITH CHECK (counsellor_id = core.cd_my_counsellor_id());

-- cd_payment: client and admins read; nobody writes through the API.
DROP POLICY IF EXISTS cd_payment_read ON core.cd_payment;
CREATE POLICY cd_payment_read ON core.cd_payment
  FOR SELECT TO authenticated
  USING (core.cd_is_admin() OR EXISTS (
    SELECT 1 FROM core.cd_booking b
    WHERE b.id = cd_payment.booking_id AND b.client_id = auth.uid()));

-- cd_session_note: ONLY the counsellor who owns the booking. Not the client, not admins.
DROP POLICY IF EXISTS cd_note_counsellor ON core.cd_session_note;
CREATE POLICY cd_note_counsellor ON core.cd_session_note
  FOR ALL TO authenticated
  USING (counsellor_id = core.cd_my_counsellor_id())
  WITH CHECK (counsellor_id = core.cd_my_counsellor_id());

-- cd_report_template: system templates readable by counsellors; own templates editable.
DROP POLICY IF EXISTS cd_template_read ON core.cd_report_template;
CREATE POLICY cd_template_read ON core.cd_report_template
  FOR SELECT TO authenticated
  USING ((counsellor_id IS NULL AND core.cd_my_counsellor_id() IS NOT NULL)
         OR counsellor_id = core.cd_my_counsellor_id());
DROP POLICY IF EXISTS cd_template_owner_write ON core.cd_report_template;
CREATE POLICY cd_template_owner_write ON core.cd_report_template
  FOR ALL TO authenticated
  USING (counsellor_id = core.cd_my_counsellor_id())
  WITH CHECK (counsellor_id = core.cd_my_counsellor_id());

-- cd_report: counsellor writes; the client reads it once shared. An attachment must sit in
-- the counsellor's own storage folder, so a report can't expose someone else's file.
DROP POLICY IF EXISTS cd_report_counsellor ON core.cd_report;
CREATE POLICY cd_report_counsellor ON core.cd_report
  FOR ALL TO authenticated
  USING (counsellor_id = core.cd_my_counsellor_id())
  WITH CHECK (counsellor_id = core.cd_my_counsellor_id()
              AND (attachment_path IS NULL OR split_part(attachment_path, '/', 1) = auth.uid()::text));
DROP POLICY IF EXISTS cd_report_client_read ON core.cd_report;
CREATE POLICY cd_report_client_read ON core.cd_report
  FOR SELECT TO authenticated USING (client_id = auth.uid() AND status = 'shared');

-- cd_payment_event, cd_notification: RLS on, no policies → service role only.

-- ── Grants ──────────────────────────────────────────────────────────────────
-- Undo the schema default privileges, then grant exactly what the policies need.

REVOKE ALL ON core.cd_admin, core.cd_contact, core.cd_counsellor, core.cd_counsellor_certificate,
  core.cd_availability_slot, core.cd_booking, core.cd_payment, core.cd_payment_event,
  core.cd_session_note, core.cd_report_template, core.cd_report, core.cd_notification
  FROM anon, authenticated, careerasana_app, careerasana_worker, careerasana_readonly;

GRANT USAGE ON SCHEMA core TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.cd_admin, core.cd_contact, core.cd_counsellor,
  core.cd_counsellor_certificate, core.cd_availability_slot, core.cd_booking, core.cd_payment,
  core.cd_payment_event, core.cd_session_note, core.cd_report_template, core.cd_report,
  core.cd_notification
  TO service_role;

GRANT SELECT ON core.cd_admin TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.cd_contact TO authenticated;

-- Visitors see the public profile columns only (no admin note, no verifier id).
GRANT SELECT (id, user_id, display_name, headline, bio, city, languages, specialisations,
              session_mode, session_fee_inr, session_minutes, status, verified_at, created_at)
  ON core.cd_counsellor TO anon;
GRANT SELECT ON core.cd_counsellor TO authenticated;
GRANT INSERT (user_id, display_name, headline, bio, city, languages, specialisations,
              session_mode, session_fee_inr, session_minutes)
  ON core.cd_counsellor TO authenticated;
-- status / verified_* are not updatable by counsellors: only cd_set_counsellor_status.
GRANT UPDATE (display_name, headline, bio, city, languages, specialisations,
              session_mode, session_fee_inr, session_minutes)
  ON core.cd_counsellor TO authenticated;

GRANT SELECT, INSERT, DELETE ON core.cd_counsellor_certificate TO authenticated;

GRANT SELECT ON core.cd_availability_slot TO anon, authenticated;
GRANT INSERT (counsellor_id, starts_at, ends_at) ON core.cd_availability_slot TO authenticated;
GRANT UPDATE (starts_at, ends_at, status) ON core.cd_availability_slot TO authenticated;
GRANT DELETE ON core.cd_availability_slot TO authenticated;

GRANT SELECT ON core.cd_booking TO authenticated;
GRANT UPDATE (meeting_link) ON core.cd_booking TO authenticated;

GRANT SELECT ON core.cd_payment TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON core.cd_session_note TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.cd_report_template TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.cd_report TO authenticated;

-- ── Notifications (internal) ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION core.cd_enqueue_booking_notifications(p_booking_id uuid, p_template text)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_client     uuid;
  v_counsellor uuid;
  v_starts     timestamptz;
  v_after      timestamptz := now();
BEGIN
  SELECT b.client_id, c.user_id, s.starts_at INTO v_client, v_counsellor, v_starts
  FROM core.cd_booking b
  JOIN core.cd_counsellor c ON c.id = b.counsellor_id
  JOIN core.cd_availability_slot s ON s.id = b.slot_id
  WHERE b.id = p_booking_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF p_template = 'reminder_24h' THEN
    -- Booked less than a day ahead: the confirmation is the reminder.
    IF v_starts - interval '24 hours' <= now() THEN RETURN; END IF;
    v_after := v_starts - interval '24 hours';
  END IF;

  INSERT INTO core.cd_notification (booking_id, recipient_user_id, recipient_role, channel, template, send_after)
  SELECT p_booking_id, r.uid, r.role, ch.channel, p_template, v_after
  FROM (VALUES (v_client, 'client'), (v_counsellor, 'counsellor')) AS r(uid, role)
  CROSS JOIN (VALUES ('email'), ('whatsapp')) AS ch(channel)
  ON CONFLICT (booking_id, recipient_user_id, channel, template) DO NOTHING;
END;
$$;

-- Confirms a booking, books its slot, copies the counsellor's meeting link, queues messages.
CREATE OR REPLACE FUNCTION core.cd_confirm_booking_internal(p_booking_id uuid)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE core.cd_booking b
     SET status = 'confirmed',
         confirmed_at = now(),
         hold_expires_at = NULL,
         meeting_link = coalesce(b.meeting_link, (
           SELECT ct.meeting_link FROM core.cd_counsellor c
           JOIN core.cd_contact ct ON ct.user_id = c.user_id
           WHERE c.id = b.counsellor_id))
   WHERE b.id = p_booking_id;

  UPDATE core.cd_availability_slot s
     SET status = 'booked'
    FROM core.cd_booking b
   WHERE b.id = p_booking_id AND s.id = b.slot_id;

  PERFORM core.cd_enqueue_booking_notifications(p_booking_id, 'booking_confirmed');
  PERFORM core.cd_enqueue_booking_notifications(p_booking_id, 'reminder_24h');
END;
$$;

-- Expires unpaid holds and reopens their slots. Returns how many were released.
CREATE OR REPLACE FUNCTION core.cd_release_expired_holds()
  RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_count integer;
BEGIN
  WITH expired AS (
    UPDATE core.cd_booking b
       SET status = 'expired', cancelled_at = now(), cancelled_by = 'system',
           cancel_reason = 'Payment not completed in time.'
     WHERE b.status = 'pending_payment' AND b.hold_expires_at < now()
    RETURNING b.slot_id
  )
  UPDATE core.cd_availability_slot s
     SET status = CASE WHEN s.starts_at > now() THEN 'open' ELSE 'cancelled' END
    FROM expired e
   WHERE s.id = e.slot_id AND s.status = 'held';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ── RPCs for signed-in users ────────────────────────────────────────────────

-- Book an open slot. Paid sessions get a 15-minute hold until payment; free sessions
-- (fee 0, e.g. a counsellor's own clients) are confirmed straight away.
CREATE OR REPLACE FUNCTION core.cd_book_slot(
  p_slot_id uuid, p_client_name text, p_client_phone text DEFAULT NULL, p_purpose text DEFAULT NULL)
  RETURNS core.cd_booking LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_slot       core.cd_availability_slot%ROWTYPE;
  v_counsellor core.cd_counsellor%ROWTYPE;
  v_booking    core.cd_booking%ROWTYPE;
BEGIN
  IF NOT core.cd_is_real_user() THEN
    RAISE EXCEPTION 'Please sign in with an account to book a session.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_slot FROM core.cd_availability_slot WHERE id = p_slot_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That slot does not exist.' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_counsellor FROM core.cd_counsellor WHERE id = v_slot.counsellor_id;
  IF v_counsellor.status <> 'verified' THEN
    RAISE EXCEPTION 'This counsellor is not taking bookings right now.' USING ERRCODE = 'P0001';
  END IF;
  IF v_counsellor.user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot book your own slot.' USING ERRCODE = 'P0001';
  END IF;

  -- A held slot whose payment window has passed is free again.
  IF v_slot.status = 'held' THEN
    PERFORM core.cd_release_expired_holds();
    SELECT * INTO v_slot FROM core.cd_availability_slot WHERE id = p_slot_id;
  END IF;

  IF v_slot.status <> 'open' OR v_slot.starts_at <= now() + interval '1 hour' THEN
    RAISE EXCEPTION 'That slot is no longer available.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO core.cd_booking (
    slot_id, counsellor_id, client_id, client_name, client_email, client_phone, purpose,
    status, fee_inr, hold_expires_at)
  VALUES (
    v_slot.id, v_slot.counsellor_id, auth.uid(), btrim(p_client_name),
    auth.jwt() ->> 'email', nullif(btrim(coalesce(p_client_phone, '')), ''),
    nullif(btrim(coalesce(p_purpose, '')), ''),
    'pending_payment', v_counsellor.session_fee_inr,
    CASE WHEN v_counsellor.session_fee_inr > 0 THEN now() + interval '15 minutes' END)
  RETURNING * INTO v_booking;

  IF v_counsellor.session_fee_inr > 0 THEN
    UPDATE core.cd_availability_slot SET status = 'held' WHERE id = v_slot.id;
  ELSE
    PERFORM core.cd_confirm_booking_internal(v_booking.id);
    SELECT * INTO v_booking FROM core.cd_booking WHERE id = v_booking.id;
  END IF;

  RETURN v_booking;
END;
$$;

-- Record the Razorpay order created for a pending booking (called by the Next.js route
-- after it has created the order with the Razorpay API).
CREATE OR REPLACE FUNCTION core.cd_attach_payment_order(
  p_booking_id uuid, p_order_id text, p_amount_paise integer)
  RETURNS core.cd_payment LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_booking core.cd_booking%ROWTYPE;
  v_payment core.cd_payment%ROWTYPE;
BEGIN
  SELECT * INTO v_booking FROM core.cd_booking WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR v_booking.client_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Booking not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_booking.status <> 'pending_payment' OR v_booking.hold_expires_at < now() THEN
    RAISE EXCEPTION 'This booking can no longer be paid for.' USING ERRCODE = 'P0001';
  END IF;
  IF p_amount_paise <> v_booking.fee_inr * 100 THEN
    RAISE EXCEPTION 'Payment amount does not match the session fee.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO core.cd_payment (booking_id, provider_order_id, amount_paise)
  VALUES (p_booking_id, p_order_id, p_amount_paise)
  RETURNING * INTO v_payment;
  RETURN v_payment;
END;
$$;

-- Cancel a booking. Clients can cancel an unpaid booking; the counsellor or an admin can
-- cancel any live booking (refunds of paid sessions are handled manually in v1).
CREATE OR REPLACE FUNCTION core.cd_cancel_booking(p_booking_id uuid, p_reason text DEFAULT NULL)
  RETURNS core.cd_booking LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_booking core.cd_booking%ROWTYPE;
  v_by      text;
  v_was     text;
BEGIN
  SELECT * INTO v_booking FROM core.cd_booking WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found.' USING ERRCODE = 'P0002';
  END IF;

  IF core.cd_is_admin() THEN
    v_by := 'admin';
  ELSIF v_booking.counsellor_id = core.cd_my_counsellor_id() THEN
    v_by := 'counsellor';
  ELSIF v_booking.client_id = auth.uid() THEN
    v_by := 'client';
  ELSE
    RAISE EXCEPTION 'Booking not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_booking.status NOT IN ('pending_payment','confirmed') THEN
    RAISE EXCEPTION 'This booking cannot be cancelled.' USING ERRCODE = 'P0001';
  END IF;
  IF v_by = 'client' AND v_booking.status = 'confirmed' THEN
    RAISE EXCEPTION 'Please contact your counsellor to cancel a paid session.' USING ERRCODE = 'P0001';
  END IF;

  v_was := v_booking.status;
  UPDATE core.cd_booking
     SET status = 'cancelled', cancelled_at = now(), cancelled_by = v_by,
         cancel_reason = nullif(btrim(coalesce(p_reason, '')), ''), hold_expires_at = NULL
   WHERE id = p_booking_id
  RETURNING * INTO v_booking;

  UPDATE core.cd_availability_slot
     SET status = CASE WHEN starts_at > now() THEN 'open' ELSE 'cancelled' END
   WHERE id = v_booking.slot_id AND status IN ('held','booked');

  IF v_was = 'confirmed' THEN
    DELETE FROM core.cd_notification
     WHERE booking_id = p_booking_id AND template = 'reminder_24h' AND status = 'queued';
    PERFORM core.cd_enqueue_booking_notifications(p_booking_id, 'booking_cancelled');
  END IF;

  RETURN v_booking;
END;
$$;

-- The counsellor marks a session that has started as completed.
CREATE OR REPLACE FUNCTION core.cd_complete_booking(p_booking_id uuid)
  RETURNS core.cd_booking LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_booking core.cd_booking%ROWTYPE;
BEGIN
  SELECT b.* INTO v_booking FROM core.cd_booking b
   JOIN core.cd_availability_slot s ON s.id = b.slot_id
   WHERE b.id = p_booking_id
     AND b.counsellor_id = core.cd_my_counsellor_id()
     AND b.status = 'confirmed'
     AND s.starts_at <= now()
   FOR UPDATE OF b;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only a confirmed session that has started can be completed.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE core.cd_booking SET status = 'completed', completed_at = now()
   WHERE id = p_booking_id RETURNING * INTO v_booking;
  RETURN v_booking;
END;
$$;

-- Admin: verify, suspend or reject a counsellor.
CREATE OR REPLACE FUNCTION core.cd_set_counsellor_status(
  p_counsellor_id uuid, p_status text, p_note text DEFAULT NULL)
  RETURNS core.cd_counsellor LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_row core.cd_counsellor%ROWTYPE;
BEGIN
  IF NOT core.cd_is_admin() THEN
    RAISE EXCEPTION 'Admins only.' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('pending','verified','suspended','rejected') THEN
    RAISE EXCEPTION 'Unknown status.' USING ERRCODE = '22023';
  END IF;

  UPDATE core.cd_counsellor
     SET status = p_status,
         -- Notes explain a rejection/suspension to the counsellor; verified profiles are
         -- public, so they never carry one.
         status_note = CASE WHEN p_status = 'verified' THEN NULL
                            ELSE nullif(btrim(coalesce(p_note, '')), '') END,
         verified_at = CASE WHEN p_status = 'verified' THEN now() ELSE verified_at END,
         verified_by = CASE WHEN p_status = 'verified' THEN auth.uid() ELSE verified_by END
   WHERE id = p_counsellor_id
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Counsellor not found.' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_row;
END;
$$;

-- ── RPC for the payment webhook (service role only) ─────────────────────────

-- Applies one verified Razorpay webhook event. Idempotent on the provider event id.
-- Returns what happened, for logging.
CREATE OR REPLACE FUNCTION core.cd_apply_payment_event(
  p_event_id text, p_event_type text, p_order_id text, p_payment_id text,
  p_amount_paise integer, p_failure_reason text, p_payload jsonb)
  RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_payment core.cd_payment%ROWTYPE;
  v_booking core.cd_booking%ROWTYPE;
  v_slot    core.cd_availability_slot%ROWTYPE;
  v_outcome text;
BEGIN
  INSERT INTO core.cd_payment_event (provider_event_id, event_type, payload)
  VALUES (p_event_id, p_event_type, p_payload)
  ON CONFLICT (provider_event_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN 'duplicate';
  END IF;

  SELECT * INTO v_payment FROM core.cd_payment WHERE provider_order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    v_outcome := 'unknown_order';
  ELSIF p_event_type IN ('payment.captured','order.paid') THEN
    IF v_payment.status = 'paid' THEN
      v_outcome := 'already_paid';
    ELSIF p_amount_paise IS DISTINCT FROM v_payment.amount_paise THEN
      UPDATE core.cd_payment SET failure_reason = 'amount_mismatch' WHERE id = v_payment.id;
      v_outcome := 'amount_mismatch';
    ELSE
      UPDATE core.cd_payment
         SET status = 'paid', provider_payment_id = coalesce(p_payment_id, provider_payment_id),
             failure_reason = NULL
       WHERE id = v_payment.id;

      SELECT * INTO v_booking FROM core.cd_booking WHERE id = v_payment.booking_id FOR UPDATE;
      SELECT * INTO v_slot FROM core.cd_availability_slot WHERE id = v_booking.slot_id FOR UPDATE;

      IF v_booking.status = 'pending_payment' THEN
        PERFORM core.cd_confirm_booking_internal(v_booking.id);
        v_outcome := 'confirmed';
      ELSIF v_booking.status IN ('expired','cancelled') AND v_slot.status = 'open'
            AND v_slot.starts_at > now()
            AND NOT EXISTS (SELECT 1 FROM core.cd_booking o WHERE o.slot_id = v_slot.id
                            AND o.id <> v_booking.id
                            AND o.status IN ('pending_payment','confirmed','completed')) THEN
        -- Paid just after the hold lapsed and nobody else took the slot: honour it.
        UPDATE core.cd_booking SET status = 'pending_payment', cancelled_at = NULL,
               cancelled_by = NULL, cancel_reason = NULL WHERE id = v_booking.id;
        PERFORM core.cd_confirm_booking_internal(v_booking.id);
        v_outcome := 'confirmed_late';
      ELSIF v_booking.status IN ('confirmed','completed') THEN
        v_outcome := 'already_confirmed';
      ELSE
        UPDATE core.cd_payment SET failure_reason = 'paid_after_slot_lost_refund_required'
         WHERE id = v_payment.id;
        v_outcome := 'refund_required';
      END IF;
    END IF;
  ELSIF p_event_type = 'payment.failed' THEN
    UPDATE core.cd_payment
       SET status = CASE WHEN status = 'paid' THEN status ELSE 'failed' END,
           provider_payment_id = coalesce(p_payment_id, provider_payment_id),
           failure_reason = left(p_failure_reason, 500)
     WHERE id = v_payment.id;
    v_outcome := 'failed';
  ELSIF p_event_type IN ('refund.processed','payment.refunded') THEN
    UPDATE core.cd_payment SET status = 'refunded' WHERE id = v_payment.id;
    v_outcome := 'refunded';
  ELSE
    v_outcome := 'ignored';
  END IF;

  UPDATE core.cd_payment_event SET outcome = v_outcome WHERE provider_event_id = p_event_id;
  RETURN v_outcome;
END;
$$;

-- ── Function privileges ─────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION core.cd_enqueue_booking_notifications(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION core.cd_confirm_booking_internal(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION core.cd_release_expired_holds() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION core.cd_apply_payment_event(text, text, text, text, integer, text, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION core.cd_book_slot(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION core.cd_attach_payment_order(uuid, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION core.cd_cancel_booking(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION core.cd_complete_booking(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION core.cd_set_counsellor_status(uuid, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION core.cd_is_real_user() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.cd_is_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.cd_my_counsellor_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.cd_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION core.cd_book_slot(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION core.cd_attach_payment_order(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION core.cd_cancel_booking(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION core.cd_complete_booking(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION core.cd_set_counsellor_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION core.cd_release_expired_holds() TO service_role;
GRANT EXECUTE ON FUNCTION core.cd_apply_payment_event(text, text, text, text, integer, text, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION core.cd_enqueue_booking_notifications(uuid, text) TO service_role;

-- ── System report templates ─────────────────────────────────────────────────

INSERT INTO core.cd_report_template (id, counsellor_id, name, description, sections)
VALUES
  ('5e2c0b1e-0d1a-4c5e-9a10-000000000001', NULL, 'Career guidance summary',
   'A short written summary to share after a career guidance session.',
   '[{"key":"situation","title":"Where you are now","hint":"Background, current stage, what prompted the session."},
     {"key":"strengths","title":"Strengths and interests","hint":"What came through in the conversation."},
     {"key":"options","title":"Options we discussed","hint":"Two or three directions, with honest pros and cons."},
     {"key":"recommendation","title":"Recommended direction","hint":"What to focus on and why."},
     {"key":"next_steps","title":"Next steps (next 30 days)","hint":"Concrete actions, with dates where possible."}]'::jsonb),
  ('5e2c0b1e-0d1a-4c5e-9a10-000000000002', NULL, 'Parent + student session',
   'For sessions where parents join; records agreements as well as advice.',
   '[{"key":"student_view","title":"What the student wants","hint":""},
     {"key":"parent_view","title":"Parents'' concerns","hint":"Finances, location, stability, expectations."},
     {"key":"common_ground","title":"Where everyone agrees","hint":""},
     {"key":"plan","title":"Agreed plan","hint":"Courses, colleges or steps everyone signed up to."},
     {"key":"follow_up","title":"Follow-up","hint":"When to review progress."}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ── Storage: private buckets ────────────────────────────────────────────────
-- Object paths start with the uploader's user id: <user_id>/<...>.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('cd-certificates', 'cd-certificates', false, 5242880,
   ARRAY['application/pdf','image/png','image/jpeg']),
  ('cd-reports', 'cd-reports', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS cd_certificates_owner ON storage.objects;
CREATE POLICY cd_certificates_owner ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'cd-certificates' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'cd-certificates' AND (storage.foldername(name))[1] = auth.uid()::text
              AND core.cd_my_counsellor_id() IS NOT NULL);

DROP POLICY IF EXISTS cd_certificates_admin_read ON storage.objects;
CREATE POLICY cd_certificates_admin_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'cd-certificates' AND core.cd_is_admin());

DROP POLICY IF EXISTS cd_reports_owner ON storage.objects;
CREATE POLICY cd_reports_owner ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'cd-reports' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'cd-reports' AND (storage.foldername(name))[1] = auth.uid()::text
              AND core.cd_my_counsellor_id() IS NOT NULL);

DROP POLICY IF EXISTS cd_reports_client_read ON storage.objects;
CREATE POLICY cd_reports_client_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'cd-reports' AND EXISTS (
    SELECT 1 FROM core.cd_report r
    WHERE r.attachment_path = storage.objects.name AND r.client_id = auth.uid() AND r.status = 'shared'));
