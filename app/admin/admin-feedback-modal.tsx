"use client";

import type { AdminFeedback } from "@/lib/admin/feedback";

export function AdminFeedbackModal({ feedback, onClose }: { feedback: AdminFeedback | null; onClose: () => void }) {
  if (!feedback) return null;
  const success = feedback.tone === "success";
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#020914]/75 px-5" role="presentation" onClick={onClose}><section role="dialog" aria-modal="true" aria-labelledby="admin-feedback-title" className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#10253a] p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className={`mx-auto grid size-12 place-items-center rounded-full text-2xl font-black ${success ? "bg-[#47d7a0] text-[#06221a]" : "bg-[#ff647c] text-[#310812]"}`}>{success ? "✓" : "!"}</div><h2 id="admin-feedback-title" className="mt-4 text-center text-lg font-black">{feedback.title}</h2><p className={`mt-2 text-center text-sm font-bold leading-6 ${success ? "text-[#b7f5de]" : "text-[#ffb0bc]"}`}>{feedback.message}</p><button type="button" onClick={onClose} className="mt-5 w-full rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-black text-white/75 transition hover:bg-white/10">ปิด</button></section></div>;
}
