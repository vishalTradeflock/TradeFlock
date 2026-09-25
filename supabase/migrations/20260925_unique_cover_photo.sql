-- One image, one story: no two published articles may share a cover photo.
--
-- ORDER MATTERS. Run the cover backfill first (scripts/dedupe-covers.ts with
-- --apply, or the /api/cron/dedupe-covers workflow) until it reports 0 rows to
-- change; otherwise the unique index below fails to build on existing dupes.
--
-- Pre-check (must return 0 rows before creating the index):
--   select public.cover_photo_key(cover_image_url) as key, count(*)
--   from public.articles
--   where status = 'published' and public.cover_photo_key(cover_image_url) is not null
--   group by 1 having count(*) > 1;

-- Normalized cover identity. Mirrors coverPhotoKey() in src/lib/cover-dedupe.ts:
--   * Unsplash CDN  -> 'unsplash:photo-<id>' (size/crop/query params ignored)
--   * anything else -> lower(host + path) without scheme, 'www.', query, hash
--   * null / ''     -> null ('' = no cover; the site renders the neutral card)
create or replace function public.cover_photo_key(url text)
returns text
language sql
immutable
parallel safe
as $$
  select case
    when url is null or btrim(url) = '' then null
    when lower(split_part(split_part(btrim(url), '#', 1), '?', 1)) ~ '^https?://(images|plus)\.unsplash\.com/'
      and split_part(split_part(btrim(url), '#', 1), '?', 1) ~ '(premium_)?photo-[A-Za-z0-9_-]+'
      then 'unsplash:' || substring(
        split_part(split_part(btrim(url), '#', 1), '?', 1)
        from '(?:premium_)?photo-[A-Za-z0-9_-]+'
      )
    else nullif(
      regexp_replace(lower(split_part(split_part(btrim(url), '#', 1), '?', 1)), '^https?://(www\.)?', ''),
      ''
    )
  end
$$;

comment on function public.cover_photo_key(text) is
  'Normalized cover image identity used to keep every published story''s cover unique.';

-- The DB-level guarantee. Partial: drafts/review may hold anything until publish.
-- Build without locking writes (run outside a transaction block in the SQL editor).
create unique index concurrently if not exists articles_published_cover_key_unique
  on public.articles (public.cover_photo_key(cover_image_url))
  where status = 'published' and public.cover_photo_key(cover_image_url) is not null;
