# Prediction UI and Flex Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the redundant post-share saved toast, align prediction-page team cards, group prediction-result Flex fixtures by Bangkok date and kickoff time, and hide only the white match title in the results detail modal.

**Architecture:** Keep the existing `PredictionApp`, `DetailModal`, and `buildPredictionResultFlex` boundaries. Apply the two visual LIFF changes in the existing client component, add an opt-in title-hiding prop to the shared modal, and refactor only the Flex grouping helper so the existing input and share transport remain unchanged.

**Tech Stack:** Next.js 16.2.12 App Router, React 19.2.4, TypeScript, Tailwind CSS v4 utility classes, Node test runner, ESLint.

## Global Constraints

- Read and follow the checked-in Next.js guides for App Router project structure and Client Components before editing `.tsx` files.
- Preserve the existing `SharePrompt`, prediction write API, LINE share transport, LIFF URL, team assets, Supabase schema/data, and fixture input contract.
- Apply team-name ordering only in `FixturePredictionCard`; do not change `Results`, `PlayerDetail`, or `FixtureDetail` team ordering.
- Use `Asia/Bangkok` for all prediction Flex date/time labels and grouping keys.
- Keep the existing one-bubble prediction Flex, profile card, choice colors, selected-side highlights, and footer/action behavior.
- Do not stage or modify unrelated pre-existing worktree changes.

---

### Task 1: Add a failing regression test for date/time grouping

**Files:**
- Modify: `tests/line/flex.test.mts` near the existing `prediction Flex groups fixtures under Thai weekday/date headings` test
- Test: `tests/line/flex.test.mts`

**Interfaces:**
- Consumes: `buildPredictionResultFlex()` and the existing Flex payload shape.
- Produces: a regression test that requires one date group containing two kickoff-time groups and a second date group containing one kickoff-time group.

- [ ] **Step 1: Write the failing test**

Add a test using four fixtures:

```ts
test("prediction Flex groups fixtures by Bangkok date and kickoff time", () => {
  const fixtures = [
    { homeTeam: { name: "Home 1" }, awayTeam: { name: "Away 1" }, kickoffAt: "2026-08-01T12:00:00.000Z", choice: "home" as const },
    { homeTeam: { name: "Home 2" }, awayTeam: { name: "Away 2" }, kickoffAt: "2026-08-01T12:00:00.000Z", choice: "draw" as const },
    { homeTeam: { name: "Home 3" }, awayTeam: { name: "Away 3" }, kickoffAt: "2026-08-01T13:30:00.000Z", choice: "away" as const },
    { homeTeam: { name: "Home 4" }, awayTeam: { name: "Away 4" }, kickoffAt: "2026-08-02T12:00:00.000Z", choice: "home" as const },
  ];
  const message = buildPredictionResultFlex({ displayName: "Picky", gameweek: 1, fixtures });
  const body = (message.contents as Record<string, unknown>).body as Record<string, unknown>;
  const dateGroups = (body.contents as Array<Record<string, unknown>>).slice(1);
  const firstDateContents = dateGroups[0]?.contents as Array<Record<string, unknown>>;
  const secondDateContents = dateGroups[1]?.contents as Array<Record<string, unknown>>;

  assert.equal(dateGroups.length, 2);
  assert.equal(firstDateContents[1]?.text, "19:00 · 2 คู่");
  assert.equal(firstDateContents[4]?.text, "20:30 · 1 คู่");
  assert.equal(secondDateContents[1]?.text, "19:00 · 1 คู่");
  assert.equal(firstDateContents.filter((item) => item.type === "text").length, 3);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm.cmd test -- tests/line/flex.test.mts`

Expected: FAIL because the current builder places only the date heading above all rows and does not emit kickoff-time headings.

- [ ] **Step 3: Commit the failing test**

```bash
git add tests/line/flex.test.mts
git commit -m "test: require prediction Flex time grouping"
```

---

### Task 2: Implement Bangkok date and kickoff-time grouping in the prediction Flex

**Files:**
- Modify: `lib/line/flex.ts` in `formatPredictionDateLabel()` and `predictionDateGroups()` area
- Test: `tests/line/flex.test.mts`

