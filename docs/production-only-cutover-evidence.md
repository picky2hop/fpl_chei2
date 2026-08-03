# Production-only cutover evidence

Updated: 3 August 2026

## Scope

The preview/test runtime was retired after the application code, CI workflow, and documentation were changed to use the production path only.

- Production Vercel project: `fpl-chei2` (`https://fpl-chei2.vercel.app`)
- Production Supabase project: `fpl_chei` (`bripkfdcfanjyruqcgji`)
- Test Vercel project deleted: `fpl-chei2-test`
- Test Supabase project deleted: `fpl-chei2-test` (`iarcgspwoordcemebdoz`)
- Production Vercel `NEXT_PUBLIC_DEMO_MODE` variable deleted

No production database rows were used as fixtures or left behind by the retired integration-test workflow.

## Repository evidence

- Preview-profile and mock-dashboard fallbacks are removed from the active application path.
- The CI workflow no longer runs the retired Supabase test-project job.
- Test-project credentials are not part of the application configuration.
- Historical Phase 3A state-transition evidence remains archived and is not an instruction to write test data to Production.

## Verification

The cutover branch was verified with:

- `npm.cmd run test`
- `npm.cmd run lint`
- `npm.cmd run build`
- `git diff --check`

The exact command output and deployment SHA must be refreshed after the Production `main` deployment. Secrets and tokens are intentionally omitted.
