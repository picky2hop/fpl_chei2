# LINE Prediction Flex Aspect Mode Repair Design

Date: 2026-08-02
Status: Approved, implemented, and verified

## Problem

The LINE bot command `ผลทาย` and LIFF prediction sharing both produce no visible message. Both paths use `buildPredictionResultFlex`, so a schema error in that shared payload affects both features.

Comparison with the last confirmed working commit, `7fce840`, identifies the regression: the working payload used `aspectMode: "cover"`, while the current team-logo component uses `aspectMode: "contain"`. LINE Flex Image supports only `fit` and `cover`; therefore `contain` makes the payload invalid. The current local validator checks image URLs and payload structure but does not validate the `aspectMode` enum.

## Approved Design

Use `aspectMode: "fit"` for valid team-logo images. This preserves the complete logo without cropping and keeps the existing direct Image component. The Image has no wrapper background, corner radius, or filter, so transparent areas in a PNG reveal the Flex background.

If a logo URL is missing, non-HTTPS, or an unsupported SVG, retain the existing initials fallback. Only that fallback may use a circular colored background.

Do not roll back the date grouping, dynamic fixture counts, pre-share validation, or other changes added after `7fce840`.

## Validation and Error Handling

Extend `validateFlexMessage` so every Image component with an `aspectMode` accepts only `fit` or `cover`. Any other value, including `contain`, must throw `FLEX_MESSAGE_INVALID` before LIFF opens `shareTargetPicker`.

The Messaging API bot path does not call the LIFF validator, so the generated prediction Flex itself must be valid. The builder test therefore checks the produced payload directly, not only the LIFF share wrapper.

No payload contents, user identifiers, tokens, keys, or secrets will be added to logs or documentation.

## Test Design

Follow TDD with these regression tests:

1. Build a prediction Flex with two PNG team logos and assert both Image components use `aspectMode: "fit"`, have no circular wrapper, and contain no `"contain"` value anywhere in the serialized payload.
2. Pass a synthetic Flex Image with `aspectMode: "contain"` through `shareFlexMessage`; assert it throws `FLEX_MESSAGE_INVALID` and never calls `shareTargetPicker`.
3. Keep the existing tests for date grouping, actual fixture counts, PNG conversion, text/Box property validation, payload size, webhook commands, and sharing.

## Verification

Before requesting commit/push approval, run:

- `npm.cmd run test`
- `npm.cmd run lint`
- `npm.cmd run build`
- `git diff --check`

After deployment, manually verify both paths in the designated LINE test group:

- Send `ผลทาย` and confirm the bot replies with the Flex message.
- Share predictions from LIFF and confirm the selected group receives the Flex message.
