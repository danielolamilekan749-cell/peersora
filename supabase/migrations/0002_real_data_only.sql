-- =============================================================================
-- Daylight - migration 0002
-- Run AFTER 0001_daylight.sql in Supabase > SQL Editor. Safe to run twice.
--
--   * Removes any sample (demo) profiles and posts. Only real data stays.
--   * Switches follows off for now (the table is kept so it can come back).
--   * Hook onboarding now takes ONE free-text location and a private phone number.
--   * Limits a post to 10 photos (people swipe through them).
-- =============================================================================

-- 1. No demo content -----------------------------------------------------------
delete from public.posts where is_sample;
delete from public.profiles where is_sample and user_id is null;

-- 2. Follows are off for now ---------------------------------------------------
drop trigger if exists follows_notify on public.follows;
drop policy if exists follows_insert on public.follows;
revoke insert, update, delete on public.follows from authenticated;
update public.accounts set notification_prefs = notification_prefs - 'followers';
alter table public.accounts
  alter column notification_prefs set default
    '{"likes":true,"comments":true,"orders":true,"announcements":true,"verification":true}'::jsonb;

-- 3. Hook onboarding: one location + phone -------------------------------------
drop function if exists public.complete_hook_profile(text, text, text, text, text, text, text, boolean);

create or replace function public.complete_hook_profile(
  p_display_name text,
  p_avatar_url text,
  p_location text,
  p_phone text,
  p_bio text default '',
  p_confirm_adult boolean default false
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  acct public.accounts;
  base text;
  uname text;
  n int := 0;
  pid uuid;
begin
  if uid is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  select * into acct from public.accounts where id = uid;
  if acct.id is null or acct.status <> 'active' then raise exception 'This account cannot create a profile.'; end if;
  if not p_confirm_adult then raise exception 'You must confirm that you are 18 or older.'; end if;
  if coalesce(trim(p_avatar_url), '') = '' then raise exception 'Upload a profile photo.'; end if;
  if char_length(coalesce(trim(p_location), '')) < 2 then raise exception 'Enter your location.'; end if;
  if p_phone !~ '^\+?[0-9][0-9 ()-]{6,19}$' or char_length(regexp_replace(p_phone, '\D', '', 'g')) < 7 then
    raise exception 'Enter a valid phone number, for example +234 801 234 5678.';
  end if;

  -- Keep the username if the hook already has a profile, otherwise derive one from the name.
  select username into uname from public.profiles where user_id = uid;
  if uname is null then
    base := regexp_replace(lower(split_part(coalesce(nullif(trim(p_display_name), ''), acct.full_name), ' ', 1)), '[^a-z0-9_]', '', 'g');
    if char_length(base) < 3 then base := base || 'hook'; end if;
    base := left(base, 16);
    uname := base;
    while exists (select 1 from public.profiles where username = uname) loop
      n := n + 1;
      uname := base || n::text;
    end loop;
  end if;

  -- Trusted section: this function is the only way a user becomes a hook.
  perform set_config('daylight.trusted', 'on', true);
  update public.accounts
  set role = case when role = 'admin' then role else 'creator' end,
      phone = trim(p_phone),
      age_confirmed_at = coalesce(age_confirmed_at, now()),
      terms_accepted_at = coalesce(terms_accepted_at, now()),
      avatar_url = p_avatar_url
  where id = uid;
  perform set_config('daylight.trusted', 'off', true);

  insert into public.profiles (user_id, username, display_name, bio, avatar_url, city, region, country)
  values (uid, uname, coalesce(nullif(trim(p_display_name), ''), acct.full_name), coalesce(p_bio, ''), p_avatar_url, trim(p_location), trim(p_location), '')
  on conflict (user_id) do update
    set display_name = excluded.display_name,
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

revoke all on function public.complete_hook_profile(text, text, text, text, text, boolean) from public, anon;
grant execute on function public.complete_hook_profile(text, text, text, text, text, boolean) to authenticated;

-- 4. At most 10 photos per post ------------------------------------------------
create or replace function public.limit_post_images()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if (select count(*) from public.post_images where post_id = new.post_id) >= 10 then
    raise exception 'A post can have up to 10 photos.';
  end if;
  return new;
end;
$$;

drop trigger if exists post_images_limit on public.post_images;
create trigger post_images_limit before insert on public.post_images
  for each row execute function public.limit_post_images();

-- 5. Saved items must point at something real (already enforced by foreign keys),
--    and ratings stay tied to accepted/completed orders (policy from 0001).
