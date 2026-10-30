-- =============================================================================
-- Daylight - complete Supabase schema (adults-only, 18+)
--
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- It is safe to run more than once (idempotent).
--
-- What it sets up
--   * Accounts for three types: user (role "member"), hook (role "creator"),
--     and admin. Google sign-in creates the account automatically.
--   * Hook profiles (photo + location) that stay hidden until an admin approves.
--   * Posts + images, likes, comments, follows, saved posts, saved profiles.
--   * Orders ("Order now"). There is no chat.
--   * Ratings/reviews that only users with an accepted/completed order can give.
--   * Blocks, reports, notifications, verification queue, appeals, profile views.
--   * Admin tools (audited), public read-only views, storage buckets, and RLS.
--
-- After running (see the checklist at the bottom of this file)
--   1. Authentication > Providers > Google: enable and add the client id/secret.
--   2. Authentication > URL Configuration: add your site URL and
--      {SITE_URL}/auth/callback as a redirect URL.
--   3. Sign in once with your own Google account, then promote yourself:
--        update public.accounts set role = 'admin'
--        where email = 'you@example.com';
--
-- Security notes
--   * The service-role key must never reach browser code.
--   * No email or phone is ever exposed through the public views.
--   * Date of birth is private; only a computed age is public.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enum types
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('member', 'creator', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.location_privacy as enum ('city', 'region', 'hidden');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum ('pending', 'accepted', 'declined', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.review_status as enum ('published', 'hidden', 'removed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_status as enum ('open', 'resolved', 'dismissed');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 2. Tables
-- -----------------------------------------------------------------------------

-- One row per signed-in person. Created automatically by handle_new_user().
create table if not exists public.accounts (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'member',
  email text not null default '',
  full_name text not null default '',
  avatar_url text not null default '',
  provider text not null default 'google',
  phone text not null default '',
  status text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  deactivated boolean not null default false,
  age_confirmed_at timestamptz,
  terms_accepted_at timestamptz,
  notification_prefs jsonb not null default
    '{"followers":true,"likes":true,"comments":true,"orders":true,"announcements":true,"verification":true}'::jsonb,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Public face of a hook. Admins approve it before it becomes discoverable.
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.accounts (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 2 and 60),
  bio text not null default '' check (char_length(bio) <= 500),
  interests text[] not null default '{}',
  avatar_url text not null default '',
  cover_url text not null default '',
  city text not null default '',
  region text not null default '',
  country text not null default '',
  location_privacy public.location_privacy not null default 'city',
  date_of_birth date,
  age_verified boolean not null default false,
  identity_verified boolean not null default false,
  visibility text not null default 'hidden' check (visibility in ('public', 'hidden')),
  discoverable boolean not null default false,
  featured boolean not null default false,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  constraint profiles_adult_dob check (
    date_of_birth is null or date_of_birth <= (current_date - interval '18 years')
  )
);
create index if not exists profiles_discover_idx
  on public.profiles (discoverable, visibility, age_verified, created_at desc);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  caption text not null default '' check (char_length(caption) <= 2200),
  frame text not null default 'portrait' check (frame in ('portrait', 'square')),
  visibility text not null default 'public' check (visibility in ('public', 'hidden')),
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists posts_profile_idx on public.posts (profile_id, created_at desc);
create index if not exists posts_feed_idx on public.posts (visibility, created_at desc);

create table if not exists public.post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  url text not null,
  position int not null default 0
);
create index if not exists post_images_post_idx on public.post_images (post_id, position);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.accounts (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments (post_id, created_at);

create table if not exists public.follows (
  follower_id uuid not null references public.accounts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, profile_id)
);
create index if not exists follows_profile_idx on public.follows (profile_id);

create table if not exists public.likes (
  user_id uuid not null references public.accounts (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index if not exists likes_post_idx on public.likes (post_id);

-- "Saved" tab: any post or profile a person saves lands here.
create table if not exists public.saved_posts (
  user_id uuid not null references public.accounts (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.saved_profiles (
  user_id uuid not null references public.accounts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, profile_id)
);

create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.accounts (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,
  blocked_user_id uuid references public.accounts (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint blocks_has_target check (profile_id is not null or blocked_user_id is not null)
);
create unique index if not exists blocks_owner_profile_uq
  on public.blocks (owner_id, profile_id) where profile_id is not null;
create unique index if not exists blocks_owner_user_uq
  on public.blocks (owner_id, blocked_user_id) where blocked_user_id is not null;

-- "Order now": replaces chat. A user places an order with a hook.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  note text not null default '' check (char_length(note) <= 500),
  status public.order_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
create index if not exists orders_profile_idx on public.orders (profile_id, created_at desc);
-- One live order per user and hook at a time.
create unique index if not exists orders_one_open_uq
  on public.orders (user_id, profile_id) where status in ('pending', 'accepted');

-- Ratings: only allowed after an accepted or completed order (enforced by RLS).
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  author_id uuid not null references public.accounts (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 20 and 500),
  status public.review_status not null default 'published',
  created_at timestamptz not null default now(),
  unique (profile_id, author_id)
);
create index if not exists reviews_profile_idx on public.reviews (profile_id, status);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.accounts (id) on delete set null,
  target_type text not null check (target_type in ('profile', 'post', 'comment', 'review')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 2 and 120),
  details text not null default '' check (char_length(details) <= 1000),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now()
);
create index if not exists reports_status_idx on public.reports (status, created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  href text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, read, created_at desc);

create table if not exists public.verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists verifications_one_pending_uq
  on public.verifications (profile_id) where status = 'pending';

create table if not exists public.appeals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts (id) on delete cascade,
  message text not null check (char_length(message) between 10 and 1000),
  status text not null default 'open' check (status in ('open', 'approved', 'denied')),
  created_at timestamptz not null default now()
);

-- One row per viewer per day, so view counts cannot be inflated by refreshing.
create table if not exists public.profile_views (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  viewer_key text not null,
  day date not null default current_date,
  primary key (profile_id, viewer_key, day)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  target_type text not null,
  target_id text not null,
  meta text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);

-- -----------------------------------------------------------------------------
-- 3. Helper functions
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.accounts
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

-- True when a profile may be shown to the public.
create or replace function public.is_public_profile(p_profile uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    left join public.accounts a on a.id = p.user_id
    where p.id = p_profile
      and p.discoverable and p.visibility = 'public' and p.age_verified
      and (a.id is null or (a.status = 'active' and not a.deactivated))
  );
$$;

create or replace function public.owns_profile(p_profile uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = p_profile and user_id = auth.uid());
$$;

create or replace function public.is_blocked_by_profile(p_profile uuid, p_user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.blocks b
    join public.profiles p on p.user_id = b.owner_id
    where p.id = p_profile and b.blocked_user_id = p_user
  );
$$;

-- Writes a notification and respects the person's notification preferences.
create or replace function public.notify(p_user uuid, p_type text, p_title text, p_body text, p_href text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare prefs jsonb;
begin
  select notification_prefs into prefs from public.accounts where id = p_user;
  if prefs is null then return; end if;
  if coalesce((prefs ->> p_type)::boolean, true) then
    insert into public.notifications (user_id, type, title, body, href)
    values (p_user, p_type, p_title, p_body, p_href);
  end if;
end;
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Sign-up: Google creates the account automatically
-- -----------------------------------------------------------------------------
-- Everyone starts as a "member" (user). The role can never be chosen from
-- client metadata. Hooks upgrade through complete_hook_profile() below.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.accounts (id, email, full_name, avatar_url, provider)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(meta ->> 'full_name', ''), nullif(meta ->> 'name', ''), split_part(coalesce(new.email, 'guest'), '@', 1)),
    coalesce(nullif(meta ->> 'avatar_url', ''), nullif(meta ->> 'picture', ''), ''),
    coalesce(new.raw_app_meta_data ->> 'provider', 'google')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Called after Google sign-in once the person ticks "I am 18+ and accept the terms".
create or replace function public.accept_terms()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  update public.accounts
  set age_confirmed_at = coalesce(age_confirmed_at, now()),
      terms_accepted_at = coalesce(terms_accepted_at, now()),
      last_active_at = now()
  where id = auth.uid();
end;
$$;

-- Hook onboarding: Google -> photo -> location. Creates a hidden profile and
-- a pending verification. The profile only goes public after admin approval.
create or replace function public.complete_hook_profile(
  p_username text,
  p_display_name text,
  p_avatar_url text,
  p_city text,
  p_region text default '',
  p_country text default '',
  p_bio text default '',
  p_confirm_adult boolean default false
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  acct public.accounts;
  uname text := lower(trim(p_username));
  pid uuid;
begin
  if uid is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  select * into acct from public.accounts where id = uid;
  if acct.id is null or acct.status <> 'active' then raise exception 'This account cannot create a profile.'; end if;
  if not p_confirm_adult then raise exception 'You must confirm that you are 18 or older.'; end if;
  if uname !~ '^[a-z0-9_]{3,20}$' then raise exception 'Username must be 3-20 letters, numbers, or underscores.'; end if;
  if coalesce(trim(p_avatar_url), '') = '' then raise exception 'Upload a profile photo.'; end if;
  if coalesce(trim(p_city), '') = '' then raise exception 'Add your location.'; end if;
  if exists (select 1 from public.profiles where username = uname and user_id is distinct from uid) then
    raise exception 'That username is taken.' using errcode = '23505';
  end if;

  -- Trusted section: this function is the only way a user becomes a hook.
  perform set_config('daylight.trusted', 'on', true);
  update public.accounts
  set role = case when role = 'admin' then role else 'creator' end,
      age_confirmed_at = coalesce(age_confirmed_at, now()),
      terms_accepted_at = coalesce(terms_accepted_at, now()),
      avatar_url = p_avatar_url
  where id = uid;
  perform set_config('daylight.trusted', 'off', true);

  insert into public.profiles (user_id, username, display_name, bio, avatar_url, city, region, country)
  values (uid, uname, trim(p_display_name), coalesce(p_bio, ''), p_avatar_url, trim(p_city), coalesce(p_region, ''), coalesce(p_country, ''))
  on conflict (user_id) do update
    set username = excluded.username,
        display_name = excluded.display_name,
        bio = excluded.bio,
        avatar_url = excluded.avatar_url,
        city = excluded.city,
        region = excluded.region,
        country = excluded.country
  returning id into pid;

  insert into public.verifications (user_id, profile_id)
  values (uid, pid)
  on conflict do nothing;

  perform public.notify(uid, 'verification', 'Profile submitted', 'We are reviewing your profile. You will be notified when it is live.', '/dashboard');
  return pid;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Guard triggers (stop people editing fields they must not control)
-- -----------------------------------------------------------------------------
create or replace function public.guard_account_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- auth.uid() is null for the dashboard / service role, which is trusted.
  -- 'daylight.trusted' is only ever switched on inside our own RPCs.
  if auth.uid() is null or public.is_admin()
     or coalesce(current_setting('daylight.trusted', true), 'off') = 'on' then
    return new;
  end if;
  if new.id <> old.id
     or new.role <> old.role
     or new.status <> old.status
     or new.email <> old.email
     or new.provider <> old.provider
     or new.created_at <> old.created_at then
    raise exception 'You cannot change these account fields.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists accounts_guard on public.accounts;
create trigger accounts_guard before update on public.accounts
  for each row execute function public.guard_account_update();

create or replace function public.guard_profile_write()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;

  if tg_op = 'INSERT' then
    new.age_verified := false;
    new.identity_verified := false;
    new.discoverable := false;
    new.featured := false;
    new.is_sample := false;
    new.visibility := 'hidden';
    new.user_id := auth.uid();
    return new;
  end if;

  -- UPDATE: moderation flags are admin-only.
  new.age_verified := old.age_verified;
  new.identity_verified := old.identity_verified;
  new.featured := old.featured;
  new.is_sample := old.is_sample;
  new.user_id := old.user_id;
  -- Hooks can hide themselves, but can only go public once approved.
  if not old.age_verified then
    new.discoverable := false;
    new.visibility := 'hidden';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before insert or update on public.profiles
  for each row execute function public.guard_profile_write();

create or replace function public.guard_post_write()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  new.is_sample := false;
  return new;
end;
$$;

drop trigger if exists posts_guard on public.posts;
create trigger posts_guard before insert or update on public.posts
  for each row execute function public.guard_post_write();

drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
  for each row execute function public.set_updated_at();

drop trigger if exists verifications_touch on public.verifications;
create trigger verifications_touch before update on public.verifications
  for each row execute function public.set_updated_at();

-- Every admin change is written to the audit log.
create or replace function public.log_admin_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and public.is_admin() then
    insert into public.audit_logs (actor_id, action, target_type, target_id, meta)
    values (auth.uid(), lower(tg_op) || '_' || tg_table_name, tg_table_name, new.id::text, '');
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'reviews', 'reports', 'verifications', 'appeals', 'posts', 'comments']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after update on public.%I for each row execute function public.log_admin_change()', t || '_audit', t);
  end loop;
end $$;

-- Accounts: only log the fields that matter (not last_active_at heartbeats).
drop trigger if exists accounts_audit on public.accounts;
create trigger accounts_audit after update of role, status, deactivated on public.accounts
  for each row execute function public.log_admin_change();

-- -----------------------------------------------------------------------------
-- 6. Activity notifications (follows, likes, comments)
-- -----------------------------------------------------------------------------
create or replace function public.on_follow_created()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare owner uuid; who text;
begin
  select user_id into owner from public.profiles where id = new.profile_id;
  select split_part(full_name, ' ', 1) into who from public.accounts where id = new.follower_id;
  if owner is not null and owner <> new.follower_id then
    perform public.notify(owner, 'followers', 'New follower', coalesce(nullif(who, ''), 'Someone') || ' started following you.', null);
  end if;
  return new;
end;
$$;

create or replace function public.on_like_created()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare owner uuid; uname text;
begin
  select p.user_id, p.username into owner, uname
  from public.posts po join public.profiles p on p.id = po.profile_id
  where po.id = new.post_id;
  if owner is not null and owner <> new.user_id then
    perform public.notify(owner, 'likes', 'New like', 'Someone liked your post.', '/profile/' || uname);
  end if;
  return new;
end;
$$;

create or replace function public.on_comment_created()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare owner uuid; uname text; who text;
begin
  select p.user_id, p.username into owner, uname
  from public.posts po join public.profiles p on p.id = po.profile_id
  where po.id = new.post_id;
  select split_part(full_name, ' ', 1) into who from public.accounts where id = new.author_id;
  if owner is not null and owner <> new.author_id then
    perform public.notify(owner, 'comments', 'New comment', coalesce(nullif(who, ''), 'Someone') || ' commented on your post.', '/profile/' || uname);
  end if;
  return new;
end;
$$;

drop trigger if exists follows_notify on public.follows;
create trigger follows_notify after insert on public.follows
  for each row execute function public.on_follow_created();
drop trigger if exists likes_notify on public.likes;
create trigger likes_notify after insert on public.likes
  for each row execute function public.on_like_created();
drop trigger if exists comments_notify on public.comments;
create trigger comments_notify after insert on public.comments
  for each row execute function public.on_comment_created();

-- -----------------------------------------------------------------------------
-- 7. Order workflow (RPCs)
-- -----------------------------------------------------------------------------
create or replace function public.place_order(p_profile_id uuid, p_note text default '')
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  acct public.accounts;
  prof public.profiles;
  oid uuid;
begin
  if uid is null then raise exception 'Sign in to place an order.' using errcode = '28000'; end if;
  select * into acct from public.accounts where id = uid;
  if acct.status <> 'active' or acct.deactivated then raise exception 'This account cannot place orders.'; end if;
  if acct.role <> 'member' then raise exception 'Only user accounts can place orders.'; end if;
  if acct.age_confirmed_at is null then raise exception 'Confirm that you are 18 or older first.'; end if;

  select * into prof from public.profiles where id = p_profile_id;
  if prof.id is null or not public.is_public_profile(prof.id) or prof.user_id is null or prof.is_sample then
    raise exception 'This profile is not taking orders.';
  end if;
  if public.is_blocked_by_profile(prof.id, uid) then raise exception 'This profile is not taking orders.'; end if;
  if char_length(coalesce(p_note, '')) > 500 then raise exception 'Keep the note under 500 characters.'; end if;

  begin
    insert into public.orders (user_id, profile_id, note)
    values (uid, prof.id, coalesce(trim(p_note), ''))
    returning id into oid;
  exception when unique_violation then
    raise exception 'You already have an open order with this hook.';
  end;

  perform public.notify(prof.user_id, 'orders', 'New order', coalesce(nullif(split_part(acct.full_name, ' ', 1), ''), 'Someone') || ' placed an order.', '/dashboard/orders');
  return oid;
end;
$$;

-- p_action: accept | decline | complete (hook)  /  cancel (user)
create or replace function public.respond_order(p_order_id uuid, p_action text)
returns public.order_status
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ord public.orders;
  prof public.profiles;
  is_hook boolean;
  is_buyer boolean;
begin
  if uid is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  select * into ord from public.orders where id = p_order_id for update;
  if ord.id is null then raise exception 'Order not found.'; end if;
  select * into prof from public.profiles where id = ord.profile_id;
  is_hook := prof.user_id = uid;
  is_buyer := ord.user_id = uid;
  if not (is_hook or is_buyer) then raise exception 'Not allowed.' using errcode = '42501'; end if;

  if is_hook and ord.status = 'pending' and p_action in ('accept', 'decline') then
    ord.status := case when p_action = 'accept' then 'accepted' else 'declined' end;
    perform public.notify(ord.user_id, 'orders',
      case when p_action = 'accept' then 'Order accepted' else 'Order declined' end,
      prof.display_name || case when p_action = 'accept' then ' accepted your order.' else ' declined your order.' end,
      '/orders');
  elsif is_hook and ord.status = 'accepted' and p_action = 'complete' then
    ord.status := 'completed';
    perform public.notify(ord.user_id, 'orders', 'Order completed', 'Rate ' || prof.display_name || ' from your orders.', '/orders');
  elsif is_buyer and ord.status in ('pending', 'accepted') and p_action = 'cancel' then
    ord.status := 'cancelled';
    perform public.notify(prof.user_id, 'orders', 'Order cancelled', 'An order was cancelled.', '/dashboard/orders');
  else
    raise exception 'That action is not available for this order.';
  end if;

  update public.orders set status = ord.status where id = ord.id;
  return ord.status;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Other RPCs
-- -----------------------------------------------------------------------------
create or replace function public.record_profile_view(p_profile_id uuid, p_viewer_key text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_profile_id is null or coalesce(p_viewer_key, '') = '' or char_length(p_viewer_key) > 100 then return; end if;
  if not public.is_public_profile(p_profile_id) then return; end if;
  insert into public.profile_views (profile_id, viewer_key)
  values (p_profile_id, p_viewer_key)
  on conflict do nothing;
end;
$$;

create or replace function public.touch_activity()
returns void
language sql security definer set search_path = public
as $$
  update public.accounts set last_active_at = now() where id = auth.uid();
$$;

-- Deactivates the account and hides the hook profile. Content is kept for audit.
create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  perform set_config('daylight.trusted', 'on', true);
  update public.accounts set status = 'deleted', deactivated = true where id = auth.uid() and role <> 'admin';
  perform set_config('daylight.trusted', 'off', true);
  update public.profiles set discoverable = false, visibility = 'hidden' where user_id = auth.uid();
end;
$$;

create or replace function public.admin_review_verification(p_id uuid, p_approve boolean, p_note text default '')
returns void
language plpgsql security definer set search_path = public
as $$
declare v public.verifications;
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  select * into v from public.verifications where id = p_id and status = 'pending' for update;
  if v.id is null then raise exception 'Nothing to review.'; end if;

  update public.verifications
  set status = case when p_approve then 'approved' else 'rejected' end, note = coalesce(p_note, '')
  where id = v.id;

  if p_approve then
    update public.profiles
    set age_verified = true, identity_verified = true, discoverable = true, visibility = 'public'
    where id = v.profile_id;
  else
    update public.profiles
    set discoverable = false, visibility = 'hidden'
    where id = v.profile_id;
  end if;

  perform public.notify(v.user_id, 'verification',
    case when p_approve then 'You are live' else 'Profile needs changes' end,
    case when p_approve then 'Your profile is approved and visible to everyone.'
         else coalesce(nullif(p_note, ''), 'Update your photo or location and try again.') end,
    '/dashboard');

  insert into public.audit_logs (actor_id, action, target_type, target_id, meta)
  values (auth.uid(), case when p_approve then 'approve_verification' else 'reject_verification' end, 'verification', v.id::text, coalesce(p_note, ''));
end;
$$;

create or replace function public.admin_resolve_appeal(p_id uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare a public.appeals;
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  select * into a from public.appeals where id = p_id and status = 'open' for update;
  if a.id is null then raise exception 'Nothing to review.'; end if;
  update public.appeals set status = case when p_approve then 'approved' else 'denied' end where id = a.id;
  if p_approve then
    update public.accounts set status = 'active', deactivated = false where id = a.user_id;
  end if;
  insert into public.audit_logs (actor_id, action, target_type, target_id)
  values (auth.uid(), case when p_approve then 'approve_appeal' else 'deny_appeal' end, 'appeal', a.id::text);
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Public read-only views (what guests and the feed see)
-- -----------------------------------------------------------------------------
-- Views run with the owner's rights on purpose: they expose only safe columns
-- (no email, phone, or date of birth) for profiles that are approved + public.
create or replace view public.public_profiles as
select
  p.id,
  p.username,
  p.display_name,
  p.bio,
  p.interests,
  p.avatar_url,
  p.cover_url,
  case p.location_privacy
    when 'hidden' then ''
    when 'region' then concat_ws(', ', nullif(p.region, ''), nullif(p.country, ''))
    else concat_ws(', ', nullif(p.city, ''), nullif(p.country, ''))
  end as location_label,
  p.country,
  case when p.date_of_birth is null then null else date_part('year', age(p.date_of_birth))::int end as age,
  p.identity_verified as verified,
  p.featured,
  p.is_sample,
  (p.user_id is not null and not p.is_sample) as orderable,
  p.created_at as joined_at,
  (p.created_at > now() - interval '14 days') as is_new,
  case
    when a.last_active_at > now() - interval '5 minutes' then 'online'
    when a.last_active_at > now() - interval '1 day' then 'recent'
    else 'offline'
  end as presence,
  (select count(*) from public.follows f where f.profile_id = p.id)::int as followers,
  (select count(*) from public.posts po where po.profile_id = p.id and po.visibility = 'public')::int as post_count,
  (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.profile_id = p.id and r.status = 'published') as rating,
  (select count(*) from public.reviews r where r.profile_id = p.id and r.status = 'published')::int as review_count
from public.profiles p
left join public.accounts a on a.id = p.user_id
where p.discoverable and p.visibility = 'public' and p.age_verified
  and (a.id is null or (a.status = 'active' and not a.deactivated));

create or replace view public.public_posts as
select
  po.id,
  po.profile_id,
  pp.username,
  pp.display_name,
  pp.avatar_url,
  po.caption,
  po.frame,
  po.is_sample,
  po.created_at,
  coalesce((select array_agg(i.url order by i.position) from public.post_images i where i.post_id = po.id), '{}') as images,
  (select count(*) from public.likes l where l.post_id = po.id)::int as like_count,
  (select count(*) from public.comments c where c.post_id = po.id and not c.hidden)::int as comment_count
from public.posts po
join public.public_profiles pp on pp.id = po.profile_id
where po.visibility = 'public';

create or replace view public.public_comments as
select
  c.id,
  c.post_id,
  coalesce(nullif(split_part(a.full_name, ' ', 1), ''), 'Member') as author_name,
  c.body,
  c.created_at
from public.comments c
join public.accounts a on a.id = c.author_id
join public.public_posts pp on pp.id = c.post_id
where not c.hidden and a.status = 'active';

create or replace view public.public_reviews as
select
  r.id,
  r.profile_id,
  coalesce(nullif(split_part(a.full_name, ' ', 1), ''), 'Member') as author_name,
  r.rating,
  r.body,
  r.created_at
from public.reviews r
join public.accounts a on a.id = r.author_id
join public.public_profiles pp on pp.id = r.profile_id
where r.status = 'published';

-- Stats for a hook's own dashboard (posts, views, followers, rating, orders).
create or replace view public.my_hook_stats as
select
  p.id as profile_id,
  p.user_id,
  (select count(*) from public.posts po where po.profile_id = p.id)::int as posts,
  (select count(*) from public.follows f where f.profile_id = p.id)::int as followers,
  (select count(*) from public.likes l join public.posts po on po.id = l.post_id where po.profile_id = p.id)::int as likes,
  (select count(*) from public.profile_views v where v.profile_id = p.id)::int as views,
  (select count(*) from public.orders o where o.profile_id = p.id)::int as orders,
  (select count(*) from public.orders o where o.profile_id = p.id and o.status = 'pending')::int as pending_orders,
  (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.profile_id = p.id and r.status = 'published') as rating,
  (select count(*) from public.reviews r where r.profile_id = p.id and r.status = 'published')::int as ratings
from public.profiles p
where p.user_id = auth.uid();

-- -----------------------------------------------------------------------------
-- 10. Row level security
-- -----------------------------------------------------------------------------
alter table public.accounts enable row level security;
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_images enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.likes enable row level security;
alter table public.saved_posts enable row level security;
alter table public.saved_profiles enable row level security;
alter table public.blocks enable row level security;
alter table public.orders enable row level security;
alter table public.reviews enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;
alter table public.verifications enable row level security;
alter table public.appeals enable row level security;
alter table public.profile_views enable row level security;
alter table public.audit_logs enable row level security;

-- Remove old policies so this file can be re-run cleanly.
do $$
declare pol record;
begin
  for pol in select schemaname, tablename, policyname from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

-- accounts: private. Public names come from the views above.
create policy accounts_select on public.accounts for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy accounts_update on public.accounts for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- profiles: owners and admins read the raw table (it holds date of birth).
-- Everyone else uses public_profiles.
create policy profiles_select on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy profiles_insert on public.profiles for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.accounts a where a.id = auth.uid() and a.role in ('creator', 'admin') and a.status = 'active')
  );
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- posts: public when the profile is public. Only the hook (or admin) writes.
create policy posts_select on public.posts for select to anon, authenticated
  using (
    (visibility = 'public' and public.is_public_profile(profile_id))
    or public.owns_profile(profile_id)
    or public.is_admin()
  );
create policy posts_insert on public.posts for insert to authenticated
  with check (public.owns_profile(profile_id));
create policy posts_update on public.posts for update to authenticated
  using (public.owns_profile(profile_id) or public.is_admin())
  with check (public.owns_profile(profile_id) or public.is_admin());
create policy posts_delete on public.posts for delete to authenticated
  using (public.owns_profile(profile_id) or public.is_admin());

create policy post_images_select on public.post_images for select to anon, authenticated
  using (exists (select 1 from public.posts po where po.id = post_id));
create policy post_images_write on public.post_images for all to authenticated
  using (exists (select 1 from public.posts po where po.id = post_id and (public.owns_profile(po.profile_id) or public.is_admin())))
  with check (exists (select 1 from public.posts po where po.id = post_id and (public.owns_profile(po.profile_id) or public.is_admin())));

-- comments
create policy comments_select on public.comments for select to authenticated
  using (
    author_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.posts po where po.id = post_id and public.owns_profile(po.profile_id))
  );
create policy comments_insert on public.comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.posts po
      where po.id = post_id
        and po.visibility = 'public'
        and public.is_public_profile(po.profile_id)
        and not public.is_blocked_by_profile(po.profile_id, auth.uid())
    )
    and exists (select 1 from public.accounts a where a.id = auth.uid() and a.status = 'active' and a.age_confirmed_at is not null)
  );
