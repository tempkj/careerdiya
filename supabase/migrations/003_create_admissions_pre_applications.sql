create table if not exists public.admissions_pre_applications (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),

  pre_application_id  text not null unique,
  shared_user_id      uuid,

  name                text not null,
  email               text not null,
  phone               text not null,
  location            text,

  audience            text,
  education_level     text,
  qualification       text,
  completion_year     text,

  college_id          text,
  college_name        text not null,
  programme_id        text,
  programme_name      text not null,
  specialization      text,

  source              text not null default 'careerdiya',
  status              text not null default 'pre_application',
  raw                 jsonb
);

create index if not exists admissions_pre_app_created_idx
  on public.admissions_pre_applications(created_at);
create index if not exists admissions_pre_app_email_idx
  on public.admissions_pre_applications(email);
create index if not exists admissions_pre_app_phone_idx
  on public.admissions_pre_applications(phone);
create index if not exists admissions_pre_app_college_idx
  on public.admissions_pre_applications(college_id);

alter table public.admissions_pre_applications enable row level security;

-- Anonymous launch intake: insert only. The client never receives table rows back.
create policy "anon can insert career diya pre applications"
  on public.admissions_pre_applications
  for insert
  to anon
  with check (
    source = 'careerdiya'
    and status = 'pre_application'
    and shared_user_id is null
  );

-- Authenticated users may submit a pre-application tied to their own Supabase user.
create policy "authenticated can insert own career diya pre applications"
  on public.admissions_pre_applications
  for insert
  to authenticated
  with check (
    source = 'careerdiya'
    and status = 'pre_application'
    and (shared_user_id is null or shared_user_id = auth.uid())
  );

grant insert on public.admissions_pre_applications to anon;
grant insert on public.admissions_pre_applications to authenticated;
