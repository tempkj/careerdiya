-- Career Intelligence source cache and refresh layer
-- The third-party Career Library remains an upstream source only.
-- Career Diya owns the durable snapshots and current normalized profile.

CREATE TABLE IF NOT EXISTS knowledge.career_library_source (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text NOT NULL UNIQUE,
  provider_name text NOT NULL,
  integration_version text,
  terms_reference text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO knowledge.career_library_source
  (provider_key, provider_name, integration_version)
VALUES
  ('edumilestones-career-library', 'Edumilestones Career Library', '2.1')
ON CONFLICT (provider_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS knowledge.career_library_variant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES knowledge.career_library_source(id),
  career_id text,
  canonical_name text NOT NULL,
  country text NOT NULL DEFAULT 'India',
  language text NOT NULL DEFAULT 'English',
  refresh_interval_days integer NOT NULL DEFAULT 30
    CHECK (refresh_interval_days BETWEEN 1 AND 365),
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_changed_at timestamptz,
  next_refresh_at timestamptz NOT NULL DEFAULT now(),
  current_snapshot_id uuid,
  content_hash text,
  refresh_status text NOT NULL DEFAULT 'never_checked'
    CHECK (refresh_status IN ('never_checked','fresh','unchanged','changed','stale','failed','refreshing')),
  refresh_lock_until timestamptz,
  failure_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_id, canonical_name, country, language)
);

CREATE INDEX IF NOT EXISTS idx_career_library_variant_due
  ON knowledge.career_library_variant(next_refresh_at, refresh_lock_until);

CREATE INDEX IF NOT EXISTS idx_career_library_variant_career
  ON knowledge.career_library_variant(career_id);

CREATE TABLE IF NOT EXISTS knowledge.career_library_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES knowledge.career_library_variant(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES knowledge.career_library_source(id),
  fetched_at timestamptz NOT NULL DEFAULT now(),
  content_hash text NOT NULL,
  response_valid boolean NOT NULL DEFAULT true,
  upstream_status integer,
  adapter_version text,
  raw_payload jsonb NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_career_library_snapshot_variant
  ON knowledge.career_library_snapshot(variant_id, fetched_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_career_library_snapshot_current
  ON knowledge.career_library_snapshot(variant_id)
  WHERE is_current = true;

CREATE TABLE IF NOT EXISTS knowledge.career_library_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL UNIQUE REFERENCES knowledge.career_library_variant(id) ON DELETE CASCADE,
  career_id text,
  canonical_name text NOT NULL,
  country text NOT NULL,
  language text NOT NULL,
  data jsonb NOT NULL,
  snapshot_id uuid REFERENCES knowledge.career_library_snapshot(id),
  source_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_career_library_profile_lookup
  ON knowledge.career_library_profile(canonical_name, country, language);

-- Atomically claim due variants so two refresh workers do not process the same
-- career/language/country combination concurrently.
CREATE OR REPLACE FUNCTION knowledge.claim_due_career_library_variants(p_limit integer DEFAULT 20)
RETURNS SETOF knowledge.career_library_variant
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT v.id
    FROM knowledge.career_library_variant v
    WHERE v.next_refresh_at <= now()
      AND (v.refresh_lock_until IS NULL OR v.refresh_lock_until < now())
    ORDER BY v.next_refresh_at ASC, v.created_at ASC
    LIMIT greatest(1, least(coalesce(p_limit, 20), 100))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE knowledge.career_library_variant v
     SET refresh_status = 'refreshing',
         refresh_lock_until = now() + interval '15 minutes',
         updated_at = now()
    FROM due
   WHERE v.id = due.id
  RETURNING v.*;
END;
$$;

REVOKE ALL ON FUNCTION knowledge.claim_due_career_library_variants(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION knowledge.claim_due_career_library_variants(integer) TO careerasana_worker;

-- Current normalized career data is intentionally public career knowledge.
GRANT SELECT ON knowledge.career_library_profile TO anon, authenticated, careerasana_app, careerasana_readonly;

-- Provider snapshots and refresh metadata are operational/source records, not a
-- client-facing API. Keep raw third-party payloads out of the public surface.
REVOKE ALL ON knowledge.career_library_source FROM anon, authenticated;
REVOKE ALL ON knowledge.career_library_variant FROM anon, authenticated;
REVOKE ALL ON knowledge.career_library_snapshot FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON knowledge.career_library_source TO careerasana_worker;
GRANT SELECT, INSERT, UPDATE ON knowledge.career_library_variant TO careerasana_worker;
GRANT SELECT, INSERT, UPDATE ON knowledge.career_library_snapshot TO careerasana_worker;
GRANT SELECT, INSERT, UPDATE ON knowledge.career_library_profile TO careerasana_worker;

COMMENT ON TABLE knowledge.career_library_snapshot IS
  'Immutable provider snapshots. Retain history; never overwrite prior payloads.';
COMMENT ON TABLE knowledge.career_library_profile IS
  'Current Career Diya-owned normalized career profile derived from the latest accepted source snapshot.';
COMMENT ON COLUMN knowledge.career_library_variant.refresh_interval_days IS
  'Default 30-day refresh interval while the upstream Career Library remains available.';
