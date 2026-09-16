-- Honoree profile links and issue flipbook destination for magazine landing pages.

alter table public.articles
  add column if not exists magazine_page integer,
  add column if not exists designation text,
  add column if not exists subheading text,
  add column if not exists company text,
  add column if not exists bio text,
  add column if not exists linkedin_url text,
  add column if not exists website_url text,
  add column if not exists flipbook_url text;

alter table public.magazines
  add column if not exists flipbook_url text;

notify pgrst, 'reload schema';
