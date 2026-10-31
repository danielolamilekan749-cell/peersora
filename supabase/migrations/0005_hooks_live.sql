-- =============================================================================
-- Daylight - 0005: hook profiles go live straight away
-- =============================================================================
-- New hook profiles are now public as soon as the hook finishes onboarding
-- (they confirm they are 18+ when joining). The verified badge is added later
-- by an admin. This makes the profiles that were already created live too,
-- except ones an admin rejected, suspended or the owner deactivated.
--
-- Run once in Supabase -> SQL Editor.
-- =============================================================================

update public.profiles p
set age_verified = true,
    visibility = 'public',
    discoverable = true
from public.accounts a
where a.id = p.user_id
  and a.status = 'active'
  and not a.deactivated
  and not exists (
    select 1 from public.verifications v
    where v.profile_id = p.id and v.status = 'rejected'
  );
