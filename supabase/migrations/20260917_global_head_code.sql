-- Global head code (WordPress-style public <head> injection) plus
-- lock down site_settings so anonymous clients cannot read executable fields.

-- SECURITY: global_head_code and header_scripts can execute scripts on every
-- public page. They are writable only via the service role (Studio server
-- actions with masthead/admin checks). Do not grant INSERT/UPDATE/DELETE to
-- anon or authenticated. Do not grant SELECT on these columns to anon.

alter table public.site_settings
  add column if not exists global_head_code text;

revoke all on table public.site_settings from anon, authenticated;

drop policy if exists "Public read site settings" on public.site_settings;
create policy "Public read site verification"
  on public.site_settings
  for select
  to anon, authenticated
  using (true);

-- Verification tokens are safe to expose (they already appear as meta tags).
grant select (id, google_site_verification, bing_site_verification, updated_at)
  on table public.site_settings to anon, authenticated;

grant select, insert, update, delete on table public.site_settings to service_role;

notify pgrst, 'reload schema';
