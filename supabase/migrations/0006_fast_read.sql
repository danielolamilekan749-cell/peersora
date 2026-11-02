-- =============================================================================
-- Daylight - 0006: one fast read for the server
-- =============================================================================
-- The website was reading every table separately. This function returns them
-- all in one call, which makes the feed, saves, likes and orders much faster.
-- Only the server (service role) can run it. The public key cannot.
--
-- Run once in Supabase -> SQL Editor, after 0001 to 0005.
-- =============================================================================

create or replace function public.app_read()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'accounts', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.accounts t), '[]'::jsonb),
    'profiles', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.profiles t), '[]'::jsonb),
    'posts', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.posts t), '[]'::jsonb),
    'post_images', coalesce((select jsonb_agg(to_jsonb(t) order by t.post_id, t.position) from public.post_images t), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.comments t), '[]'::jsonb),
    'likes', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.likes t), '[]'::jsonb),
    'saved_posts', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.saved_posts t), '[]'::jsonb),
    'saved_profiles', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.saved_profiles t), '[]'::jsonb),
    'blocks', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.blocks t), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.orders t), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.reviews t), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.reports t), '[]'::jsonb),
    'notifications', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.notifications t), '[]'::jsonb),
    'verifications', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.verifications t), '[]'::jsonb),
    'appeals', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.appeals t), '[]'::jsonb),
    'profile_views', coalesce((select jsonb_agg(to_jsonb(t) order by t.day) from public.profile_views t), '[]'::jsonb),
    'audit_logs', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.audit_logs t), '[]'::jsonb)
  );
$$;

revoke all on function public.app_read() from public, anon, authenticated;
grant execute on function public.app_read() to service_role;
