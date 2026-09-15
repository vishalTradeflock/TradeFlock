-- Moderators invite writers/staff via the service role.

grant select, insert, update on public.profiles to service_role;

notify pgrst, 'reload schema';
