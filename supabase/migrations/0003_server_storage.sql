-- =============================================================================
-- Daylight - 0003: storage for the Next.js server
-- =============================================================================
-- The website's server (Vercel) now stores everything in this database through
-- the Supabase service-role key. The app enforces who may do what; row level
-- security stays on so nobody can read or write with the public (anon) key.
--
-- Run this once in Supabase -> SQL Editor, after 0001 and 0002.
-- =============================================================================

-- The server writes notifications itself, so these database triggers would
-- create every like/comment notification twice.
drop trigger if exists likes_notify on public.likes;
drop trigger if exists comments_notify on public.comments;
drop trigger if exists follows_notify on public.follows;

-- One image per slot, so the server can update a post's photos in place.
delete from public.post_images a
using public.post_images b
where a.post_id = b.post_id and a.position = b.position and a.ctid > b.ctid;

create unique index if not exists post_images_post_position_uq
  on public.post_images (post_id, position);

-- A user can place a new order once the old one is accepted; only one
-- *waiting* order per profile is allowed.
drop index if exists public.orders_one_open_uq;
create unique index if not exists orders_one_pending_uq
  on public.orders (user_id, profile_id) where status = 'pending';

-- One account per email address.
create unique index if not exists accounts_email_uq
  on public.accounts (lower(email)) where email <> '';

-- Make sure the service role can use everything above.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
