# Prediction Awards and LINE Announcement Design

## Goal

Make post-gameweek participation, scoring awards, and the LINE prediction-awards announcement consistent with the approved GW lifecycle rules.

## Decisions

- A newly authenticated user joins only `open` and `upcoming` gameweeks. Existing participant rows are preserved.
- The app's default gameweek continues to follow `is_current`.
- A scoring participant must have at least one active prediction for a fixture in that gameweek. A participant may still receive zero points when every eligible prediction is wrong.
- Every eligible participant tied at the highest score receives `champion`; every eligible participant tied at the lowest score receives `wooden_spoon`.
- The bot command `แชมป์บ๊วยทายผล` selects the newest closed gameweek with persisted awards. It therefore keeps showing GW5 while GW6 is not yet closed, then switches to GW6 after GW6 scoring is available.
- The awards Flex has no app button. It contains the gameweek, champion and wooden-spoon sections, profile images, names, and points.
- The bot replies with a decorated LINE text-v2 announcement that mentions eligible award recipients in group chats. It falls back to plain text when mention delivery is not possible. LINE's 20-mention limit is respected.

## Data flow

1. LIFF authentication upserts the user identity.
2. Onboarding inserts missing participant rows only for open/upcoming gameweeks.
3. Domain scoring filters active participants to those with at least one active prediction in the target gameweek.
4. The local recalculation path and Supabase atomic FPL sync use the same eligibility rule.
5. The LINE data reader loads the newest closed gameweek with awards and joins award recipients to `app_users` for display name, avatar, and LINE user ID.
6. The webhook returns one awards Flex and one decorated announcement message.

## Failure behavior

- No closed gameweek with awards returns a safe “ยังไม่มีผลตัดสิน” text message.
- Missing avatar URLs use the existing Flex fallback.
- Missing LINE user IDs remain visible in the Flex and plain announcement text but are not included in mentions.
- A direct/private chat receives a plain announcement because LINE mentions require a group or multi-person chat.

## Verification

- Unit tests cover onboarding eligibility, scoring eligibility, tie-all awards, latest-awarded-gameweek selection, Flex layout, menu parsing, webhook message composition, and mention fallback.
- SQL migration tests verify both scoring paths exclude participants with no active prediction.
- Full test, lint, build, and `git diff --check` are run before completion.
