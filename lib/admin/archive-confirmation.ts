export type ArchiveTarget = { kind: "league" | "mapping"; id: string; label: string };

export function archiveEndpoint(target: ArchiveTarget): string {
  return target.kind === "league"
    ? `/api/admin/fantasy/leagues/${target.id}/archive`
    : `/api/admin/fantasy/mappings/${target.id}/archive`;
}

export function archiveConfirmationCopy(target: ArchiveTarget): { title: string; message: string; confirmLabel: string } {
  return {
    title: "ยืนยันการ Archive",
    message: `ต้องการเก็บ ${target.label} ไว้ดูประวัติหรือไม่?`,
    confirmLabel: "ยืนยัน Archive",
  };
}
