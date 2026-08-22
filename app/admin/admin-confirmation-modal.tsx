"use client";

import { archiveConfirmationCopy, type ArchiveTarget } from "@/lib/admin/archive-confirmation";

export function AdminConfirmationModal({ target, onCancel, onConfirm }: { target: ArchiveTarget | null; onCancel: () => void; onConfirm: () => void }) {
  if (!target) return null;
  const copy = archiveConfirmationCopy(target);
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-[#020914]/80 p-4" role="presentation"><section className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#10253a] p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="admin-confirmation-title"><h2 id="admin-confirmation-title" className="text-lg font-black">{copy.title}</h2><p className="mt-3 text-sm font-bold leading-6 text-white/70">{copy.message}</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-black text-white/70">ยกเลิก</button><button type="button" onClick={onConfirm} className="rounded-xl border border-[#ff647c]/30 bg-[#ff647c]/10 px-4 py-2.5 text-xs font-black text-[#ff8698]">{copy.confirmLabel}</button></div></section></div>;
}
