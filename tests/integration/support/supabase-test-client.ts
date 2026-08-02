import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../lib/db/types.ts";

export function createTestSupabaseClient(): SupabaseClient<Database> {
  const url = process.env.SUPABASE_TEST_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY are required");
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
