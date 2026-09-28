-- Public newsletter signups from the article modal.
-- Writes go through the service-role API route only.

create table if not exists public.newsletter_subscribers (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.newsletter_subscribers enable row level security;

revoke all on table public.newsletter_subscribers from anon, authenticated;
grant select, insert, update, delete on table public.newsletter_subscribers to service_role;

notify pgrst, 'reload schema';
