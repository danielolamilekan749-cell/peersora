# Daylight

Adults-only (18+) discovery platform built with Next.js. Sign-in is Google only, images are stored on Cloudinary and all data lives in Supabase.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill the values in
npm run dev
```

Without `SUPABASE_SERVICE_ROLE_KEY`, local development stores data in `data/local-db.json` instead of Supabase.

## Set up Supabase (once)

Run these files in order in Supabase -> SQL Editor:

1. `supabase/migrations/0001_daylight.sql`
2. `supabase/migrations/0002_real_data_only.sql`
3. `supabase/migrations/0003_server_storage.sql`
4. `supabase/migrations/0004_lock_down.sql`
5. `supabase/migrations/0005_hooks_live.sql`

Then run `supabase/health_check.sql`; every line should say `true`.

Then:

- Authentication -> Providers -> Google: enable it with your Google client ID and secret.
- Authentication -> URL Configuration: set the Site URL to your live address and add `https://YOUR-DOMAIN/auth/callback` and `http://localhost:3000/auth/callback` to the redirect URLs.
- In Google Cloud Console, add your live domain to the authorized JavaScript origins.

## Deploy on Vercel

Add these environment variables, then redeploy (clear the build cache, `NEXT_PUBLIC_*` values are baked in at build time):

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key. Server only, never expose it. |
| `AUTH_SECRET` | Long random string used to sign login cookies |
| `CLOUDINARY_URL` | `cloudinary://API_KEY:API_SECRET@CLOUD_NAME` |
| `ADMIN_EMAILS` | Comma separated Google emails that become admins |
