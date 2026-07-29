export type ServerEnv = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  lineChannelId: string;
  sessionSecret: string;
  adminLineUserId: string;
  fplApiBaseUrl: string;
  syncToken: string;
};

const serverEnvEntries = [
  ["SUPABASE_URL", "supabaseUrl"],
  ["SUPABASE_SERVICE_ROLE_KEY", "supabaseServiceRoleKey"],
  ["LINE_CHANNEL_ID", "lineChannelId"],
  ["SESSION_SECRET", "sessionSecret"],
  ["ADMIN_LINE_USER_ID", "adminLineUserId"],
  ["FPL_API_BASE_URL", "fplApiBaseUrl"],
  ["FPL_SYNC_TOKEN", "syncToken"],
] as const;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }
  return value;
}

export function getServerEnv(): ServerEnv {
  return Object.fromEntries(
    serverEnvEntries.map(([name, property]) => [property, requiredEnv(name)]),
  ) as ServerEnv;
}