**Interfaces:**
- Consumes: `PredictionFlexInput["fixtures"]`, each fixture's optional `kickoffAt` and `dateLabel`.
- Produces: the same `buildPredictionResultFlex(input): FlexMessage` contract, with nested date and time groups.

- [ ] **Step 1: Add a Bangkok time formatter**

Add a formatter beside `formatPredictionDateLabel`:

```ts
export function formatPredictionTimeLabel(kickoffAt?: string, fallback = "เวลาไม่ระบุ"): string {
  if (!kickoffAt) return fallback;
  const date = new Date(kickoffAt);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: BANGKOK_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
```

- [ ] **Step 2: Replace the flat date map with stable nested groups**

Refactor `predictionDateGroups()` so it:

1. Builds a date group key from the formatted Bangkok date, preserving `fixture.dateLabel` only as the existing invalid/missing-date fallback.
2. Builds a time group key from `formatPredictionTimeLabel()`.
3. Stores each fixture with its original index and valid kickoff timestamp.
4. Sorts valid date groups and time groups by kickoff timestamp, using original index to keep stable order for fallback/identical timestamps.
5. Renders each date group as `[date heading, time heading, fixture row, ...]`, where each time heading is `text(`${timeLabel} · ${count} คู่`, "xs", "bold", ACCENT)`.

The resulting structure must be equivalent to:

```ts
contents: [
  text(dateLabel, "sm", "bold", ACCENT),
  text("19:00 · 2 คู่", "xs", "bold", ACCENT),
  predictionFixture(firstFixture),
  predictionFixture(secondFixture),
  text("20:30 · 1 คู่", "xs", "bold", ACCENT),
  predictionFixture(thirdFixture),
]
```

Keep `predictionFixture()` unchanged except where the existing group rendering requires no other change.

- [ ] **Step 3: Run focused tests to verify the implementation passes**

Run: `npm.cmd test -- tests/line/flex.test.mts`

Expected: PASS for the new date/time grouping test and all existing Flex tests, including PNG conversion, one-bubble output, team ordering, choice colors, and LIFF action.

- [ ] **Step 4: Commit the Flex change**

```bash
git add lib/line/flex.ts tests/line/flex.test.mts
git commit -m "feat: group prediction Flex fixtures by kickoff time"
```

---

### Task 3: Remove the redundant saved toast and make match-title hiding opt-in

**Files:**
- Modify: `app/components/prediction-app-final.tsx` around `PredictionApp` state, share flow, navigation, and modal render
- Modify: `app/components/detail-modal.tsx` in `DetailModalProps` and dialog heading markup

**Interfaces:**
- Consumes: existing `SharePrompt` callbacks and `DetailModal` props.
- Produces: share completion that closes without a second toast, plus `DetailModal` support for `hideTitle?: boolean` with an accessible label fallback.

- [ ] **Step 1: Remove all saved-toast state and render paths**

In `prediction-app-final.tsx`:

- Remove the `X` icon import; retain `CheckCircle2` because it is still used by the Results tab icon.
- Remove `showSavedToast` state.
- Remove `setShowSavedToast(false)` from `choosePrediction()` and the bottom-navigation click handler.
- Change the save failure catch from `setShowSavedToast(false)` to a no-op catch that still prevents an unhandled promise rejection.
- Change `finishShareFlow()` to only close `isSharePromptOpen` and clear `shareError`.
- Remove the bottom fixed toast JSX containing `บันทึกคำทาย {completionLabel} แล้ว`.

Do not change the save request, `SharePrompt`, share error messages, or `sharePredictionResult()` behavior.

- [ ] **Step 2: Add opt-in title hiding to `DetailModal`**

Use this prop shape:

```ts
type DetailModalProps = {
  eyebrow: string;
  title: string;
  hideTitle?: boolean;
  onClose: () => void;
  children: ReactNode;
};
```

Render the `<h2>` only when `hideTitle` is false. When hidden, keep the title available to assistive technology with `aria-label={title || eyebrow}` and omit `aria-labelledby`; when visible, keep the current `aria-labelledby="detail-modal-title"` behavior.

