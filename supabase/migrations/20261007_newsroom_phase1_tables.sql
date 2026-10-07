-- Newsroom Phase 1, step A: tables and columns only (no publish gate change).
-- Safe to apply before the code deploy: nothing here blocks an existing write path.
-- Idempotent. Apply BEFORE 20261007_newsroom_phase1_gate.sql.

-- ---------------------------------------------------------------- story_signals
create table if not exists public.story_signals (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_url text not null,
  normalized_url text not null,
  title text not null,
  title_key text not null,
  card text not null,                       -- signal card, <= ~120 words. NOT an article.
  source_published_at timestamptz,
  signal_score integer not null default 0 check (signal_score between 0 and 100),
  entities text[] not null default '{}',
  primary_entity text,
  event_type text not null default 'other',
  source_type text not null default 'news'
    check (source_type in ('primary_filing','regulator','company_ir','news','press_release','other')),
  materiality text not null default 'low' check (materiality in ('low','medium','high')),
  suggested_desk text check (suggested_desk in ('macro','markets','ma','strategy','tech','retail','features')),
  status text not null default 'new'
    check (status in ('new','triaged','claimed','monitor','timeline','rejected','duplicate','expired')),
  cluster_key text not null,                -- primary_entity|event_type (or title-key fallback)
  duplicate_of uuid references public.story_signals(id) on delete set null,
  triage_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint story_signals_card_len check (char_length(card) <= 1200)
);
create unique index if not exists story_signals_normalized_url_key on public.story_signals (normalized_url);
create index if not exists story_signals_status_score_idx on public.story_signals (status, signal_score desc);
create index if not exists story_signals_cluster_idx on public.story_signals (cluster_key, created_at desc);

-- ---------------------------------------------------------------- story_claims
create table if not exists public.story_claims (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid references public.story_signals(id) on delete set null,
  desk text not null check (desk in ('macro','markets','ma','strategy','tech','retail','features')),
  entity text not null,
  event_type text not null,
  claim_status text not null default 'open'
    check (claim_status in ('open','packet_filed','published','released','rejected','merged')),
  claimed_by text not null,                 -- newsroom role that made the claim (from API token)
  note text,
  claimed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);
-- One owning desk per entity+event while the claim is open (approved revision 9).
create unique index if not exists story_claims_one_open_owner
  on public.story_claims (lower(entity), lower(event_type))
  where claim_status in ('open','packet_filed');

