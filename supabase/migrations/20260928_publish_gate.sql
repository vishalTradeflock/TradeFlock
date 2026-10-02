-- Publish gate: database backstop so no code path (including an old deployment
-- of a stale branch with no word gate) can publish a stub or a retired stock
-- cover. Mirrors the app-side rules:
--   * ARTICLE_MIN_WORDS = 550 and countBodyWords() in src/lib/agents/wire-hygiene.ts
--     (Studio's gate, src/lib/agents/studio-gate.ts, runs the same check via
--     assessWireArticle -> wireHygieneFailures).
--   * LEGACY_STOCK_COVER_URLS in src/lib/cover-dedupe.ts and FALLBACK_COVER_IMAGE
--     in src/lib/images.ts (matched on the Unsplash 'photo-XXXX-YYYY' key).
--
-- Word rule: applies only when a row BECOMES published
--   (INSERT with status='published', or UPDATE from a non-published status to
--   'published'). Edits, cover backfills and redirect work on rows that are
--   already published are never blocked by it.
--   Exemption: magazine rows (magazine_id IS NOT NULL). src/lib/sync-magazine.ts
--   publishes honoree rows whose body is the honoree bio (2-54 words today; 21
--   live rows). Nothing else is exempt: Success Insights profiles outside a
--   magazine are held to 550 like every other desk (the short "to watch"
--   blurbs were deliberately unpublished on 2026-09-17).
--
-- Cover rule: applies when a row becomes published, AND on UPDATEs of rows that
--   are already published when cover_image_url changes to a retired key.
--   Empty / NULL cover is allowed (the site renders the neutral card).
--   No exemptions (magazine rows included).
--
-- Idempotent: safe to re-run.

create or replace function public.article_body_word_count(body text)
returns integer
language sql
immutable
security invoker
set search_path = public
as $fn$
  -- Same steps as stripTagsForWordCount()/countBodyWords() in wire-hygiene.ts.
  select count(*)::integer
  from regexp_split_to_table(
    regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    regexp_replace(regexp_replace(regexp_replace(
      coalesce(body, ''),
      '<script\y.*?</script>', ' ', 'gi'),
      '<style\y.*?</style>', ' ', 'gi'),
      '<[^>]+>', ' ', 'g'),
      '&nbsp;', ' ', 'gi'),
      '&amp;', '&', 'gi'),
      '&quot;', '"', 'gi'),
      '&#39;', '''', 'g'),
      '&[a-z]+;', ' ', 'gi'),
    '[[:space:]\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+'
  ) as w
  where w <> '';
$fn$;

comment on function public.article_body_word_count(text) is
  'Word count of an article body after stripping HTML. Mirrors countBodyWords() in src/lib/agents/wire-hygiene.ts.';

create or replace function public.articles_publish_gate()
returns trigger
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  min_words constant integer := 550;  -- ARTICLE_MIN_WORDS
  retired_cover_keys constant text[] := array[
    'photo-1486406146926-c627a92ad1ab',
    'photo-1558494949-ef010cbdcc31',
    'photo-1518770660439-4636190af475',
    'photo-1581091226825-a6a2a5aee158',
    'photo-1550751827-4bd374c3f58b',
    'photo-1518773553398-650c184e0bb3',
    'photo-1485827404703-89b55fcc595e',
    'photo-1581092160562-40aa08e78837',
    'photo-1611974789855-9c2a0a7236a3',
    'photo-1590283603385-17ffb3a7f29f',
    'photo-1551288049-bebda4e38f71',
    'photo-1504384308090-c894fdcc538d',
    'photo-1469474968028-56623f02e42e',
    'photo-1514565131-fce0801e5785',
    'photo-1554224155-6726b3ff858f',
    'photo-1454165804606-c3d57bc86b40',
    'photo-1565514020176-b31d2542ed3e',
    'photo-1556742049-0cfed4f6a45d',
    'photo-1526304640173-94cb2232017e',
    'photo-1460925895917-afdab827c52f',
    'photo-1521737711867-e3b973223fbd',
    'photo-1556761175-5973dc0f32e7',
    'photo-1497366216548-37526070297c',
    'photo-1475721027785-f74eccf877e2',
    'photo-1573164713714-d95e436ab8d6',
    'photo-1559136555-9303baea8ebd'
  ];
  becoming_published boolean;
  cover_changed boolean;
  words integer;
  retired_key text;
begin
  becoming_published :=
    NEW.status = 'published'
    and (TG_OP = 'INSERT' or OLD.status is distinct from 'published');

  cover_changed :=
    TG_OP = 'UPDATE'
    and NEW.status = 'published'
    and NEW.cover_image_url is distinct from OLD.cover_image_url;

  if not becoming_published and not cover_changed then
    return NEW;
  end if;

  -- Cover rule: never put a retired stock cover on a live story.
  if coalesce(btrim(NEW.cover_image_url), '') <> '' then
    select k into retired_key
    from unnest(retired_cover_keys) as k
    where strpos(NEW.cover_image_url, k) > 0
    limit 1;

    if retired_key is not null then
      raise exception using
        errcode = 'check_violation',
        message = format(
          'publish gate: article "%s" uses retired stock cover %s; pick a story-specific cover or leave it empty',
          NEW.slug, retired_key),
        hint = 'Retired keys: LEGACY_STOCK_COVER_URLS (src/lib/cover-dedupe.ts) and FALLBACK_COVER_IMAGE (src/lib/images.ts).';
    end if;
  end if;

  -- Word rule: only when becoming published; magazine honoree rows exempt.
  if becoming_published and NEW.magazine_id is null then
    words := public.article_body_word_count(NEW.body);
    if words < min_words then
      raise exception using
        errcode = 'check_violation',
        message = format(
          'publish gate: article "%s" has %s words; the minimum to publish is %s (stubs are held)',
          NEW.slug, words, min_words),
        hint = 'Word count strips HTML first, same as countBodyWords() in src/lib/agents/wire-hygiene.ts.';
    end if;
  end if;

  return NEW;
end;
$fn$;

comment on function public.articles_publish_gate() is
  'BEFORE INSERT OR UPDATE gate on public.articles: blocks publishing bodies under 550 words (magazine rows exempt) and retired stock covers. See supabase/migrations/20260928_publish_gate.sql.';

drop trigger if exists articles_publish_gate on public.articles;
create trigger articles_publish_gate
  before insert or update on public.articles
  for each row
  execute function public.articles_publish_gate();
