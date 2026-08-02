# Incident: LINE prediction share appears successful but no message arrives

Date: 2026-08-02
Scope: LIFF `shareTargetPicker` prediction-result share and the shared prediction Flex payload

## Symptom

The user can open the LINE share picker and complete the share flow, but the selected LINE group receives no visible prediction message. The client flow previously treated the picker result as success and had no payload validation before calling LINE, so the failure looked silent.

## Confirmed historical root cause

The earlier recurrence was caused by a Box-only `width` property being placed on the `VS` text component. LINE rejected the Flex payload, while the LIFF share flow did not provide a useful error to the user. This was fixed by moving the width to a vertical Box around the `VS` text.

## Confirmed current regression

The last confirmed working commit, `7fce840`, generated team images with `aspectMode: "cover"`. Commit `060931f` introduced `aspectMode: "contain"` while changing the team-logo presentation, and the later repair kept that value. LINE Flex Image supports only `fit` and `cover`, so both the bot command and LIFF share sent the same invalid prediction Flex payload.

The local validator did not catch the regression because it validated image URL rules but did not validate the `aspectMode` enum. The repair changes the transparent direct team-logo Image to `fit` and adds an enum allow-list to the validator.

## Changes made for prevention

- Team logos in prediction rows are now direct HTTPS image components with PNG conversion for supported Premier League SVG badge URLs. The unnecessary fixed-size logo wrapper was removed.
- Prediction fixtures are grouped into date sections using `Asia/Bangkok` calendar dates. The section heading is formatted as Thai weekday, date, and the actual fixture count, for example `วันเสาร์ที่ 1 สิงหาคม 2569 — 3 คู่`.
- `shareFlexMessage` validates the payload before opening `shareTargetPicker`.
- The validator rejects text components with Box-only `width` or `height`, SVG/non-HTTPS image URLs, Image aspect modes other than `fit` or `cover`, more than 12 children in a Box/carousel, and payloads above 30 KiB.
- Invalid payloads now produce a safe user-facing error and do not call the LINE picker. No payload content, token, key, or secret is logged.
- Regression tests cover the previous `VS` layout failure mode, the `contain` aspect-mode regression, PNG-only Flex assets, Thai date grouping, and pre-share rejection.

## Required verification after deployment

1. Open the LIFF URL inside the LINE WebView.
2. Complete the current gameweek predictions and choose `แชร์เข้า LINE`.
3. Select the designated test group and verify that one Flex message appears with the profile, date headings, all fixtures, selected-team highlights, and the app button.
4. In the same test group, send `ผลทาย` and verify the bot response has the same date grouping.
5. If the picker completes but the group is still empty, record only the local time, device/LINE version, and whether the app showed a validation error. Never record or paste channel secrets, access tokens, or private IDs into the repository or chat.

## Regression checklist for future Flex changes

- Keep Box-only properties on Box components; especially do not put `width` or `height` on Text.
- Keep each Box at or below 12 direct children.
- Use HTTPS image URLs and convert or omit SVG URLs before they enter a Flex payload.
- Use only `fit` or `cover` for Flex Image `aspectMode`; CSS-style `contain` is not valid LINE Flex JSON.
- Run `npm.cmd run test`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check` before deployment.
- Perform one real share in the LINE WebView after every prediction Flex layout change.
