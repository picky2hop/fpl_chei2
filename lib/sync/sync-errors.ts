export type SyncFailureCode =
  | "FPL_HTTP_403"
  | "FPL_HTTP_502"
  | "FPL_HTTP_ERROR"
  | "FPL_TIMEOUT"
  | "FPL_INVALID_SNAPSHOT"
  | "FPL_UNAVAILABLE"
  | "SYNC_DATABASE_ERROR";

export type SafeSyncDetails = Record<string, string | number | boolean>;

export class SyncFailure extends Error {
  readonly code: SyncFailureCode;
  readonly details: SafeSyncDetails;

  constructor(code: SyncFailureCode, message: string, details: SafeSyncDetails = {}) {
    super(message);
    this.name = "SyncFailure";
    this.code = code;
    this.details = details;
  }
}

export function toSafeSyncFailure(error: unknown): SyncFailure {
  if (error instanceof SyncFailure) return error;
  return new SyncFailure("SYNC_DATABASE_ERROR", "Sync database operation failed");
}

export function safeSyncFailureReason(error: unknown): string {
  const failure = toSafeSyncFailure(error);
  switch (failure.code) {
    case "FPL_HTTP_403":
      return "FPL ปฏิเสธการเข้าถึงข้อมูล";
    case "FPL_HTTP_502":
      return "FPL API ไม่พร้อมให้บริการ";
    case "FPL_HTTP_ERROR":
      return "FPL API ตอบกลับผิดพลาด";
    case "FPL_TIMEOUT":
      return "FPL API ใช้เวลานานเกินกำหนด";
    case "FPL_INVALID_SNAPSHOT":
      return "ข้อมูล FPL ไม่ถูกต้อง";
    case "FPL_UNAVAILABLE":
      return "ไม่สามารถเชื่อมต่อ FPL API ได้";
    case "SYNC_DATABASE_ERROR":
      return "บันทึกข้อมูลลงฐานข้อมูลไม่สำเร็จ";
  }
}
