create table if not exists public.career_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  country text,
  education_level text,
  institution text,
  field_of_study text,
  graduation_year text,
  "current_role" text,
  industry text,
  experience_years text,
  career_interests text[] not null default '{}'::text[],
  career_goals text,
  strengths text,
  weaknesses text,
  learning_preferences text,
  audience text check (audience in ('parent','student','professional') or audience is null),
  shared_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists career_profiles_updated_idx on public.career_profiles(updated_at desc);

alter table public.career_profiles enable row level security;

drop policy if exists "users can read own career profile" on public.career_profiles;
create policy "users can read own career profile" on public.career_profiles for select to authenticated using (auth.uid() = user_id);

drop policy if exists "users can insert own career profile" on public.career_profiles;
create policy "users can insert own career profile" on public.career_profiles for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "users can update own career profile" on public.career_profiles;
create policy "users can update own career profile" on public.career_profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update on public.career_profiles to authenticated;