-- ---------------------------------------------------------------- reporting_packets
create table if not exists public.reporting_packets (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references public.story_claims(id) on delete set null,
  signal_id uuid references public.story_signals(id) on delete set null,
  desk text not null check (desk in ('macro','markets','ma','strategy','tech','retail','features')),
  submitted_by text not null,
  headline_working text not null,
  what_happened text not null,
  what_is_new text not null,
  why_tradeflock text not null,
  why_tradeflock_type text not null,        -- analysis|context|data|comparison|timeline|regulatory|...
  primary_sources jsonb not null default '[]'::jsonb,   -- [{url,title,type,accessed_at}]
  verified_facts jsonb not null default '[]'::jsonb,    -- [{fact,source_url}]
  key_numbers jsonb not null default '[]'::jsonb,
  entities text[] not null default '{}',
  existing_coverage jsonb not null default '[]'::jsonb, -- prior TradeFlock URLs
  open_questions text,
  search_intent text,
  recommended_content_type text not null,
  recommendation text not null
    check (recommendation in ('PUBLISH','ESCALATE_TO_FEATURES','HOLD_MONITOR','UPDATE_EXISTING','CONSOLIDATE','REJECT')),
  draft_article_id uuid references public.articles(id) on delete set null,
  packet jsonb not null default '{}'::jsonb,            -- full §5 packet
  status text not null default 'submitted'
    check (status in ('submitted','in_review','verdicted','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reporting_packets_primary_source check (jsonb_array_length(primary_sources) >= 1)
);

-- ---------------------------------------------------------------- editorial_verdicts
-- Scorecard v1: each criterion 0-5, weighted 25/20/15/10/10/10/5/5 = 100.
create table if not exists public.editorial_verdicts (
  id uuid primary key default gen_random_uuid(),
  packet_id uuid not null references public.reporting_packets(id) on delete restrict,
  article_id uuid references public.articles(id) on delete set null,
  decision text not null check (decision in
    ('PUBLISH','REVISE','SEND_BACK','ESCALATE_TO_FEATURES','HOLD_MONITOR','UPDATE_EXISTING','CONSOLIDATE','REJECT')),
  s_added_value smallint not null check (s_added_value between 0 and 5),   -- 25
  s_accuracy    smallint not null check (s_accuracy between 0 and 5),      -- 20
  s_sourcing    smallint not null check (s_sourcing between 0 and 5),      -- 15
  s_news_value  smallint not null check (s_news_value between 0 and 5),    -- 10
  s_context     smallint not null check (s_context between 0 and 5),       -- 10
  s_reader_value smallint not null check (s_reader_value between 0 and 5), -- 10
  s_search_fit  smallint not null check (s_search_fit between 0 and 5),    -- 5
  s_style       smallint not null check (s_style between 0 and 5),         -- 5
  total_points integer generated always as (
    s_added_value*5 + s_accuracy*4 + s_sourcing*3 + s_news_value*2 + s_context*2
    + s_reader_value*2 + s_search_fit*1 + s_style*1) stored,
  hard_fails_checked text[] not null default '{}',
  hard_fails_unresolved text[] not null default '{}',
  figure_checks jsonb not null default '{}'::jsonb,
  seo_decision jsonb not null default '{}'::jsonb,     -- {new_page_needed, intent, canonical, internal_links}
  duplicate_check text,
  is_breaking boolean not null default false,
  cap_override_reason text,                            -- only with is_breaking
  notes text,
  decided_by text not null,
  consumed_at timestamptz,                             -- set by the publish gate
  consumed_article_id uuid,
  -- clock_timestamp so the latest verdict wins even within one transaction
  created_at timestamptz not null default clock_timestamp(),
  constraint editorial_verdicts_publish_bar check (
    decision <> 'PUBLISH' or (
      (s_added_value*5 + s_accuracy*4 + s_sourcing*3 + s_news_value*2 + s_context*2
        + s_reader_value*2 + s_search_fit + s_style) >= 80
      and s_added_value >= 3
      and s_accuracy = 5
      and cardinality(hard_fails_unresolved) = 0)),
  -- HF9 never publishes: it maps to REVISE.
  constraint editorial_verdicts_hf9_revise check (
    not ('HF9' = any(hard_fails_unresolved)) or decision = 'REVISE'),
  constraint editorial_verdicts_override_breaking check (
    cap_override_reason is null or is_breaking)
);
create index if not exists editorial_verdicts_article_idx on public.editorial_verdicts (article_id, created_at desc);

-- ---------------------------------------------------------------- article_updates
create table if not exists public.article_updates (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  verdict_id uuid references public.editorial_verdicts(id) on delete set null,
  update_type text not null check (update_type in ('update','correction','consolidation','clarification')),
  summary text not null,
  source_urls text[] not null default '{}',
  made_by text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- publish ledger (cap + overrides)
create table if not exists public.newsroom_publish_log (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null,
  verdict_id uuid,
  ny_day date not null,
  counted boolean not null,               -- counts toward the 8/day cap
  cap_override boolean not null default false,
  override_by text,
  override_reason text,
  exemption text,                          -- named exemption, when not gated
  created_at timestamptz not null default now()
);
create index if not exists newsroom_publish_log_day_idx on public.newsroom_publish_log (ny_day) where counted;

-- ---------------------------------------------------------------- articles columns
alter table public.articles add column if not exists origin text;
alter table public.articles add column if not exists content_type text;
alter table public.articles add column if not exists verdict_id uuid references public.editorial_verdicts(id) on delete set null;
alter table public.articles add column if not exists ai_assisted boolean not null default true;
alter table public.articles add column if not exists why_tradeflock text;
alter table public.articles add column if not exists primary_source_urls text[];

-- authors: persona flag so invented correspondents cannot pass as humans.
alter table public.authors add column if not exists author_type text not null default 'person';
do $$ begin
  alter table public.authors add constraint authors_author_type_allowed
    check (author_type in ('person','organization','persona'));
exception when duplicate_object then null; end $$;

update public.authors set author_type = 'persona'
 where slug in ('marcus-chen','sophia-brennan','james-whitaker','elena-vasquez','priya-nair','marcus-vance','david-chen')
   and author_type <> 'persona';

insert into public.authors (name, slug, bio, title, author_type)
values ('TradeFlock Newsroom', 'tradeflock-newsroom',
        'AI-assisted reporting by the TradeFlock desks. Every news story is reviewed by the Wire Editor, an AI editing assistant, before it is published. See /standards.',
        'AI-assisted newsroom', 'organization')
on conflict (slug) do update set author_type = 'organization';

-- origin backfill (named exemptions depend on it).
--   legacy               : rows already published before Phase 1
--   legacy_studio_draft  : existing Studio drafts by non-persona authors (exempt)
--   legacy_wire_hold     : existing held wire drafts (persona bylines) - NOT exempt
update public.articles a set origin = case
    when a.status = 'published' then 'legacy'
    when exists (select 1 from public.authors au where au.id = a.author_id and au.author_type = 'persona') then 'legacy_wire_hold'
    else 'legacy_studio_draft' end
 where a.origin is null;

alter table public.articles alter column origin set default 'studio';
do $$ begin
  alter table public.articles add constraint articles_origin_allowed check (origin in
    ('legacy','legacy_studio_draft','legacy_wire_hold','signal','desk','features','studio','magazine'));
exception when duplicate_object then null; end $$;

-- RLS: newsroom tables are service-side only (the newsroom API); no anon access.
alter table public.story_signals enable row level security;
alter table public.story_claims enable row level security;
alter table public.reporting_packets enable row level security;
alter table public.editorial_verdicts enable row level security;
alter table public.article_updates enable row level security;
alter table public.newsroom_publish_log enable row level security;
