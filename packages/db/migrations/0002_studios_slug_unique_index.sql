-- Public studio pages resolve a studio by slug (GET /s/[slug]); back that
-- lookup with an index and guarantee slugs are unique so the lookup is
-- unambiguous.
create unique index studios_slug_key on public.studios (slug);
