This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Newsroom pipeline

Hourly GitHub Actions hits `GET /api/cron/publish` with `Authorization: Bearer $CRON_SECRET`. The route pulls one fresh item from a curated RSS list, drafts via the desk writers, and publishes only if the editor-in-chief scores it ≥ 8.

**Required env vars:** `CRON_SECRET`, `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

**Optional env vars:**
- `NEWS_FEEDS_JSON` — JSON array that replaces the default feed list, e.g. `[{"name":"TechCrunch","url":"https://techcrunch.com/feed/","desk":"tech"}]`. Desk must be `tech`, `markets`, `ma`, `strategy`, `macro`, or `retail`.
- `NEWS_LEAD_BATCH_SIZE` — how many leads to process per run (default `1`, max `3`).
- `NEWS_LEAD_DEDUPE_DAYS` — skip titles/URLs seen in this window (default `7`).
- `USE_TEST_LEAD=1` — local-only fallback that skips RSS and uses the old fixture lead.

Default feeds live in `src/lib/agents/feeds.ts` (TechCrunch, CNBC tech/finance/economy/retail, Federal Reserve, SEC, NPR Business, PR Newswire M&A). A dead feed is logged and skipped; the cron keeps going.

Dedupe checks recent Supabase `articles` (normalized title, slug prefix, source URL in body) plus `processed_leads` so held stories are not retried every hour. Apply the `processed_leads` table from `supabase/schema.sql` in the Supabase SQL editor. If that table is missing, intake still runs and falls back to article-only dedupe.

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
