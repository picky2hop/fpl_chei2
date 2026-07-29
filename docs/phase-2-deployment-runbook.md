# Phase 2 deployment runbook

This runbook keeps secrets in Vercel and Google Apps Script properties. Do not put them in Git, `.env.example`, `NEXT_PUBLIC_*`, or chat.

## 1. Vercel project

Import the GitHub repository `picky2hop/fpl_chei2` into Vercel with:

- Framework: Next.js
- Build command: `npm run build`
- Install command: `npm install`
- Node.js: 20.x or newer supported by the installed Next.js version

Set these environment variables for Preview and Production:

```text
NEXT_PUBLIC_LIFF_ID
NEXT_PUBLIC_DEMO_MODE=false
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
LINE_CHANNEL_ID
SESSION_SECRET
ADMIN_LINE_USER_ID
FPL_API_BASE_URL=https://fantasy.premierleague.com
FPL_SYNC_TOKEN
```

`SESSION_SECRET` and `FPL_SYNC_TOKEN` should be long random values. Rotate them from the Vercel dashboard if exposed.

## 2. LINE LIFF

In LINE Developers, configure the LIFF endpoint URL to the deployed Vercel URL, for example:

```text
https://<vercel-domain>/
```

The LIFF channel ID must match `NEXT_PUBLIC_LIFF_ID`, while the LINE channel ID used to verify the ID token must match `LINE_CHANNEL_ID` on the server.

## 3. First smoke test

After deployment:

1. Open the LIFF URL in LINE.
2. Confirm `/api/auth/liff` creates one `app_users` row and 38 participant rows for the active season.
3. Confirm `/api/dashboard` returns the active season and FPL fixtures.
4. Submit one prediction before kickoff and confirm one `prediction_events` row.
5. Confirm browser code never calls Supabase directly.
6. Confirm an unauthenticated request to `/admin` is redirected away.

Do not use a real fixture close to kickoff for the first prediction test. Use a future scheduled fixture.

## 4. Google Apps Script

Copy `scheduler/google-apps-script/Code.gs` into Apps Script and set Script Properties:

- `VERCEL_SYNC_URL`: `https://<vercel-domain>/api/sync`
- `FPL_SYNC_TOKEN`: the same value as Vercel

Run `installTenMinuteTrigger` once. Verify one `job_runs` row is created after a permitted sync window. The scheduler must not be configured with a Supabase key.

## 5. Production checks

Run the following from the repository before publishing a reviewed commit:

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run build
git diff --check
```

Then run the read-only checks in `tests/sql/phase-2-schema.sql` against the production Supabase project.
