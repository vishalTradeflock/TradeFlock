# Chief of Staff triage (automated)

- Schedule: `.github/workflows/chief-of-staff-triage.yml`, 3 runs/day at 08:00, 12:30, 16:30 America/New_York
  (UTC crons set for EDT; one hour earlier in EST). Calls `GET /api/cron/triage` with `CRON_SECRET`;
  `?dry=1` decides without writing. The job fails if the response is not `"published":0` and `"articlesCreated":0`.
- Input: `story_signals` with `status = 'new'` only (not claimed or resolved), excluding signals that already have an
  open claim. Each update is conditional on `status = 'new'`, so manual triage always wins.
- Rank = signal_score + materiality (high 15 / medium 5) + source quality (primary filing/regulator +10,
  press release -15) + event type weight + watched entity +15 (`NEWSROOM_WATCHED_ENTITIES` overrides the default list)
  - 10 if TradeFlock covered the entity in the last 30 days.
- Outcomes: duplicate (entity already has an open claim, or cluster handled this run), reject (press release,
  no entity/event, rank < 75), timeline (covered entity, not high materiality), Features escalation (rank >= 100
  and cluster of 3+ signals), assign to Macro/Markets/M&A/Strategy/Tech/Retail (rank >= 100, primary source,
  medium/high materiality), monitor (rank >= 75 or claim budget used).
- Budget: at most 8 claims per New York day (mirrors the 8/day publication cap) and 3 per run.
- One owner per event: app-level normalised entity check plus the DB unique index `story_claims_one_open_owner`
  (a 23505 on insert marks the signal duplicate).
- Desk notification: `GET /api/newsroom/claims?desk=mine&status=open` with the desk token (or `?desk=<desk>`).
- Triage never creates articles, packets or verdicts and never publishes. Desk -> packet -> Wire Editor -> PUBLISH
  verdict -> `/api/newsroom/publish` (DB gate) remains the only normal path.

## Deferred: DB-role hardening
The newsroom API and the triage cron use the Supabase service role. The DB editorial gate trigger applies to the
service role too, so publication still needs a PUBLISH verdict, but the service role can still write the newsroom
tables directly. Moving the API onto a dedicated low-privilege Postgres role (insert/update on story_signals,
story_claims, reporting_packets, editorial_verdicts; update of articles.status only) stays deferred.
