create table if not exists public.career_exploration_results (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  audience      text not null check (audience in ('parent', 'student', 'professional')),
  answers       jsonb not null,
  result        jsonb not null,
  completed_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists career_exploration_results_updated_idx
  on public.career_exploration_results(updated_at desc);

alter table public.career_exploration_results enable row level security;

drop policy if exists "users can read own career exploration" on public.career_exploration_results;
create policy "users can read own career exploration"
  on public.career_exploration_results
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users can insert own career exploration" on public.career_exploration_results;
create policy "users can insert own career exploration"
  on public.career_exploration_results
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users can update own career exploration" on public.career_exploration_results;
create policy "users can update own career exploration"
  on public.career_exploration_results
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.career_exploration_results to authenticated;
