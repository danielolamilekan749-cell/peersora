-- =============================================================================
-- Daylight - 0004: lock the database to the server
-- =============================================================================
-- The website never talks to your tables from the browser. The browser only
-- uses Supabase for Google sign-in; every read and write goes through the
-- Next.js server with the service-role key. So the public (anon) key and
-- signed-in browser sessions get NO direct access to tables, views or
-- functions. This clears the "UNRESTRICTED" warnings in the Table Editor.
--
-- Run once in Supabase -> SQL Editor, after 0001, 0002 and 0003.
-- =============================================================================

-- 1. Row level security on every table, no matter what.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- 2. Views run with the caller's permissions, so they can never bypass RLS.
alter view if exists public.public_profiles set (security_invoker = true);
alter view if exists public.public_posts set (security_invoker = true);
alter view if exists public.public_comments set (security_invoker = true);
alter view if exists public.public_reviews set (security_invoker = true);
alter view if exists public.my_hook_stats set (security_invoker = true);

-- 3. Take away every direct grant from the public and browser roles.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- Anything created later starts locked too.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

-- 4. The server (service role) keeps full access.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
