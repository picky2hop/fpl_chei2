# Single LIFF authentication design

## Goal

Initialize and authenticate LIFF once for the user-facing app, then reuse the
same authenticated profile while navigating from the landing page to the
dashboard. Preserve the existing server session, Supabase-backed user upsert,
prediction APIs, dashboard data loading, and independent admin authorization.

## Architecture

- Add a client `LiffProvider` under `app/components/` that owns the LIFF
  initialization, ID-token exchange, loading/error UI, and authenticated
  profile context.
- Mount the provider from the server `app/layout.tsx`, wrapping only the
  application children. The provider bypasses `/admin`, which continues to use
  its existing server-side `requireAdmin()` guard.
- Keep `app/page.tsx` and `app/dashboard/page.tsx` as route entry points, but
  consume the shared profile instead of mounting separate `LiffGate`
  instances.
- Deduplicate concurrent initialization with a module-level promise that is
  cleared after a failed attempt, so React development remounts cannot issue a
  second LIFF initialization or auth request.
- Keep `/api/auth/liff` unchanged: it remains the single server boundary that
  verifies the token, upserts `public.app_users`, joins the active season, and
  creates the application session cookie.

## Behavior and failure handling

- Initial app entry shows the existing LINE loading state until the shared
  provider reaches `ready`.
- Authentication errors retain the existing retry UI.
- Dashboard data still loads only after the shared provider is ready and keeps
  using `/api/dashboard` and the existing session guard.
- Direct dashboard loads still perform one LIFF initialization on that browser
  page; client-side navigation from `/` reuses the existing provider state.
- Admin routes do not start LIFF initialization and retain their current
  redirect/authorization behavior.

## Verification

- Source-contract tests prove the provider is mounted once and route pages do
  not mount duplicate gates.
- Unit tests prove concurrent callers share one initialization promise and a
  failed initialization can be retried.
- Run the full test suite, lint, production build, and `git diff --check`.
- No Supabase schema/data changes, environment-variable changes, secret access,
  commit, or push are part of this change.
