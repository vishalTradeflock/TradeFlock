-- TradeFlock USA — PostgreSQL schema for Supabase
-- Tables: categories, authors, articles
-- Run in the SQL editor (or `supabase db reset`) before seed.sql.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now(),
  constraint categories_slug_format check (slug ~ '^[a-z0-9-]+$')
);

create table if not exists public.authors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  bio text,
  title text,
  avatar_url text,
  created_at timestamptz not null default now(),
  constraint authors_slug_format check (slug ~ '^[a-z0-9-]+$')
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  dek text,
  excerpt text not null,
  body text not null,
  cover_image_url text not null,
  cover_image_alt text not null default '',
  category_id uuid not null references public.categories (id) on delete restrict,
  author_id uuid not null references public.authors (id) on delete restrict,
  is_featured boolean not null default false,
  is_breaking boolean not null default false,
  view_count integer not null default 0 check (view_count >= 0),
  status text not null default 'published',
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint articles_slug_format check (slug ~ '^[a-z0-9-]+$'),
  constraint articles_status_allowed check (status in ('draft', 'review', 'published'))
);

alter table public.articles
  add column if not exists status text not null default 'published';

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists articles_set_updated_at on public.articles;
create trigger articles_set_updated_at
before update on public.articles
for each row
execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists articles_published_at_idx
  on public.articles (published_at desc);

create index if not exists idx_articles_published_at
  on public.articles (published_at desc);

create index if not exists articles_category_id_idx
  on public.articles (category_id);

create index if not exists articles_author_id_idx
  on public.articles (author_id);

create index if not exists articles_view_count_idx
  on public.articles (view_count desc);

create index if not exists articles_featured_idx
  on public.articles (is_featured, published_at desc)
  where is_featured = true;

create index if not exists articles_breaking_idx
  on public.articles (is_breaking, published_at desc)
  where is_breaking = true;

create index if not exists articles_category_published_idx
  on public.articles (category_id, published_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Reader-facing publication: anonymous SELECT of published rows.
-- Writes remain service-role / dashboard only (no public insert/update/delete).
-- ---------------------------------------------------------------------------

alter table public.categories enable row level security;
alter table public.authors enable row level security;
alter table public.articles enable row level security;

drop policy if exists "Public read categories" on public.categories;
create policy "Public read categories"
  on public.categories
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public read authors" on public.authors;
create policy "Public read authors"
  on public.authors
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public read published articles" on public.articles;
create policy "Public read published articles"
  on public.articles
  for select
  to anon, authenticated
  using (published_at is not null and published_at <= now());

grant usage on schema public to anon, authenticated;
grant select on public.categories, public.authors, public.articles to anon, authenticated;

-- ---------------------------------------------------------------------------
-- processed_leads
-- Cron intake fingerprint so held or recently published RSS items are not
-- re-sent to the newsroom every hour. Service-role only (no public grants).
-- Safe to apply on an existing project; the cron path degrades to article-only
-- dedupe if this table has not been created yet.
-- ---------------------------------------------------------------------------

create table if not exists public.processed_leads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  title_key text not null,
  source_url text,
  source_name text,
  desk text,
  outcome text,
  created_at timestamptz not null default now(),
  constraint processed_leads_outcome_allowed check (
    outcome is null or outcome in ('published', 'held')
  )
);

create index if not exists processed_leads_title_key_idx
  on public.processed_leads (title_key);

create index if not exists processed_leads_created_at_idx
  on public.processed_leads (created_at desc);

create unique index if not exists processed_leads_source_url_key
  on public.processed_leads (source_url)
  where source_url is not null and source_url <> '';

alter table public.processed_leads enable row level security;
