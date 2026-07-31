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

  const result = await api.shareTargetPicker([message], { isMultiple: true });
  return result ? "shared" : "cancelled";
}
