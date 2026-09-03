-- RLS policies restrict rows but do not grant base table privileges.
-- The anon role needs an explicit INSERT grant; no SELECT/UPDATE/DELETE
-- grant is added, matching the intended anon-can-insert-only design.
grant insert on public.leads to anon;
