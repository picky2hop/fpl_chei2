# LINE Flex and live prediction regression design

## Goal

แก้ regression ที่พบจาก production smoke test ให้ข้อมูลคำทายในแอปและ Flex ใช้ข้อมูลจริง, LINE รับ Flex ที่มีโลโก้ได้, และ Bot ตอบคำสั่งที่อนุมัติอย่างสม่ำเสมอ

## Root causes

- Live dashboard currently exposes only the logged-in user's predictions. Player and fixture detail components still read the mock prediction book, so real users produce empty details.
- Flex team/avatar assets may be SVG URLs. LINE Flex image assets are normalized to PNG-safe URLs or omitted to avoid rejecting the entire message.
- The Flex footer uses the old app URL and the old English heading; its action is replaced with the approved LIFF URL and Thai copy.
- Bot command parsing lacks `ทายผล`; data-reader failures currently escape to the webhook route and result in no reply.

## Design

1. Extend the read-only dashboard DTO with a per-gameweek, per-user prediction book. Keep the existing current-user prediction map for editing. Do not add migrations or write queries.
2. Pass the live prediction book through `LiveDashboard` to `PredictionApp`; use it in `PlayerDetail` and `FixtureDetail`. Demo mode continues to use mock data.
3. Add pure Flex asset normalization. Transform known Premier League SVG badge URLs to the PNG endpoint, reject unsupported image formats, use `giga` bubbles, circular avatar images, Thai headings, and the approved LIFF URI. Use a clickable Flex box with dark text for the lime footer action.
4. Add `ทายผล` as an exact alias. For approved data commands, return a safe Thai fallback message when a read-only data query fails instead of silently returning HTTP 502 with no user-visible reply.

## Error handling and safety

- Never expose environment values, database errors, IDs, or raw LINE payloads to users.
- Preserve unknown-text behavior: unsupported ordinary text receives no reply.
- No push/broadcast, group-ID restriction, schema change, fixture mutation, or production data write.

## Acceptance criteria

- Selecting a leaderboard player shows their active predictions for the selected/current gameweek with home name+logo and away logo+name.
- Selecting a fixture shows predictor avatar/name grouped under home/draw/away.
- Prediction Flex is accepted by LINE with PNG-compatible assets and uses the approved LIFF action.
- Standings Flex uses a full-width-friendly `giga` bubble, circular avatars, Thai heading, and dark action text.
- `เมนู`, `ทายผล`, `บอลวันนี้`, and `ขอตาราง` produce a reply; unknown text remains ignored.
- Automated tests, lint, build, and diff checks pass.
