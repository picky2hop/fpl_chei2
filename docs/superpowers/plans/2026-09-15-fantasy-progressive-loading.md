# Fantasy progressive loading implementation plan

**Goal:** Show the selected Fantasy table first, then prefetch history and other active leagues without blocking navigation.

**Architecture:** Add an authenticated browse endpoint for batches of up to ten gameweeks. Keep existing bot/API consumers intact. Share player statistics within a browser session and fetch Player of the Week independently. Store league/gameweek views in a per-mounted-page cache, with bounded background requests and stale-data revalidation.

**Tech Stack:** Next.js 16.2.12, React 19, Supabase, node:test.

**Spec:** Approved design in this conversation: current table first; background history and other leagues; session memory; 38-GW verification; no score-rule changes.

## Constraints

- Preserve historical membership names and cumulative season totals through the selected GW.
- Keep auth guards, server-only database access, original visual language and prediction behavior.
- Use npm.cmd. No production writes or publication are needed for this implementation.

## Tasks

- [x] Add behavioral tests for batch views: cumulative totals, historical names, awards isolated by GW, compact shared statistics, invalid/unauthorized requests and full-season data.
- [x] Add browse response builder and authenticated endpoint; paginate score/member queries and optionally omit player statistics.
- [x] Test and implement a browser cache/controller: selected data first, batches of ten, one background request, foreground priority, deduplication, league isolation, errors, disposal and refresh.
- [x] Connect the controller through a React hook; fetch Player of the Week separately; keep selectors visible when a table is missing; add retry and sync timestamp.
- [x] Verify focused tests, all tests, lint, build, git diff --check. Measure serialized 38-GW fixtures; report browser/network measurement limitations honestly.

## Verification commands

```powershell
node --experimental-strip-types --test tests/fantasy/browse*.test.mts
npm.cmd test
npm.cmd run lint
npm.cmd run build
git diff --check
```

No additional execution-mode approval is needed: implementation in this session is already authorized.

## Measurements and limits

- Final verification: 388 tests passed; lint and production build passed. No deployment or production mutation was performed.

- Synthetic fixture: 30 members, 38 GW, 1,140 score rows and membership rows per league.
- Serialized table/award batches: 368,752 bytes per league, excluding image downloads and the single shared player-statistics response. This measures JSON transfer size, not JavaScript heap consumption.
- Cached navigation makes no new request while fresh. Background batches contain at most ten GW. A foreground request can complete independently of the background batch; superseded foreground requests are aborted.
- Revalidation reads stored scores; it does not sync or recalculate production scores.
- No real-device LIFF timing or throttled mobile-network measurements were made in this session. First-table latency and image-memory usage need checking after deployment on a signed-in device.
