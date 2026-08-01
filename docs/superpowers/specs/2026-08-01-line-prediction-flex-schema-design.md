# LINE Prediction Flex Schema Design

## Root cause

At 18:46:17 production LINE logs returned HTTP 400 for the prediction reply. LINE identified this property as invalid:

`/contents/0/body/contents/2/contents/0/contents/0/justifyContent`

This path resolves to the home-team box in the first prediction fixture. The current builder emits `justifyContent: "end"` for home teams and `justifyContent: "start"` for away teams. LINE Flex accepts `flex-end` and `flex-start` for `justifyContent`, so the whole prediction Flex is rejected before delivery.

## Approved design

- Change only `"end"` to `"flex-end"` and `"start"` to `"flex-start"` in `teamSide()`.
- Preserve the visual intent: home team name then logo aligned to the right; away team logo then name aligned to the left.
- Keep the existing colors, team order, profile header, prediction highlights, carousel pagination, PNG conversion, and LIFF action unchanged.
- Because Bot `ผลทาย` and LIFF prediction sharing use `buildPredictionResultFlex()`, one builder fix repairs both paths.

## Testing

- Add a regression assertion that the generated prediction Flex contains `flex-end` and `flex-start` and does not contain the invalid `justifyContent` values `end` or `start`.
- Run the full test suite, lint, build, and `git diff --check`.
- After deployment, test both Bot `ผลทาย` and LIFF prediction share. The Bot test must return 200 with no `LINE_MESSAGING_API_REPLY_FAILED` log; the LIFF share must place the Flex message into the selected LINE chat.

No fixture data, Supabase schema, secrets, or LINE configuration will be changed.
