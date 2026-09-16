-- Issue landing pages: published magazine editions and the articles they feature.
-- Live magazines rows may predate updated_at; the BEFORE UPDATE trigger still
-- calls set_updated_at(), so add the column before any UPDATE.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  if to_jsonb(new) ? 'updated_at' then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

alter table public.magazines
  add column if not exists year integer,
  add column if not exists status text not null default 'published',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.articles
  add column if not exists updated_at timestamptz not null default now();

update public.magazines
   set year = extract(year from published_at)::integer
 where year is null;

alter table public.magazines drop constraint if exists magazines_status_allowed;
alter table public.magazines
  add constraint magazines_status_allowed check (status in ('draft', 'published'));

alter table public.articles
  add column if not exists magazine_id uuid references public.magazines (id) on delete set null,
  add column if not exists magazine_sort integer;

create index if not exists articles_magazine_id_idx
  on public.articles (magazine_id)
  where magazine_id is not null;

-- Attach imported profile stories whose slug ends with the edition slug
-- (e.g. chris-mashburn-most-innovative-global-coos-2026).
update public.articles as a
   set magazine_id = m.id
  from public.magazines as m
 where a.magazine_id is null
   and length(m.slug) >= 8
   and a.slug like '%-' || m.slug;

drop policy if exists "Public read magazines" on public.magazines;
create policy "Public read magazines"
  on public.magazines
  for select
  to anon, authenticated
  using (
    published_at is not null
    and published_at <= now()
    and coalesce(status, 'published') = 'published'
  );

notify pgrst, 'reload schema';
