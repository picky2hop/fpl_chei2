export type AdminFeedback = {
  tone: "success" | "error";
  title: string;
  message: string;
};

export function feedbackFromAction(input: { ok: boolean; successMessage: string; errorMessage?: string }): AdminFeedback {
  return input.ok
    ? { tone: "success", title: "ดำเนินการสำเร็จ", message: input.successMessage }
    : { tone: "error", title: "ดำเนินการไม่สำเร็จ", message: input.errorMessage ?? "ดำเนินการไม่สำเร็จ" };
}
