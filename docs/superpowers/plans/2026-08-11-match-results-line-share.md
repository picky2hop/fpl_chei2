# Match Results LINE Share Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** เพิ่มปุ่มแชร์ใน match-detail modal และสร้าง LINE Flex bubble ที่แสดงคำทายของผู้เล่นทุกคนสำหรับแมตช์เดียว โดยใช้ข้อมูล dashboard เดิม

**Architecture:** สร้าง presentation builder ใหม่ใน lib/line/flex.ts สำหรับ match prediction detail และเพิ่ม wrapper ใน lib/line/share-payload.ts เพื่อแปลง Fixture กับ predictor list เป็น Flex input จากนั้นเชื่อมกับ FixtureDetail ผ่าน state ใน PredictionApp และใช้ shareFlexMessage/LIFF target picker เดิม

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, LINE LIFF shareTargetPicker, Node test runner

## Global Constraints

- ไม่เปลี่ยน scoring, prediction flow, API contract, Supabase schema/data, LIFF configuration หรือ environment variables
- ห้ามอ่าน ใช้ หรือเพิ่ม secret/token และห้ามแก้ Production data
- รักษา unrelated changes ใน working tree
- ใช้ npm.cmd สำหรับคำสั่ง npm
- อ่านเอกสารใน node_modules/next/dist/docs/ ก่อนแก้ Next.js code; เอกสารที่เกี่ยวข้องถูกอ่านแล้ว
- ไม่ commit หรือ push จนกว่าผู้ใช้จะอนุมัติอย่างชัดเจน
- ใช้ Flex bubble เดียว, Bangkok timezone, existing app colors และ existing footer LIFF action
- ห้ามส่ง SVG เข้า LINE และต้องคง validation ของ Flex ที่มีอยู่

---

### Task 1: Add failing tests for the match-detail Flex builder

**Files:**
- Modify: tests/line/flex.test.mts
- Reference: lib/line/flex.ts existing FlexTeam, FlexMessage, PredictionChoice, validateFlexMessage

**Interfaces:**
- Produces an exported FixturePredictionFlexInput type and buildFixturePredictionFlex(input): FlexMessage contract:

~~~ts
type FixturePredictionFlexInput = {
  gameweek: number;
  dateLabel: string;
  kickoffAt?: string;
  status: "upcoming" | "live" | "finished" | "postponed";
  homeScore?: number;
  awayScore?: number;
  homeTeam: FlexTeam;
  awayTeam: FlexTeam;
  predictionPercentages: Record<PredictionChoice, number>;
  predictors: Array<{ name: string; avatarUrl?: string; choice: PredictionChoice }>;
};
~~~

- [ ] Step 1: Add a failing test for one finished match.

Import buildFixturePredictionFlex. Pass Arsenal/Coventry, a finished score, 100/0/0 percentages, two home predictors, Premier League SVG badge URLs, and an HTTPS avatar. Assert the result is a single bubble containing both teams, score, percentage, predictor names, avatar URL, all three choice colors, and the existing LIFF footer URI. Assert the serialized payload does not contain .svg.

- [ ] Step 2: Add failing tests for upcoming and empty states.

Assert that an upcoming match renders VS rather than a score, formats a valid kickoff in Asia/Bangkok, shows 0% for empty draw/away groups, and renders the muted empty-state text.

- [ ] Step 3: Add a failing long-list test.

Pass at least 13 predictors and assert all names remain in the serialized message and validateFlexMessage(message) succeeds. This establishes the requirement that nested boxes, rather than silent truncation, are used for large predictor lists.

- [ ] Step 4: Run the focused tests and confirm the expected failure.

Run:

~~~powershell
npm.cmd run test -- tests/line/flex.test.mts
~~~

Expected: FAIL because buildFixturePredictionFlex is not exported yet.

---

### Task 2: Implement the match-detail Flex builder

**Files:**
- Modify: lib/line/flex.ts
- Test: tests/line/flex.test.mts

**Interfaces:**
- Consumes existing FlexTeam, PredictionChoice, text, bubble, teamLogoOrFallback, imageOrFallback, footerButton, Bangkok date helpers, and validateFlexMessage.
- Produces exported FixturePredictionFlexInput and buildFixturePredictionFlex(input): FlexMessage.

- [ ] Step 1: Add the exported input type and match header helpers.

Define the type exactly as Task 1. Render home team, center VS or finished score, away team, and Bangkok date/time using existing background/text tokens. Use dateLabel as the date fallback and the existing time fallback when kickoffAt is missing or invalid. Render a clear postponed label without creating an invalid Flex component.

- [ ] Step 2: Add predictor group rendering with bounded nested boxes.

Group predictors by home, draw, and away. Each group has its choice pill, percentage, predictor rows with avatar/name/badge, or a muted empty state. Chunk predictor rows into nested vertical boxes so no single box has more than 12 children. Reuse the existing avatar and team-logo URL sanitization helpers.

Keep these exact colors:

~~~ts
home: "#ff647c"
draw: "#47d7a0"
away: "#6da9ff"
~~~

- [ ] Step 3: Assemble one bubble with the existing footer.

Return a FlexMessage with informative altText, contents from bubble([...]), the match header first, then all three choice sections. Reuse footerButton and the existing app URI. Do not add a profile header because this is a match-detail share, not the current-user prediction share.