create policy comments_update on public.comments for update to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.posts po where po.id = post_id and public.owns_profile(po.profile_id))
  );
create policy comments_delete on public.comments for delete to authenticated
  using (
    author_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.posts po where po.id = post_id and public.owns_profile(po.profile_id))
  );

-- follows / likes / saves: each person manages their own rows.
create policy follows_select on public.follows for select to authenticated
  using (follower_id = auth.uid() or public.owns_profile(profile_id) or public.is_admin());
create policy follows_insert on public.follows for insert to authenticated
  with check (follower_id = auth.uid() and public.is_public_profile(profile_id) and not public.owns_profile(profile_id));
create policy follows_delete on public.follows for delete to authenticated
  using (follower_id = auth.uid());

create policy likes_select on public.likes for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy likes_insert on public.likes for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.posts po where po.id = post_id and po.visibility = 'public' and public.is_public_profile(po.profile_id))
  );
create policy likes_delete on public.likes for delete to authenticated
  using (user_id = auth.uid());

create policy saved_posts_all on public.saved_posts for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.posts po where po.id = post_id and po.visibility = 'public' and public.is_public_profile(po.profile_id))
  );

create policy saved_profiles_all on public.saved_profiles for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_public_profile(profile_id));

-- blocks
create policy blocks_all on public.blocks for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- orders: reads only. Writes go through place_order() / respond_order().
create policy orders_select on public.orders for select to authenticated
  using (user_id = auth.uid() or public.owns_profile(profile_id) or public.is_admin());

