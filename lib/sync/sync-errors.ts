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
