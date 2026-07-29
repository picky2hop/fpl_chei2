# Google Apps Script scheduler

1. Create an Apps Script project and paste `Code.gs`.
2. Add Script Properties:
   - `VERCEL_SYNC_URL`: the deployed `https://.../api/sync` URL
   - `FPL_SYNC_TOKEN`: the same random token as Vercel `FPL_SYNC_TOKEN`
3. Run `installTenMinuteTrigger` once and approve the Apps Script permissions.

The trigger runs every 10 minutes in `Asia/Bangkok`. It calls the Vercel endpoint during the approved live windows, once after 06:00 on weekdays, and once after 18:00 on Tuesday/Friday for schedule refreshes. The token is kept in Apps Script properties and is never committed to Git.
