-- Technical SEO: canonical, FAQs, share images, and global head scripts.

alter table public.articles
  add column if not exists canonical_url text,
  add column if not exists featured_image text,
  add column if not exists featured_image_alt text,
  add column if not exists image_url text,
  add column if not exists faqs jsonb not null default '[]'::jsonb;

create table if not exists public.site_settings (
  id text primary key default 'default',
  header_scripts text,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id)
values ('default')
on conflict (id) do nothing;

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at
before update on public.site_settings
for each row
execute procedure public.set_updated_at();

alter table public.site_settings enable row level security;

drop policy if exists "Public read site settings" on public.site_settings;
create policy "Public read site settings"
  on public.site_settings
  for select
  to anon, authenticated
  using (true);

grant select on public.site_settings to anon, authenticated;

notify pgrst, 'reload schema';
