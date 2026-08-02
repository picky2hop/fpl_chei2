import test from "node:test";
import assert from "node:assert/strict";
import { shareFlexMessage } from "../../lib/line/share.ts";

const message = {
  type: "flex" as const,
  altText: "test flex",
  contents: { type: "bubble" },
};

test("shares a Flex message when the target picker is available", async () => {
  let received: unknown;
  const result = await shareFlexMessage({
    isApiAvailable: () => true,
    shareTargetPicker: async (messages, options) => {
      received = { messages, options };
      return { status: "success" };
    },
  }, message);

  assert.equal(result, "shared");
  assert.deepEqual(received, { messages: [message], options: { isMultiple: true } });
});

test("reports cancellation without claiming that a message was shared", async () => {
  const result = await shareFlexMessage({
    isApiAvailable: () => true,
    shareTargetPicker: async () => undefined,
  }, message);

  assert.equal(result, "cancelled");
});

test("does not claim success for a non-success picker result", async () => {
  const result = await shareFlexMessage({
    isApiAvailable: () => true,
    shareTargetPicker: async () => ({ status: "cancelled" }),
  }, message);

  assert.equal(result, "cancelled");
});

test("rejects clearly when the target picker is unavailable", async () => {
  await assert.rejects(
    shareFlexMessage({
      isApiAvailable: () => false,
      shareTargetPicker: async () => ({ status: "success" }),
    }, message),
    (error: unknown) => error instanceof Error && error.message === "SHARE_TARGET_PICKER_UNAVAILABLE",
  );
});

test("rejects a Flex payload with a Box-only width on text before opening the picker", async () => {
  let pickerCalled = false;
  const invalidMessage = {
    ...message,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [{ type: "text", text: "invalid", width: "20px" }],
      },
    },
  };

  await assert.rejects(
    shareFlexMessage({
      isApiAvailable: () => true,
      shareTargetPicker: async () => {
        pickerCalled = true;
        return { status: "success" };
      },
    }, invalidMessage),
    (error: unknown) => error instanceof Error && error.message === "FLEX_MESSAGE_INVALID",
  );
  assert.equal(pickerCalled, false);
});

test("rejects an oversized Flex payload before opening the picker", async () => {
  let pickerCalled = false;
  const oversizedMessage = {
    ...message,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [{ type: "text", text: "x".repeat(31_000) }],
      },
    },
  };

  await assert.rejects(
    shareFlexMessage({
      isApiAvailable: () => true,
      shareTargetPicker: async () => {
        pickerCalled = true;
        return { status: "success" };
      },
    }, oversizedMessage),
    (error: unknown) => error instanceof Error && error.message === "FLEX_MESSAGE_TOO_LARGE",
  );
  assert.equal(pickerCalled, false);
});

test("rejects an unsupported Flex Image aspect mode before opening the picker", async () => {
  let pickerCalled = false;
  const invalidMessage = {
    ...message,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [{
          type: "image",
          url: "https://example.test/team.png",
          aspectMode: "contain",
        }],
      },
    },
  };

  await assert.rejects(
    shareFlexMessage({
      isApiAvailable: () => true,
      shareTargetPicker: async () => {
        pickerCalled = true;
        return { status: "success" };
      },
    }, invalidMessage),
    (error: unknown) => error instanceof Error && error.message === "FLEX_MESSAGE_INVALID",
  );
  assert.equal(pickerCalled, false);
});
