"use client";

import { useEffect, type ReactNode } from "react";

type DetailModalProps = {
  eyebrow: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export default function DetailModal({ eyebrow, title, onClose, children }: DetailModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-[#071525]/70 p-3 backdrop-blur-sm sm:items-center" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="detail-modal-title" className="modal-surface modal-enter max-h-[84vh] w-full max-w-[480px] overflow-y-auto rounded-[28px] bg-[#10253a] p-5 text-white shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#a7c735]">{eyebrow}</p><h2 id="detail-modal-title" className="mt-1 text-2xl font-black tracking-tight">{title}</h2></div><button type="button" onClick={onClose} aria-label="ปิดรายละเอียด" className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-lg text-white/70 transition hover:bg-white/15 hover:text-white">×</button></div>
        {children}
      </section>
    </div>
  );
}
