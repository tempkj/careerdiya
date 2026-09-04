-- Career Diya: multi-exploration history.
--
-- Replaces the one-row-per-user `career_exploration_results` model with a
-- many-rows-per-user, immutable exploration history table.
--
-- REVIEW BEFORE APPLYING. This migration is intended to be reviewed and run
-- by a human against a disposable/staging database first. It has NOT been
-- applied to any live Supabase project by this change.
--
-- What it does:
--   1. Creates `public.career_explorations` (id-PK, many rows per user).
--   2. Adds indexes, RLS (own-row only), and an immutability trigger that
--      blocks changing any column except `pinned` after insert — including
--      `shared_user_id`, which must never be rewritten on a historical row.
--   3. Adds two SECURITY INVOKER functions used by the frontend instead of a
--      raw upsert: `exploration_storage_limit` (server-side limit lookup for
--      the CALLING user only — takes no user-id parameter, so it can't be
--      asked about another user) and `save_exploration_snapshot`
--      (idempotent-by-id insert with storage-cap enforcement and unpinned
--      eviction, serialized per user via a transaction-scoped advisory lock
--      so two concurrent saves for the same user can't both bypass the
--      storage limit).
--   4. Backfills existing rows from `career_exploration_results` as
--      `legacy = true, engine_version = 'legacy-unknown'` — these rows do
--      have a stored `result` (the old table enforced NOT NULL on it), but
--      no engine version was ever recorded for them, so they are marked
--      legacy rather than assigned a fabricated version.
--   5. Does NOT drop `career_exploration_results`. It is left in place,
--      untouched and no longer written to, as a rollback safety net. A
--      follow-up migration can drop it once the new table is verified in
--      production.
--
-- How to test before applying to production:
--   1. Point the Supabase CLI / psql at a disposable or staging database
--      (never the live project referenced in assets/supabase-config.js).
--   2. Run this file: `psql "$STAGING_DATABASE_URL" -f supabase/migrations/008_create_career_explorations.sql`
--   3. Verify: `select count(*) from career_exploration_results;` matches
--      `select count(*) from career_explorations where legacy = true;`
--   4. Verify RLS: as an authenticated test user, confirm you can only
--      select/insert/update your own rows (`select * from career_explorations`
--      returns only your rows; attempting to select another user's id
--      returns nothing).
--   5. Verify immutability: `update career_explorations set answers = '{}' where id = '<id>'`
--      (and likewise for `shared_user_id`) as the owning user must fail with
--      the raised exception; `update career_explorations set pinned = true
--      where id = '<id>'` must succeed.
--   6. Verify storage cap: call `select save_exploration_snapshot(...)` more
--      times than `exploration_storage_limit()` for a test user and confirm
--      the oldest unpinned row is evicted, and that pinning every stored row
--      then attempting one more insert raises 'STORAGE_FULL'.
--   7. Verify `exploration_storage_limit()` takes no user-id argument and
--      always reflects the caller (auth.uid()) — it cannot be asked about
--      another user's limit.
--   8. Re-run this file a second time against the same database and confirm
--      no error and no duplicate legacy rows are created (the backfill step
--      is idempotent).

