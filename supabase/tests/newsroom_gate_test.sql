-- Phase 1 DB publish-gate test. Run inside a transaction and ROLLBACK, e.g.:
--   psql "$DB" -v ON_ERROR_STOP=1 -1 -f supabase/tests/newsroom_gate_test.sql
-- Every check raises on failure. All rows are created and removed in the
-- same transaction (ends with ROLLBACK), so nothing persists.
begin;

create or replace function pg_temp.expect_fail(sql text, needle text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    if strpos(sqlerrm, needle) = 0 then
      raise exception 'expected error containing "%", got: %', needle, sqlerrm;
    end if;
    raise notice 'PASS (rejected as expected): %', left(sqlerrm, 110);
    return;
  end;
  raise exception 'expected failure "%" but statement succeeded: %', needle, sql;
end $$;

do $$
declare
  cat uuid := (select id from public.categories where slug <> 'success-insights' order by slug limit 1);
  si uuid := (select id from public.categories where slug = 'success-insights');
  org uuid := (select id from public.authors where slug = 'tradeflock-newsroom');
  persona uuid := (select id from public.authors where author_type = 'persona' limit 1);
  body text := repeat('verified primary source analysis ', 200);
  art uuid; art2 uuid; pkt uuid; v uuid; i int;
begin
  -- C. Publish without a verdict -> REJECTED
  insert into public.articles (slug, title, excerpt, body, cover_image_url, category_id, author_id, status, origin)
  values ('zz-gate-test-a', 'Gate test A', 'x', body, '', cat, org, 'draft', 'desk') returning id into art;
  perform pg_temp.expect_fail(format('update public.articles set status=''published'' where id=%L', art), 'no Wire Editor verdict');
  perform pg_temp.expect_fail(format(
    'insert into public.articles (slug,title,excerpt,body,cover_image_url,category_id,author_id,status,origin) values (''zz-gate-direct'',''t'',''x'',%L,'''',%L,%L,''published'',''signal'')', body, cat, org),
    'no Wire Editor verdict');

  insert into public.reporting_packets (desk, submitted_by, headline_working, what_happened, what_is_new, why_tradeflock,
    why_tradeflock_type, primary_sources, recommended_content_type, recommendation, draft_article_id)
  values ('markets', 'desk_markets', 'h', 'w', 'n', 'original calculation', 'data',
    '[{"url":"https://www.sec.gov/x"}]', 'news_analysis', 'PUBLISH', art) returning id into pkt;

  -- Non-PUBLISH verdict -> still rejected
  insert into public.editorial_verdicts (packet_id, article_id, decision, s_added_value, s_accuracy, s_sourcing, s_news_value,
    s_context, s_reader_value, s_search_fit, s_style, decided_by)
  values (pkt, art, 'REVISE', 4,5,4,4,4,4,4,4, 'wire_editor');
  perform pg_temp.expect_fail(format('update public.articles set status=''published'' where id=%L', art), 'not PUBLISH');

  -- Scorecard constraints: PUBLISH below bar / accuracy 4 / HF9 -> refused by table
  perform pg_temp.expect_fail(format('insert into public.editorial_verdicts (packet_id,article_id,decision,s_added_value,s_accuracy,s_sourcing,s_news_value,s_context,s_reader_value,s_search_fit,s_style,decided_by) values (%L,%L,''PUBLISH'',4,4,5,5,5,5,5,5,''wire_editor'')', pkt, art), 'editorial_verdicts_publish_bar');
  perform pg_temp.expect_fail(format('insert into public.editorial_verdicts (packet_id,article_id,decision,s_added_value,s_accuracy,s_sourcing,s_news_value,s_context,s_reader_value,s_search_fit,s_style,decided_by) values (%L,%L,''PUBLISH'',2,5,5,5,5,5,5,5,''wire_editor'')', pkt, art), 'editorial_verdicts_publish_bar');
  perform pg_temp.expect_fail(format('insert into public.editorial_verdicts (packet_id,article_id,decision,s_added_value,s_accuracy,s_sourcing,s_news_value,s_context,s_reader_value,s_search_fit,s_style,hard_fails_unresolved,decided_by) values (%L,%L,''PUBLISH'',5,5,5,5,5,5,5,5,''{HF9}'',''wire_editor'')', pkt, art), 'editorial_verdicts_');
  perform pg_temp.expect_fail(format('insert into public.editorial_verdicts (packet_id,article_id,decision,s_added_value,s_accuracy,s_sourcing,s_news_value,s_context,s_reader_value,s_search_fit,s_style,decided_by) values (%L,%L,''BLOCK'',5,5,5,5,5,5,5,5,''wire_editor'')', pkt, art), 'editorial_verdicts_decision_check');

  -- D. Valid packet + PUBLISH verdict -> publication succeeds.
  -- Persona bylines are allowed again (desk correspondents). Use one for this
  -- publish when a persona author exists, so the check does not take a second cap slot.
  if persona is not null then
    update public.articles set author_id = persona where id = art;
  end if;
  insert into public.editorial_verdicts (packet_id, article_id, decision, s_added_value, s_accuracy, s_sourcing, s_news_value,
    s_context, s_reader_value, s_search_fit, s_style, decided_by)
  values (pkt, art, 'PUBLISH', 4,5,4,4,4,4,4,4, 'wire_editor') returning id into v;
  update public.articles set status = 'published' where id = art;
  if (select verdict_id from public.articles where id = art) <> v then raise exception 'verdict not linked'; end if;
  if (select consumed_at from public.editorial_verdicts where id = v) is null then raise exception 'verdict not consumed'; end if;
  if persona is not null and (select author_id from public.articles where id = art) is distinct from persona then
    raise exception 'persona byline was not kept';
  end if;
  raise notice 'PASS: PUBLISH verdict publishes and is consumed';

  -- Verdict cannot be reused for another article
  insert into public.articles (slug, title, excerpt, body, cover_image_url, category_id, author_id, status, origin, verdict_id)
  values ('zz-gate-test-b', 'Gate test B', 'x', body, '', cat, org, 'draft', 'desk', v) returning id into art2;
  perform pg_temp.expect_fail(format('update public.articles set status=''published'' where id=%L', art2), 'already used');

  -- J. Named exemptions still publish without a verdict
  insert into public.articles (slug, title, excerpt, body, cover_image_url, category_id, author_id, status, origin, magazine_id)
  values ('zz-gate-mag', 'm', 'x', 'short honoree bio', '', cat, org, 'published', 'magazine', gen_random_uuid());
  if si is not null then
    insert into public.articles (slug, title, excerpt, body, cover_image_url, category_id, author_id, status, origin)
    values ('zz-gate-si', 's', 'x', body, '', si, org, 'published', 'studio');
  end if;
  insert into public.articles (slug, title, excerpt, body, cover_image_url, category_id, author_id, status, origin)
  values ('zz-gate-legacy-draft', 'l', 'x', body, '', cat, org, 'draft', 'legacy_studio_draft') returning id into art2;
  update public.articles set status = 'published' where id = art2;
  -- Edits to already-published rows are not gated
  update public.articles set title = 'edited' where status = 'published' and origin = 'legacy'
    and id = (select id from public.articles where origin = 'legacy' and status = 'published' limit 1);
  raise notice 'PASS: magazine / success_insights / studio_draft exemptions and published-row edits';

  -- Daily cap: fill to 8 counted publications for today, then the 9th fails
  select count(*) into i from public.newsroom_publish_log
   where ny_day = (now() at time zone 'America/New_York')::date and counted;
  while i < 8 loop
    insert into public.newsroom_publish_log (article_id, ny_day, counted) values (gen_random_uuid(), (now() at time zone 'America/New_York')::date, true);
    i := i + 1;
  end loop;
  insert into public.articles (slug, title, excerpt, body, cover_image_url, category_id, author_id, status, origin)
  values ('zz-gate-cap', 'c', 'x', body, '', cat, org, 'draft', 'desk') returning id into art2;
  insert into public.editorial_verdicts (packet_id, article_id, decision, s_added_value, s_accuracy, s_sourcing, s_news_value,
    s_context, s_reader_value, s_search_fit, s_style, decided_by)
  values (pkt, art2, 'PUBLISH', 5,5,5,5,5,5,5,5, 'wire_editor');
  perform pg_temp.expect_fail(format('update public.articles set status=''published'' where id=%L', art2), 'daily cap reached');
  -- Breaking override (logged) succeeds
  insert into public.editorial_verdicts (packet_id, article_id, decision, s_added_value, s_accuracy, s_sourcing, s_news_value,
    s_context, s_reader_value, s_search_fit, s_style, is_breaking, cap_override_reason, decided_by)
  values (pkt, art2, 'PUBLISH', 5,5,5,5,5,5,5,5, true, 'Emergency Fed rate decision', 'wire_editor');
  update public.articles set status = 'published' where id = art2;
  if not exists (select 1 from public.newsroom_publish_log where article_id = art2 and cap_override and override_reason is not null and override_by = 'wire_editor') then
    raise exception 'override not logged';
  end if;
  raise notice 'PASS: 8/day cap enforced; breaking override logged with who/why';

  -- One owning desk per entity+event
  insert into public.story_claims (desk, entity, event_type, claimed_by) values ('ma', 'Zz Test Co', 'm_and_a', 'desk_ma');
  perform pg_temp.expect_fail('insert into public.story_claims (desk, entity, event_type, claimed_by) values (''markets'', ''zz test co'', ''M_AND_A'', ''desk_markets'')', 'story_claims_one_open_owner');
  raise notice 'ALL NEWSROOM GATE TESTS PASSED';
end $$;

rollback;
