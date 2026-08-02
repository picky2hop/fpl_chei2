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

function isSuccessfulShareResult(value: unknown): boolean {
  return typeof value === "object" && value !== null && "status" in value && value.status === "success";
}
