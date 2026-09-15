-- SEO fields for Studio drafts and public news pages.

alter table public.articles
  add column if not exists meta_title text,
  add column if not exists meta_description text;

notify pgrst, 'reload schema';
