import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getServerEnv } from "../lib/env.ts";

const requiredEnv = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
  LINE_CHANNEL_ID: "line-channel-test-id",
  SESSION_SECRET: "session-secret-test-value-that-is-long-enough",
  ADMIN_LINE_USER_ID: "line-admin-test-id",
  FPL_API_BASE_URL: "https://fpl.example.test",
  FPL_SYNC_TOKEN: "sync-token-test-value",
};

const previousValues = new Map<string, string | undefined>();

function setTestEnv(overrides: Partial<typeof requiredEnv> = {}) {
  for (const [key, value] of Object.entries(requiredEnv)) {
    previousValues.set(key, process.env[key]);
    if (key in overrides) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

afterEach(() => {
  for (const [key, value] of previousValues) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  previousValues.clear();
});

describe("server environment boundaries", () => {
  it("rejects a missing server secret without exposing its value", () => {
    setTestEnv({ SESSION_SECRET: "" });

    assert.throws(() => getServerEnv(), (error: unknown) => {
      assert(error instanceof Error);
      assert.match(error.message, /SESSION_SECRET/);
      assert.doesNotMatch(error.message, /session-secret-test-value/);
      return true;
    });
  });

  it("returns only server configuration from non-public environment variables", () => {
    setTestEnv();

    assert.deepEqual(getServerEnv(), {
      supabaseUrl: requiredEnv.SUPABASE_URL,
      supabaseServiceRoleKey: requiredEnv.SUPABASE_SERVICE_ROLE_KEY,
      lineChannelId: requiredEnv.LINE_CHANNEL_ID,
      sessionSecret: requiredEnv.SESSION_SECRET,
      adminLineUserId: requiredEnv.ADMIN_LINE_USER_ID,
      fplApiBaseUrl: requiredEnv.FPL_API_BASE_URL,
      syncToken: requiredEnv.FPL_SYNC_TOKEN,
    });
  });
});
