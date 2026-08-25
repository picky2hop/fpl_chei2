import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Admin awards uses an explicit replacement confirmation flow", async () => {
    const source = await readFile(new URL("../../app/admin/fantasy-admin-panel.tsx", import.meta.url), "utf8");
    const modalSource = await readFile(new URL("../../app/admin/admin-awards-confirmation-modal.tsx", import.meta.url), "utf8");

  assert.match(source, /AdminAwardsConfirmationModal/);
  assert.match(source, /FANTASY_AWARDS_EXIST/);
  assert.match(source, /confirmReplace/);
    assert.match(modalSource, /ยืนยันการบันทึก Awards ใหม่/);
});
