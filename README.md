This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Newsroom pipeline

Weekday GitHub Actions hits `GET /api/cron/publish` with `Authorization: Bearer $CRON_SECRET`. The route pulls fresh items from a curated RSS list, drafts via the desk writers, and publishes only if the editor-in-chief scores the piece **≥ 8.5**.

### Schedule (U.S. Eastern newsroom window)

- **When:** Monday–Friday, every **15 minutes**, about **7:00am–6:45pm America/New_York**.
- **UTC cron:** `*/15 11-22 * * 1-5` (GitHub Actions cron is UTC).
- **EDT (UTC-4, including September):** 11:00–22:45 UTC = 7:00am–6:45pm ET.
- **EST (UTC-5):** the same UTC clock is 6:00am–5:45pm ET.
- **Off:** overnight and weekends. Use `workflow_dispatch` for a one-off run. No Vercel cron.

Auth is unchanged: the route still requires `Authorization: Bearer $CRON_SECRET`.

### Editorial bar (Forbes / Entrepreneur)

Prompts live in `src/lib/agents/prompts.ts`. The coded pipeline writes volume; this is not a chat bot.

Score is 0–10 after the edit (`PUBLISH_SCORE_MIN = 8.5`). An **8.0** is a competent wire expansion and is **held**.

| Score | Meaning |
| --- | --- |
| **8.5+** | Specific, attributed, operator-useful; news-first; no invented facts. Publishable. |
| **8.0** | Close: soft lede, generic "so what," or press-release cadence. Hold. |
| **<8** | Thin, fluffy, unsourced, or marketing voice. Hold. |

An 8.5 requires named attribution from the RSS notes, no invented quotes/figures/analysts, a concrete stake for an operator or allocator, and tight newspaper English. HTML output is `<p>` body copy plus the required `<h3>` section heads.

### Defaults

**Required env vars:** `CRON_SECRET`, `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

**Optional env vars:**
- `NEWS_FEEDS_JSON` — JSON array that replaces the default feed list, e.g. `[{"name":"TechCrunch","url":"https://techcrunch.com/feed/","desk":"tech"}]`. Desk must be `tech`, `markets`, `ma`, `strategy`, `macro`, or `retail`. Optional feeds may set `"optional": true` and `"timeoutMs": 18000`.
- `NEWS_LEAD_BATCH_SIZE` — how many leads to process per run (default **`2`**, max **`3`**). Cron `maxDuration` is **300s** so a default batch of two long-form drafts (writer + editor) can finish.
- `NEWS_LEAD_DEDUPE_DAYS` — skip titles/URLs seen in this window (default `7`). Near-duplicate titles (rewritten chip-export fixtures, same story different headline) are also skipped.
- `GEMINI_MODEL` — primary writer/editor model (default `gemini-3.6-flash`). Free-tier Flash is **20 requests/day**; a 15-minute batch of 2 long-form stories needs 4 calls per tick.
- `GEMINI_FALLBACK_MODEL` — used when the primary model returns 429 (default `gemini-3.5-flash-lite`, ~500 RPD on free tier). Set to empty to disable fallback. Enable Gemini billing (Tier 1+) if you want sustained `gemini-3.6-flash` volume.
- `USE_TEST_LEAD=1` — local/preview fallback that skips RSS and uses the old fixture lead. Ignored when `VERCEL_ENV=production`.

If Gemini quota is exhausted on every configured model, the cron returns **200** with `reason: "llm_quota_exhausted"` so the weekday Action stays green. Auth is unchanged: missing/invalid `CRON_SECRET` is still **401**.

Default feeds live in `src/lib/agents/feeds.ts` (TechCrunch, CNBC tech/finance/economy/retail, Federal Reserve, SEC, NPR Business, PR Newswire M&A). A dead feed is logged and skipped; the cron keeps going. Per-feed timeout is **12s** (was 8s). **PR Newswire M&A** is marked `optional` with an **18s** budget so a timeout cannot fail the run.

Intake prefers a **least-recently-used desk rotation**: when several fresh leads exist, a tech feed does not take every slot. The picker round-robins desks, starting with those that have not published recently (`processed_leads`).

Dedupe checks recent Supabase `articles` (normalized title, slug prefix, source URL in body) plus `processed_leads` so held stories are not retried every run. Apply the `processed_leads` table from `supabase/schema.sql` in the Supabase SQL editor. If that table is missing, intake still runs and falls back to article-only dedupe.

Attribution is source name + URL + a short RSS summary in `rawSource` notes. The pipeline does not scrape article HTML.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
