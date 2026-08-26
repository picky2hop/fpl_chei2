"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

type DetailModalProps = {
  eyebrow: string;
  title: string;
  hideTitle?: boolean;
  onClose: () => void;
  children: ReactNode;
};

export default function DetailModal({ eyebrow, title, hideTitle = false, onClose, children }: DetailModalProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusableElements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])") ?? []).filter((element) => !element.hasAttribute("disabled"));
      if (!focusableElements.length) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-[#071525]/70 p-3 backdrop-blur-sm sm:items-center" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section ref={dialogRef} role="dialog" tabIndex={-1} aria-modal="true" {...(hideTitle ? { "aria-label": title || eyebrow } : { "aria-labelledby": `detail-modal-title-${titleId}` })} className="modal-surface modal-enter max-h-[84vh] w-full max-w-[480px] overflow-y-auto rounded-[28px] bg-[#10253a] p-5 text-white shadow-2xl outline-none">
        <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#a7c735]">{eyebrow}</p>{!hideTitle && <h2 id={`detail-modal-title-${titleId}`} className="mt-1 text-2xl font-black tracking-tight">{title}</h2>}</div><button ref={closeButtonRef} type="button" onClick={onClose} aria-label="ปิดรายละเอียด" className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-lg text-white/70 transition hover:bg-white/15 hover:text-white">×</button></div>
        {children}
      </section>
    </div>
  );
}
