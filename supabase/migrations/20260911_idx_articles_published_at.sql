-- Keep in sync with scripts/create-published-at-index.mjs
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON public.articles (published_at DESC);
