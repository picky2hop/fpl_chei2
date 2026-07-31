import { createHmac, timingSafeEqual } from "node:crypto";

export function computeLineSignature(body: string, channelSecret: string): string {
  return createHmac("sha256", channelSecret).update(body, "utf8").digest("base64");
}

export function verifyLineSignature(
  body: string,
  receivedSignature: string | undefined,
  channelSecret: string,
): boolean {
  if (!receivedSignature) return false;

  try {
    const expected = Buffer.from(computeLineSignature(body, channelSecret), "base64");
    const received = Buffer.from(receivedSignature, "base64");
    return expected.length === received.length && timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}
