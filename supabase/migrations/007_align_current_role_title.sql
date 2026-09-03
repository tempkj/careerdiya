-- Align the profile schema with the production field name used by the UI.
-- Safe for databases that already have current_role_title.
alter table public.career_profiles
  add column if not exists current_role_title text;

do $outer$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'career_profiles'
      and column_name = 'current_role'
  ) then
    execute $upd$update public.career_profiles
      set current_role_title = coalesce(current_role_title, "current_role")
      where "current_role" is not null$upd$;
    execute $drop$alter table public.career_profiles drop column "current_role"$drop$;
  end if;
end $outer$;
