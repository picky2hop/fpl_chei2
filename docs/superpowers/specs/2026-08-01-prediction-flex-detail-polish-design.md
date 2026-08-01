# Prediction Flex Detail Polish Design

## Goal

Make the shared prediction-result Flex match the app's Player Detail presentation more closely while keeping Bot and LIFF share behavior identical.

## Approved behavior

- Remove the top `PLAYER PICKS` and prediction title card; keep the profile card as the first content block.
- Center each home and away team name/logo group, with `VS` centered between them.
- Apply the selected-side highlight as the app's translucent accent filter: `#d9ff5815` background with `#d9ff58` text.
- Keep the home/away/draw choice pill aligned to the far right of each fixture row.
- Remove the outer fixture-row card treatment so fixture rows show the Flex background, with only the selected-side translucent filter visible.
- Preserve the home order `name + logo`, away order `logo + name`, PNG-only Flex images, and the bottom LIFF action button.

## Scope and verification

Change only the shared prediction Flex builder and its unit tests, plus this design/implementation documentation. Verify the result with `npm.cmd run test`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check`. Do not change fixtures, Supabase data/schema, secrets, LINE configuration, or the LIFF URL.