create table if not exists public.career_explorations (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  audience       text not null check (audience in ('parent', 'student', 'professional')),
  answers        jsonb not null,
  result         jsonb,
  engine_version text not null,
  legacy         boolean not null default false,
  pinned         boolean not null default false,
  shared_user_id uuid,
  completed_at   timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists career_explorations_user_idx
  on public.career_explorations (user_id);
create index if not exists career_explorations_user_updated_idx
  on public.career_explorations (user_id, updated_at desc);

alter table public.career_explorations enable row level security;

drop policy if exists "users can read own explorations" on public.career_explorations;
create policy "users can read own explorations"
  on public.career_explorations for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users can insert own explorations" on public.career_explorations;
create policy "users can insert own explorations"
  on public.career_explorations for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Update is allowed at the RLS layer; the trigger below is what actually
-- restricts an update to only ever change `pinned` (+ updated_at).
drop policy if exists "users can update own explorations" on public.career_explorations;
create policy "users can update own explorations"
  on public.career_explorations for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Delete is restricted to the user's own UNPINNED rows only. This is used by
-- save_exploration_snapshot() to age out the oldest unpinned row when a
-- storage-limited user creates a new exploration; it is not exposed as a
-- general "delete my history" UI action by this change.
drop policy if exists "users can delete own unpinned explorations" on public.career_explorations;
create policy "users can delete own unpinned explorations"
  on public.career_explorations for delete
  to authenticated
  using (auth.uid() = user_id and pinned = false);

grant select, insert, update, delete on public.career_explorations to authenticated;

-- Immutability: block changing any historical-meaning column after insert.
-- Only `pinned` (and the housekeeping `updated_at`) may ever change.
create or replace function public.prevent_exploration_mutation()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.audience is distinct from old.audience
     or new.answers is distinct from old.answers
     or new.result is distinct from old.result
     or new.engine_version is distinct from old.engine_version
     or new.legacy is distinct from old.legacy
     or new.shared_user_id is distinct from old.shared_user_id
     or new.completed_at is distinct from old.completed_at
  then
    raise exception 'career_explorations rows are immutable; only pinned may change';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_prevent_exploration_mutation on public.career_explorations;
create trigger trg_prevent_exploration_mutation
  before update on public.career_explorations
  for each row execute function public.prevent_exploration_mutation();

-- Server-side storage-limit lookup for the CURRENT caller only.
--
-- Deliberately takes no user-id parameter: it always resolves the limit for
-- auth.uid(), so no authenticated caller can pass an arbitrary UUID to read
-- (today) or, once real per-user entitlement logic exists, influence another
-- user's limit. If this ever needs to be called for a specific user from
-- trusted server-side code (not from the browser), add a SEPARATE
-- SECURITY DEFINER function for that purpose rather than widening this one.
--
-- KNOWN LIMITATION: Career Diya has no billing/subscription system yet, so
-- there is no trusted server-side signal to distinguish a paid user from a
-- free one. This function currently always returns the free-tier limit for
-- every user. When a real paid entitlement source (e.g. a bookings/
-- subscriptions table) exists, this function is the one place to update to
-- check it (via auth.uid()) — nothing else should need to change. The value
-- below must be kept in sync with assets/exploration-config.js's
-- EXPLORATION_CONFIG.free.storageLimit.
drop function if exists public.exploration_storage_limit(uuid);
create or replace function public.exploration_storage_limit()
returns integer
language sql
stable
as $$
  select 1; -- EXPLORATION_CONFIG.free.storageLimit, for auth.uid()
$$;

-- Idempotent-by-id exploration insert with server-side storage-cap
-- enforcement. This is the only path the frontend should use to persist an
-- exploration (new or promoted-from-anonymous).
--
-- Behavior:
--   * If a row with p_id already exists for this user, it is returned as-is
--     (no recomputation, no duplicate) — this is what makes anonymous
--     promotion idempotent/retry-safe.
--   * Otherwise, if the user is at their storage limit, the oldest unpinned
--     row is evicted to make room.
--   * If the user is at their storage limit and every stored row is pinned,
--     the insert is rejected with STORAGE_FULL rather than silently
--     destroying or overwriting pinned history.
create or replace function public.save_exploration_snapshot(
  p_id uuid,
  p_audience text,
  p_answers jsonb,
  p_result jsonb,
  p_engine_version text,
  p_completed_at timestamptz,
  p_legacy boolean default false
)
returns public.career_explorations
language plpgsql
as $$
declare
  v_uid uuid := auth.uid();
  v_existing public.career_explorations;
  v_count integer;
  v_limit integer;
  v_evict_id uuid;
  v_row public.career_explorations;
begin
  if v_uid is null then
    raise exception 'save_exploration_snapshot requires an authenticated user';
  end if;

  -- Serialize this whole read-evict-insert sequence per user so two
  -- concurrent saves (e.g. two open tabs, or a retried request racing the
  -- original) cannot both pass the storage-limit check before either has
  -- inserted, which would let the limit be exceeded or corrupt the eviction
  -- choice. pg_advisory_xact_lock is a transaction-scoped lock — Supabase
  -- (via PostgREST) runs each RPC call in its own transaction, so this
  -- releases automatically when the call finishes; nothing to unlock.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  select * into v_existing from public.career_explorations where id = p_id and user_id = v_uid;
  if found then
    return v_existing;
  end if;

  v_limit := public.exploration_storage_limit();
  select count(*) into v_count from public.career_explorations where user_id = v_uid;

  if v_count >= v_limit then
    select id into v_evict_id
      from public.career_explorations
      where user_id = v_uid and pinned = false
      order by completed_at asc
      limit 1;

    if v_evict_id is null then
      raise exception 'STORAGE_FULL: all stored explorations are pinned; unpin one to save a new exploration';
    end if;

    delete from public.career_explorations where id = v_evict_id and user_id = v_uid;
  end if;

  insert into public.career_explorations (id, user_id, audience, answers, result, engine_version, legacy, completed_at)
  values (p_id, v_uid, p_audience, p_answers, p_result, p_engine_version, coalesce(p_legacy, false), coalesce(p_completed_at, now()))
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.exploration_storage_limit() to authenticated;
grant execute on function public.save_exploration_snapshot(uuid, text, jsonb, jsonb, text, timestamptz, boolean) to authenticated;

-- Pin/unpin. A thin, explicit RPC rather than a raw update, since the
-- immutability trigger already blocks every other column from changing.
create or replace function public.set_exploration_pinned(p_id uuid, p_pinned boolean)
returns public.career_explorations
language plpgsql
as $$
declare
  v_row public.career_explorations;
begin
  update public.career_explorations
    set pinned = p_pinned
    where id = p_id and user_id = auth.uid()
    returning * into v_row;

  if not found then
    raise exception 'Exploration not found or not owned by the current user';
  end if;

  return v_row;
end;
$$;

grant execute on function public.set_exploration_pinned(uuid, boolean) to authenticated;

-- Backfill existing one-row-per-user explorations as legacy history.
-- Idempotent: skips any user who already has a legacy-unknown row (so
-- re-running this file after it has already run does not duplicate rows).
insert into public.career_explorations (user_id, audience, answers, result, engine_version, legacy, completed_at, updated_at)
select cer.user_id, cer.audience, cer.answers, cer.result, 'legacy-unknown', true, cer.completed_at, cer.updated_at
from public.career_exploration_results cer
where not exists (
  select 1 from public.career_explorations ce
  where ce.user_id = cer.user_id and ce.engine_version = 'legacy-unknown' and ce.legacy = true
);

-- career_exploration_results is intentionally left in place (not dropped)
-- as a rollback safety net. The application no longer reads or writes it
-- after this change ships. Drop it in a later migration once the new table
-- has been verified in production.
