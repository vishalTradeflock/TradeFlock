-- Attach a public.authors row to each Studio user. The byline key is
-- authors.id = profiles.id (auth.users id). Do not write profiles.author_id;
-- that column is not in the live PostgREST schema.

grant select, insert, update on public.authors to service_role;
grant select, update on public.profiles to service_role;
grant select, insert, update on public.articles to service_role;

create or replace function public.ensure_studio_author(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id uuid;
  v_name text;
  v_slug text;
  v_email text;
  v_base text;
begin
  select id into v_author_id from public.authors where id = p_user_id;
  if v_author_id is not null then
    return v_author_id;
  end if;

  select nullif(trim(display_name), '')
    into v_name
  from public.profiles
  where id = p_user_id;

  if not found then
    raise exception 'Studio profile not found';
  end if;

  select email into v_email from auth.users where id = p_user_id;

  v_base := lower(split_part(coalesce(v_email, 'writer'), '@', 1));
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
  v_base := regexp_replace(v_base, '^-+|-+$', '', 'g');
  if v_base = '' then
    v_base := 'writer';
  end if;

  v_slug := v_base || '-' || substr(replace(p_user_id::text, '-', ''), 1, 8);
  v_name := coalesce(v_name, nullif(split_part(coalesce(v_email, ''), '@', 1), ''), 'Staff Writer');

  select id into v_author_id from public.authors where slug = v_slug;
  if v_author_id is not null then
    return v_author_id;
  end if;

  insert into public.authors (id, name, slug, title)
  values (p_user_id, v_name, v_slug, 'Staff Writer')
  on conflict (id) do update
    set name = excluded.name
  returning id into v_author_id;

  return v_author_id;
end;
$$;

revoke all on function public.ensure_studio_author(uuid) from public, anon, authenticated;
grant execute on function public.ensure_studio_author(uuid) to service_role;

notify pgrst, 'reload schema';
