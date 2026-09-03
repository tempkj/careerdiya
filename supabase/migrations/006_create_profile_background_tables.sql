

alter table public.career_profiles
  add column if not exists country_other text,
  add column if not exists current_role_other text,
  add column if not exists industry_other text,
  add column if not exists career_interests_other text,
  add column if not exists career_goals_other text,
  add column if not exists strengths_other text,
  add column if not exists weaknesses_other text,
  add column if not exists learning_preferences_other text;
create table if not exists public.career_profile_education (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.career_profiles(user_id) on delete cascade,
  education_level text not null,
  education_level_other text,
  field_of_study text not null,
  field_of_study_other text,
  institution text,
  graduation_year text,
  is_current boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists career_profile_education_profile_idx
  on public.career_profile_education(profile_id, sort_order);

create table if not exists public.career_profile_experience (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.career_profiles(user_id) on delete cascade,
  domain text not null,
  domain_other text,
  exposure_type text not null,
  exposure_level text not null,
  role_family text,
  role_family_other text,
  years_bucket text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists career_profile_experience_profile_idx
  on public.career_profile_experience(profile_id, sort_order);

alter table public.career_profile_education enable row level security;
alter table public.career_profile_experience enable row level security;

drop policy if exists "users can read own education" on public.career_profile_education;
create policy "users can read own education"
  on public.career_profile_education for select to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "users can insert own education" on public.career_profile_education;
create policy "users can insert own education"
  on public.career_profile_education for insert to authenticated
  with check (auth.uid() = profile_id);

drop policy if exists "users can update own education" on public.career_profile_education;
create policy "users can update own education"
  on public.career_profile_education for update to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "users can delete own education" on public.career_profile_education;
create policy "users can delete own education"
  on public.career_profile_education for delete to authenticated
  using (auth.uid() = profile_id);

grant select, insert, update, delete on public.career_profile_education to authenticated;

drop policy if exists "users can read own experience" on public.career_profile_experience;
create policy "users can read own experience"
  on public.career_profile_experience for select to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "users can insert own experience" on public.career_profile_experience;
create policy "users can insert own experience"
  on public.career_profile_experience for insert to authenticated
  with check (auth.uid() = profile_id);

drop policy if exists "users can update own experience" on public.career_profile_experience;
create policy "users can update own experience"
  on public.career_profile_experience for update to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "users can delete own experience" on public.career_profile_experience;
create policy "users can delete own experience"
  on public.career_profile_experience for delete to authenticated
  using (auth.uid() = profile_id);

grant select, insert, update, delete on public.career_profile_experience to authenticated;
