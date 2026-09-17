-- Stage 2 CMS SEO: published slug redirects and structured site-verification fields.
-- Does not drop columns, change article IDs, or rewrite existing slugs.

create table if not exists public.article_slug_redirects (
  old_slug text primary key,
  article_id uuid not null references public.articles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint article_slug_redirects_format check (old_slug ~ '^[a-z0-9-]+$')
);

create index if not exists article_slug_redirects_article_id_idx
  on public.article_slug_redirects (article_id);

alter table public.article_slug_redirects enable row level security;

drop policy if exists "Public read article slug redirects" on public.article_slug_redirects;
create policy "Public read article slug redirects"
  on public.article_slug_redirects
  for select
  to anon, authenticated
  using (true);

grant select on public.article_slug_redirects to anon, authenticated;
grant select, insert, update, delete on public.article_slug_redirects to service_role;

alter table public.site_settings
  add column if not exists google_site_verification text,
  add column if not exists bing_site_verification text;

notify pgrst, 'reload schema';
