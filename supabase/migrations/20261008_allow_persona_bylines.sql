-- Re-applies articles_editorial_gate() without the persona-byline rejection.
-- Everything else (verdict, cap, exemptions) is unchanged.
-- Newsroom Phase 1, step B: editorial publish gate. Apply ONLY AFTER the code
-- from the Phase 1 PR is live in production (deploy order, approved revision 8).
-- Requires 20261007_newsroom_phase1_tables.sql. Idempotent.
--
-- Applies when an article BECOMES published (INSERT as published, or UPDATE from
-- a non-published status). Edits to already-published rows are never blocked.
--
-- Named exemptions (approved revision 6), checked in this order:
--   magazine         : NEW.magazine_id is not null (src/lib/sync-magazine.ts honoree rows)
--   success_insights : category slug 'success-insights' (profiles; middle scroller)
--   legacy           : origin = 'legacy' (rows published before Phase 1 being re-published)
--   studio_draft     : origin = 'legacy_studio_draft' (Studio drafts that existed on 2026-10-07)
-- Everything else needs an unconsumed editorial_verdicts row with decision PUBLISH,
-- (persona bylines allowed since 2026-10-08), room under the 8/day cap (America/New_York),
-- unless the verdict is is_breaking with a cap_override_reason (logged).

create or replace function public.articles_editorial_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  daily_cap constant integer := 8;
  exemption text;
  v public.editorial_verdicts%rowtype;
  cat_slug text;
  a_type text;
  today date := (now() at time zone 'America/New_York')::date;
  used integer;
  over_cap boolean := false;
begin
  if not (NEW.status = 'published' and (TG_OP = 'INSERT' or OLD.status is distinct from 'published')) then
    return NEW;
  end if;

  select slug into cat_slug from public.categories where id = NEW.category_id;

  exemption := case
    when NEW.magazine_id is not null then 'magazine'
    when cat_slug = 'success-insights' then 'success_insights'
    when NEW.origin = 'legacy' then 'legacy'
    when NEW.origin = 'legacy_studio_draft' then 'studio_draft'
    else null end;

  if exemption is not null then
    insert into public.newsroom_publish_log (article_id, ny_day, counted, exemption)
    values (NEW.id, today, false, exemption);
    return NEW;
  end if;

  -- Persona bylines allowed again (desk correspondents restored, 2026-10-07).

  select * into v from public.editorial_verdicts
   where id = coalesce(NEW.verdict_id,
           (select ev.id from public.editorial_verdicts ev
             where ev.article_id = NEW.id and ev.consumed_at is null
             order by ev.created_at desc limit 1))
   for update;

  if v.id is null then
    raise exception using errcode = 'check_violation',
      message = format('editorial gate: article "%s" has no Wire Editor verdict; publication REJECTED', NEW.slug),
      hint = 'File a reporting packet and get a PUBLISH verdict via /api/newsroom/verdicts.';
  end if;
  if v.decision <> 'PUBLISH' then
    raise exception using errcode = 'check_violation',
      message = format('editorial gate: verdict %s for "%s" is %s, not PUBLISH; publication REJECTED', v.id, NEW.slug, v.decision);
  end if;
  if v.consumed_at is not null and v.consumed_article_id is distinct from NEW.id then
    raise exception using errcode = 'check_violation',
      message = format('editorial gate: verdict %s was already used for another article', v.id);
  end if;
  if v.article_id is not null and v.article_id <> NEW.id then
    raise exception using errcode = 'check_violation',
      message = format('editorial gate: verdict %s belongs to a different article', v.id);
  end if;
  -- Belt and braces: the table constraints already enforce these.
  if v.total_points < 80 or v.s_added_value < 3 or v.s_accuracy <> 5
     or cardinality(v.hard_fails_unresolved) > 0 then
    raise exception using errcode = 'check_violation',
      message = format('editorial gate: verdict %s does not meet the PUBLISH bar', v.id);
  end if;

  perform pg_advisory_xact_lock(hashtext('newsroom_daily_cap'));
  select count(*) into used from public.newsroom_publish_log where ny_day = today and counted;
  if used >= daily_cap then
    if v.is_breaking and coalesce(btrim(v.cap_override_reason), '') <> '' then
      over_cap := true;
    else
      raise exception using errcode = 'check_violation',
        message = format('editorial gate: daily cap reached (%s/%s news publications for %s America/New_York)', used, daily_cap, today),
        hint = 'Only a breaking-news verdict with cap_override_reason may exceed the cap.';
    end if;
  end if;

  NEW.verdict_id := v.id;
  update public.editorial_verdicts
     set consumed_at = now(), consumed_article_id = NEW.id, article_id = NEW.id
   where id = v.id;
  insert into public.newsroom_publish_log
    (article_id, verdict_id, ny_day, counted, cap_override, override_by, override_reason)
  values (NEW.id, v.id, today, true, over_cap,
          case when over_cap then v.decided_by end,
          case when over_cap then v.cap_override_reason end);
  return NEW;
end;
$fn$;

comment on function public.articles_editorial_gate() is
  'Phase 1 editorial gate: no news article becomes published without a Wire Editor PUBLISH verdict; 8/day cap (America/New_York). See supabase/migrations/20261007_newsroom_phase1_gate.sql.';

drop trigger if exists articles_editorial_gate on public.articles;
create trigger articles_editorial_gate
  before insert or update on public.articles
  for each row
  execute function public.articles_editorial_gate();
