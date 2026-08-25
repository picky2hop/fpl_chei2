"use client";

type AdminAwardsConfirmationModalProps = {
  open: boolean;
  leagueName: string;
  gameweekNumber: number | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function AdminAwardsConfirmationModal({ open, leagueName, gameweekNumber, onCancel, onConfirm }: AdminAwardsConfirmationModalProps) {
  if (!open) return null;

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020814]/80 p-4" role="presentation">
    <section className="w-full max-w-md rounded-3xl border border-[#d9ff58]/30 bg-[#071525] p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="fantasy-awards-confirmation-title">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#d9ff58] text-2xl font-black text-[#071525]">!</div>
      <h2 id="fantasy-awards-confirmation-title" className="mt-4 text-center text-lg font-black">ยืนยันการบันทึก Awards ใหม่</h2>
      <p className="mt-3 text-center text-sm leading-6 text-white/70">{leagueName} · GW {gameweekNumber ?? "-"} มีข้อมูลแชมป์/บ๊วยอยู่แล้ว หากบันทึกใหม่ข้อมูลเดิมของ GW นี้จะถูกแทนที่ ต้องการดำเนินการต่อหรือไม่</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button type="button" onClick={onCancel} className="rounded-xl border border-white/15 px-4 py-3 text-sm font-black text-white/75">ยกเลิก</button>
        <button type="button" onClick={onConfirm} className="rounded-xl bg-[#d9ff58] px-4 py-3 text-sm font-black text-[#071525]">ยืนยันการบันทึกใหม่</button>
      </div>
    </section>
  </div>;
}
