create extension if not exists pgcrypto;

create table if not exists public.leads (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),

  source         text not null check (source in ('careerdiya', 'skilldiya')),
  segment        text,
  interest       text,
  interest_kind  text check (interest_kind in ('course', 'direction', 'general')),

  name           text,
  email          text,
  phone          text,

  shared_user_id uuid,
  raw            jsonb
);

create index if not exists leads_source_idx   on public.leads (source);
create index if not exists leads_interest_idx on public.leads (interest);
create index if not exists leads_created_idx  on public.leads (created_at);

alter table public.leads enable row level security;

-- Anonymous clients may INSERT leads, but have no SELECT/UPDATE/DELETE policy.
drop policy if exists "anon can insert leads" on public.leads;
create policy "anon can insert leads"
  on public.leads for insert
  to anon
  with check (
    source in ('careerdiya', 'skilldiya')
    and interest_kind in ('course', 'direction', 'general')
    and nullif(trim(segment), '') is not null
    and nullif(trim(interest), '') is not null
  );
