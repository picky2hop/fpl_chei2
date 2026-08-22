import assert from "node:assert/strict";
import test from "node:test";
import { archiveConfirmationCopy, archiveEndpoint, type ArchiveTarget } from "../../lib/admin/archive-confirmation.ts";

const mappingTarget: ArchiveTarget = { kind: "mapping", id: "mapping-1", label: "Chei FC · FPL 123" };

test("builds an explicit confirmation before archiving a mapping", () => {
  assert.deepEqual(archiveConfirmationCopy(mappingTarget), {
    title: "ยืนยันการ Archive",
    message: "ต้องการเก็บ Chei FC · FPL 123 ไว้ดูประวัติหรือไม่?",
    confirmLabel: "ยืนยัน Archive",
  });
  assert.equal(archiveEndpoint(mappingTarget), "/api/admin/fantasy/mappings/mapping-1/archive");
});

test("builds the league archive endpoint separately from mapping archive", () => {
  assert.equal(archiveEndpoint({ kind: "league", id: "league-1", label: "เชยเชย Cup" }), "/api/admin/fantasy/leagues/league-1/archive");
});
