-- Daylight health check. Run in Supabase -> SQL Editor and read the result.
-- Every row in the "ok" column should say true.

select * from (values
  ('0002 applied: complete_hook_profile takes a location',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'complete_hook_profile'
              and 'p_location' = any (p.proargnames))),
  ('0002 applied: max 10 photos per post',
    exists (select 1 from pg_trigger where tgname = 'post_images_limit')),
  ('0003 applied: one image per slot',
    exists (select 1 from pg_indexes where indexname = 'post_images_post_position_uq')),
  ('0003 applied: like/comment notification triggers removed',
    not exists (select 1 from pg_trigger where tgname in ('likes_notify', 'comments_notify', 'follows_notify'))),
  ('0003 applied: one waiting order per profile',
    exists (select 1 from pg_indexes where indexname = 'orders_one_pending_uq')),
  ('0004 applied: anon cannot read any table or view',
    not exists (select 1 from information_schema.role_table_grants
                where table_schema = 'public' and grantee = 'anon')),
  ('0004 applied: browser sessions cannot read any table or view',
    not exists (select 1 from information_schema.role_table_grants
                where table_schema = 'public' and grantee = 'authenticated')),
  ('Row level security is on for every table',
    not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity)),
  ('Sign-up trigger exists (Google creates an account row)',
    exists (select 1 from pg_trigger where tgname = 'on_auth_user_created')),
  ('Storage buckets avatars + posts exist',
    (select count(*) from storage.buckets where id in ('avatars', 'posts')) = 2)
) as t(check_name, ok);

-- What is in the database right now.
select 'accounts' as tbl, count(*) from public.accounts
union all select 'profiles', count(*) from public.profiles
union all select 'posts', count(*) from public.posts
union all select 'post_images', count(*) from public.post_images
union all select 'likes', count(*) from public.likes
union all select 'comments', count(*) from public.comments
union all select 'orders', count(*) from public.orders
union all select 'reviews', count(*) from public.reviews
union all select 'notifications', count(*) from public.notifications;
