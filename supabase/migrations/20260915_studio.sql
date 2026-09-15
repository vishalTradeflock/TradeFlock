-- TradeFlock Studio — writer profiles, draft RLS, and article media.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'writer',
  display_name text,
  created_at timestamptz not null default now(),
  constraint profiles_role_allowed check (role in ('writer', 'moderator'))
);

alter table public.profiles enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "Users update own profile name" on public.profiles;
create policy "Users update own profile name"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

grant select, update on public.profiles to authenticated;

-- Public readers only see published stories (status-aware).
drop policy if exists "Public read published articles" on public.articles;
create policy "Public read published articles"
  on public.articles
  for select
  to anon, authenticated
  using (
    status = 'published'
    and published_at is not null
    and published_at <= now()
  );

insert into storage.buckets (id, name, public)
values ('article-media', 'article-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read article media" on storage.objects;
create policy "Public read article media"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'article-media');

drop policy if exists "Newsroom upload article media" on storage.objects;
create policy "Newsroom upload article media"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'article-media'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('writer', 'moderator', 'editor', 'admin')
    )
  );
