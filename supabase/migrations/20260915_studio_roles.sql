-- Studio roles: writer (desk denied) and moderator (desk, publish, delete).
-- Map legacy editor/admin profiles to moderator.

alter table public.profiles drop constraint if exists profiles_role_allowed;

update public.profiles
   set role = 'moderator'
 where role in ('editor', 'admin');

alter table public.profiles
  add constraint profiles_role_allowed
  check (role in ('writer', 'moderator'));

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
        and p.role in ('writer', 'moderator')
    )
  );

notify pgrst, 'reload schema';
