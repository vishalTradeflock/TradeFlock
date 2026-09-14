-- TradeFlock Magazine desk: public catalog of editions / flipbooks.
create table if not exists public.magazines (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  cover_image_url text,
  pdf_url text,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint magazines_slug_format check (slug ~ '^[a-z0-9-]+$')
);

create index if not exists magazines_published_at_idx
  on public.magazines (published_at desc);

drop trigger if exists magazines_set_updated_at on public.magazines;
create trigger magazines_set_updated_at
before update on public.magazines
for each row
execute procedure public.set_updated_at();

alter table public.magazines enable row level security;

drop policy if exists "Public read magazines" on public.magazines;
create policy "Public read magazines"
  on public.magazines
  for select
  to anon, authenticated
  using (published_at is not null and published_at <= now());

grant select on public.magazines to anon, authenticated;