- [ ] Step 4: Run the focused tests.

Run:

~~~powershell
npm.cmd run test -- tests/line/flex.test.mts
~~~

Expected: PASS for the new builder tests and all existing Flex tests.

---

### Task 3: Add the domain-to-Flex share wrapper

**Files:**
- Modify: tests/line/share-payload.test.mts
- Modify: lib/line/share-payload.ts
- Reference: lib/mock-data.ts Fixture and lib/predictions.ts FixturePredictor

**Interfaces:**
- Produces:

~~~ts
export function buildFixturePredictionShareFlex(input: {
  fixture: Fixture;
  gameweek: number;
  predictors: FixturePredictor[];
}): FlexMessage;
~~~

- [ ] Step 1: Add a failing mapping test.

Create a fixture with kickoff, dateLabel, status, scores, crests, and percentages. Pass home/draw/away predictors and assert the serialized payload contains teams, score/date data, percentages, predictor names, and avatar URLs.

- [ ] Step 2: Run the focused wrapper test and confirm the expected failure.

Run:

~~~powershell
npm.cmd run test -- tests/line/share-payload.test.mts
~~~

Expected: FAIL because buildFixturePredictionShareFlex is not exported yet.

- [ ] Step 3: Implement the wrapper without mutating Fixture.

Import FixturePredictor and buildFixturePredictionFlex. Map fixture.kickoff to kickoffAt, pass dateLabel/status/optional scores, map both team names and crests, pass predictionPercentages, and forward predictors unchanged. Do not write to or normalize the original fixture object.

- [ ] Step 4: Run the wrapper suite.

Run:

~~~powershell
npm.cmd run test -- tests/line/share-payload.test.mts
~~~

Expected: PASS, including existing personal prediction and standings share tests.

---

### Task 4: Wire the share button and state into the results modal

**Files:**
- Modify: app/components/prediction-app-final.tsx
- Reference: lib/line/share.ts, lib/line/share-payload.ts, existing FixtureDetail

**Interfaces:**
- Consumes buildFixturePredictionShareFlex, shareFlexMessage, current entries, predictionBookByGameweek, selected Fixture, and the existing liff import.
- Produces FixtureDetail props for onShare and share status; no public route/API changes.

- [ ] Step 1: Centralize the predictor list used by rendering and sharing.

Keep the current source exactly: iterate current gameweek entries, read predictionBookByGameweek[gameweek]?.[entry.id]?.[fixture.id], and omit entries without a valid choice. Use the same derived list for the modal rows and the Flex wrapper so the two surfaces cannot diverge.

- [ ] Step 2: Add fixture-share state and safe error mapping.

Use a state shape equivalent to:

~~~ts
type FixtureShareState =
  | { fixtureId: string; status: "sharing" }
  | { fixtureId: string; status: "shared"; message: string }
  | { fixtureId: string; status: "error"; message: string }
  | null;
~~~

Implement shareFixturePredictions(fixture): set sharing, build the wrapper payload, call shareFlexMessage with the existing liff.isApiAvailable and liff.shareTargetPicker adapter, then set shared or error. Map cancellation, unavailable picker, oversized payload, invalid payload, and unknown errors to user-safe Thai messages. Reset state when changing gameweek, opening another fixture, or closing the modal.

- [ ] Step 3: Add the accessible button and inline status.

Add a full-width button after the three prediction groups. Use Share2, the existing lime button treatment, disabled during sharing, and aria-busy while sharing. Render success with role=status and errors with role=alert. Keep the modal open for success, cancellation, and errors.

- [ ] Step 4: Run UI checks.

Run:

~~~powershell
npm.cmd run lint
npm.cmd run build
~~~

Expected: PASS with no API, Supabase, environment-variable, or unrelated-file changes.

---

### Task 5: Full verification and handoff

**Files:**
- Inspect only: files changed by Tasks 1–4
- Preserve: all pre-existing modified/untracked files reported by initial git status

- [ ] Step 1: Run the full automated suite.

Run:

~~~powershell
npm.cmd test
~~~

Expected: PASS with no regressions in predictions, LINE, API, auth, sync, or scheduler tests.

- [ ] Step 2: Run final lint and production build.

Run:

~~~powershell
npm.cmd run lint
npm.cmd run build
~~~

Expected: both commands exit successfully.

- [ ] Step 3: Check whitespace and inspect only the scoped diff.

Run:

~~~powershell
git diff --check
git diff -- app/components/prediction-app-final.tsx lib/line/flex.ts lib/line/share-payload.ts tests/line/flex.test.mts tests/line/share-payload.test.mts
git status --short
~~~

Expected: no whitespace errors; scoped diff contains only this feature; unrelated user changes remain untouched.

- [ ] Step 4: Perform manual responsive and LINE-flow checks.

Check mobile, tablet, and desktop. In the results tab, open a fixture, confirm modal rows/percentages, press share once, confirm LINE receives one Flex bubble, and verify success, cancel, unavailable-picker, invalid-payload, and retry states. Confirm saving, selecting, and scoring behavior remains unchanged.

- [ ] Step 5: Stop for explicit user approval before any commit or push.

Report changed files, test/lint/build outputs, manual checks, and any environment-dependent LINE limitation. Do not run git commit or git push.