-- reviews: a published rating needs an accepted or completed order.
create policy reviews_select on public.reviews for select to authenticated
  using (status = 'published' or author_id = auth.uid() or public.is_admin());
create policy reviews_insert on public.reviews for insert to authenticated
  with check (
    author_id = auth.uid()
    and status = 'published'
    and exists (
      select 1 from public.orders o
      where o.user_id = auth.uid()
        and o.profile_id = reviews.profile_id
        and o.status in ('accepted', 'completed')
    )
  );
create policy reviews_update on public.reviews for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
create policy reviews_delete on public.reviews for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- reports: anyone signed in can file; only admins read and resolve.
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());
create policy reports_select on public.reports for select to authenticated
  using (public.is_admin());
create policy reports_update on public.reports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- notifications: written by triggers/RPCs; people read and mark their own.
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- verifications: created by complete_hook_profile(); reviewed by admin RPC.
create policy verifications_select on public.verifications for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- appeals
create policy appeals_insert on public.appeals for insert to authenticated
  with check (user_id = auth.uid());
create policy appeals_select on public.appeals for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy appeals_update on public.appeals for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- profile views: hooks read their own, writes via record_profile_view().
create policy profile_views_select on public.profile_views for select to authenticated
  using (public.owns_profile(profile_id) or public.is_admin());

