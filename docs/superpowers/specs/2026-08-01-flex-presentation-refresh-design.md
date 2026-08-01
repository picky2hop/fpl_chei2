# Flex Presentation Refresh Design

## Goal

Refresh the three requested LINE Flex presentations while preserving the existing LIFF action URL, PNG-only team assets, app colors, and shared Bot/LIFF payload path.

## Approved behavior

### Standings

Add an update line immediately below the standings rows and above the existing app action. The line uses the Bangkok-local time when the Flex is built, for example `อัปเดต 1 ส.ค. 2569 เวลา 18:46 น.`. This is the message-generation time, not the data-sync completion time.

### Menu

Keep the `เมนู` command and its Flex response, but show only three red message-action buttons: `ขอตาราง`, `บอลวันนี้`, and `ผลทาย`. The `เมนู` button is removed from the response to avoid a self-repeating menu.

### Prediction result

Use one bubble containing all prediction fixtures; do not split fixtures into a carousel. Match the app's player-detail style:

- eyebrow: `PLAYER PICKS`
- title: `คำทาย GW{gameweek} ของ {displayName}`
- profile card with circular avatar, display name, and `คำทายของ GW {gameweek}`
- one compact match row per fixture
- home side is `ชื่อทีมเหย้า + โลโก้ทีมเหย้า`
- away side is `โลโก้ทีมเยือน + ชื่อทีมเยือน`
- selected team side uses the app's green highlight
- choice pill uses the app colors: home pink, draw green, away blue
- keep the bottom LIFF action button

The payload continues to be built by `buildPredictionResultFlex()`, so Bot `ผลทาย` and LIFF prediction share receive identical content.

## Scope and safety

Modify only the Flex builder, menu command payload, and their unit tests. Do not change fixtures, Supabase schema/data, secrets, LINE configuration, or the LIFF URL.

## Verification

Tests will assert the generated update label, exactly three menu actions, one prediction bubble, the requested title/profile, team order, highlight colors, choice colors, PNG conversion, and LIFF action. Full tests, lint, build, and `git diff --check` must pass before requesting commit/push approval.
