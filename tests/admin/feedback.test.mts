import assert from "node:assert/strict";
import test from "node:test";
import { feedbackFromAction } from "../../lib/admin/feedback.ts";

test("builds a success feedback state", () => {
  assert.deepEqual(feedbackFromAction({ ok: true, successMessage: "ซิงก์สำเร็จแล้ว" }), {
    tone: "success",
    title: "ดำเนินการสำเร็จ",
    message: "ซิงก์สำเร็จแล้ว",
  });
});

test("builds an error feedback state without exposing internal details", () => {
  assert.deepEqual(feedbackFromAction({ ok: false, successMessage: "ไม่ใช้", errorMessage: "ดำเนินการไม่สำเร็จ" }), {
    tone: "error",
    title: "ดำเนินการไม่สำเร็จ",
    message: "ดำเนินการไม่สำเร็จ",
  });
});