-- audit log: admins only.
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- 11. Grants
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- Signed-in clients: RLS above decides which rows are reachable.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Guests can browse public content only.
grant select on public.posts, public.post_images to anon;
grant select on public.public_profiles, public.public_posts, public.public_comments, public.public_reviews to anon, authenticated;
grant select on public.my_hook_stats to authenticated;
revoke all on public.my_hook_stats from anon;

-- Views are read-only.
revoke insert, update, delete on public.public_profiles, public.public_posts, public.public_comments, public.public_reviews, public.my_hook_stats from authenticated;

-- Functions callable from the app.
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_public_profile(uuid) to anon, authenticated;
grant execute on function public.owns_profile(uuid) to anon, authenticated;
grant execute on function public.is_blocked_by_profile(uuid, uuid) to authenticated;
grant execute on function public.accept_terms() to authenticated;
grant execute on function public.complete_hook_profile(text, text, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.place_order(uuid, text) to authenticated;
grant execute on function public.respond_order(uuid, text) to authenticated;
grant execute on function public.record_profile_view(uuid, text) to anon, authenticated;
grant execute on function public.touch_activity() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.admin_review_verification(uuid, boolean, text) to authenticated;
grant execute on function public.admin_resolve_appeal(uuid, boolean) to authenticated;
-- notify(), handle_new_user(), guards and notification triggers stay internal.

-- -----------------------------------------------------------------------------
-- 12. Storage buckets + policies
-- -----------------------------------------------------------------------------
-- avatars: profile photos. posts: hook post images. Public read, owner write.
-- Files must live in a folder named after the uploader: {user_id}/file.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 3145728, array['image/jpeg', 'image/png', 'image/webp']),
  ('posts', 'posts', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "daylight avatars read" on storage.objects;
drop policy if exists "daylight avatars insert" on storage.objects;
drop policy if exists "daylight avatars update" on storage.objects;
drop policy if exists "daylight avatars delete" on storage.objects;
drop policy if exists "daylight posts read" on storage.objects;
drop policy if exists "daylight posts insert" on storage.objects;
drop policy if exists "daylight posts update" on storage.objects;
drop policy if exists "daylight posts delete" on storage.objects;

create policy "daylight avatars read" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "daylight avatars insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "daylight avatars update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "daylight avatars delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "daylight posts read" on storage.objects for select
  using (bucket_id = 'posts');
create policy "daylight posts insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'posts'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.accounts a where a.id = auth.uid() and a.role in ('creator', 'admin') and a.status = 'active')
  );
create policy "daylight posts update" on storage.objects for update to authenticated
  using (bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "daylight posts delete" on storage.objects for delete to authenticated
  using (bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text);

-- -----------------------------------------------------------------------------
-- 13. Realtime (optional): live notification badge
-- -----------------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- =============================================================================
-- Checklist
--   [ ] Google provider enabled, redirect URLs added (see top of file)
--   [ ] Promote your admin:
--         update public.accounts set role = 'admin' where email = 'you@example.com';
--   [ ] Env vars in the app: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
--       (server-only: SUPABASE_SERVICE_ROLE_KEY, never in client code)
--   [ ] Client calls
--         user  : signInWithOAuth({provider:'google'}) -> rpc('accept_terms')
--         hook  : signInWithOAuth -> upload to avatars/{uid}/photo.jpg
--                 -> rpc('complete_hook_profile', {...})
--         order : rpc('place_order', {p_profile_id, p_note})
--         hook  : rpc('respond_order', {p_order_id, p_action:'accept'|'decline'|'complete'})
--         rate  : insert into reviews (profile_id, author_id, rating, body)
--         admin : rpc('admin_review_verification', {p_id, p_approve, p_note})
-- =============================================================================