- [ ] **Step 3: Use title hiding only for the results match modal**

Change the `selectedFixture` render to pass `hideTitle`:

```tsx
{selectedFixture && (
  <DetailModal
    eyebrow="Match details"
    title={`${selectedFixture.homeTeam.name} vs ${selectedFixture.awayTeam.name}`}
    hideTitle
    onClose={() => setSelectedFixture(null)}
  >
    <FixtureDetail fixture={selectedFixture} entries={entries} gameweek={selectedGameweek} />
  </DetailModal>
)}
```

Leave the player-detail modal and `SharePrompt` without `hideTitle`.

- [ ] **Step 4: Run lint and build checks for the client-component changes**

Run: `npm.cmd run lint`

Expected: PASS with no unused `X` import, no unused saved-toast state, and no accessibility/type errors.

Run: `npm.cmd run build`

Expected: PASS with the existing App Router/client boundary intact; no new routes or server/client serialization changes.

- [ ] **Step 5: Commit the UI flow and modal change**

```bash
git add app/components/prediction-app-final.tsx app/components/detail-modal.tsx
git commit -m "feat: remove redundant prediction save toast"
```

---

### Task 4: Align both teams vertically on the prediction page

**Files:**
- Modify: `app/components/prediction-app-final.tsx` in `FixturePredictionCard()` only

**Interfaces:**
- Consumes: existing `FixturePredictionCard` fixture and choice props.
- Produces: home and away team blocks with the same logo-above-name layout; no change to result cards or detail rows.

- [ ] **Step 1: Update only the prediction-card team blocks**

Change the home block from name-then-logo to logo-then-name, matching the existing away block:

```tsx
<div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
  <TeamLogo team={fixture.homeTeam} />
  <p className="truncate text-xs font-extrabold">{fixture.homeTeam.name}</p>
</div>
```

Keep the `VS` element, card spacing, choice buttons, and `Results`/`PlayerDetail`/`FixtureDetail` markup unchanged.

- [ ] **Step 2: Run lint and build checks**

Run: `npm.cmd run lint`

Expected: PASS.

Run: `npm.cmd run build`

Expected: PASS and the prediction page remains a client component with the existing props and event handlers.

- [ ] **Step 3: Commit the prediction-card layout change**

```bash
git add app/components/prediction-app-final.tsx
git commit -m "feat: align prediction team cards"
```

---

### Task 5: Run the complete verification suite and review the diff

**Files:**
- Verify: `app/components/prediction-app-final.tsx`
- Verify: `app/components/detail-modal.tsx`
- Verify: `lib/line/flex.ts`
- Verify: `tests/line/flex.test.mts`

- [ ] **Step 1: Run the complete test suite**

Run: `npm.cmd run test`

Expected: PASS for all repository tests.

- [ ] **Step 2: Run lint and production build**

Run: `npm.cmd run lint`

Expected: PASS.

Run: `npm.cmd run build`

Expected: PASS.

- [ ] **Step 3: Check whitespace and inspect scope**

Run: `git diff --check`

Expected: no output and exit code 0.

Run: `git status --short` and inspect `git diff HEAD~3..HEAD --stat`.

Expected: only the approved spec/plan and four implementation/test files are part of this work; unrelated pre-existing changes remain untouched.

- [ ] **Step 4: Perform acceptance checks against the approved behavior**

Confirm all of the following from the final source and generated test payload:

- `showSavedToast`, its setter, and its rendered bottom toast no longer exist.
- `SharePrompt` still appears after a successful save and closes after either share or no-share without another toast.
- `FixturePredictionCard` renders both team logos before their names.
- Flex output has date headings, time headings above fixture rows, shared groups for identical Bangkok kickoff times, and a single bubble.
- The selected-fixture modal hides only its white title; player and save modals still render titles.

- [ ] **Step 5: Commit any final verification-only corrections if needed**

If verification finds a real implementation issue, fix it in the relevant task file, rerun the affected focused check and the full suite, then commit with a focused message. Do not modify unrelated worktree changes.
