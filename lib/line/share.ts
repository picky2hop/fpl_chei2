import { validateFlexMessage } from "./flex.ts";

export type ShareMessage = {
  type: "flex";
  altText: string;
  contents: Record<string, unknown>;
};

export type ShareTargetPickerApi = {
  isApiAvailable: (apiName: "shareTargetPicker") => boolean;
  shareTargetPicker: (messages: ShareMessage[], options: { isMultiple: boolean }) => Promise<unknown>;
};

export async function shareFlexMessage(
  api: ShareTargetPickerApi,
  message: ShareMessage,
): Promise<"shared" | "cancelled"> {
  if (!api.isApiAvailable("shareTargetPicker")) {
    throw new Error("SHARE_TARGET_PICKER_UNAVAILABLE");
  }

  validateFlexMessage(message);
  const result = await api.shareTargetPicker([message], { isMultiple: true });
  return isSuccessfulShareResult(result) ? "shared" : "cancelled";
}

export function formatShareErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  if (code === "SHARE_TARGET_PICKER_UNAVAILABLE") {
    return "สภาพแวดล้อมนี้ยังไม่รองรับการแชร์เข้า LINE กรุณาเปิดแอปผ่าน LINE WebView";
  }
  if (code === "FLEX_MESSAGE_TOO_LARGE") {
    return "ข้อความมีข้อมูลมากเกินไปสำหรับ LINE กรุณาลองใหม่อีกครั้ง";
  }
  if (code === "FLEX_MESSAGE_INVALID") {
    return "รูปแบบการแชร์นี้ไม่รองรับโดย LINE กรุณาลองใหม่อีกครั้ง";
  }
  return "แชร์เข้า LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
}

function isSuccessfulShareResult(value: unknown): boolean {
  return typeof value === "object" && value !== null && "status" in value && value.status === "success";
}
