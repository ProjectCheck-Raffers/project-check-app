-- Data API grants for authenticated Project Check test users.
-- RLS policies remain the access boundary.
grant usage on schema public to authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.projects to authenticated;
grant select, insert on table public.project_events to authenticated;
grant usage, select on sequence public.project_events_id_seq to authenticated;
grant select, insert, update, delete on table public.documents to authenticated;
