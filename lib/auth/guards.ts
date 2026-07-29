import "server-only";

import { getServerEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSession } from "./session";

export class AuthError extends Error {
  constructor(public readonly status: 401 | 403, message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export type AuthenticatedUser = {
  id: string;
  lineUserId: string;
  displayName: string;
  avatarUrl: string | null;
  status: string;
  role: string;
};

export async function requireUser(): Promise<AuthenticatedUser> {
  const session = await getSession();
  if (!session) throw new AuthError(401, "Authentication required");

  const { data, error } = await getSupabaseAdmin()
    .from("app_users")
    .select("id,line_user_id,display_name,avatar_url,status,role")
    .eq("id", session.userId)
    .maybeSingle();

  if (error || !data || data.line_user_id !== session.lineUserId) {
    throw new AuthError(401, "Authentication required");
  }
  if (data.status !== "active") {
    throw new AuthError(403, "User is not active");
  }

  return {
    id: data.id,
    lineUserId: data.line_user_id,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
    status: data.status,
    role: data.role,
  };
}

export async function requireAdmin(): Promise<AuthenticatedUser> {
  const user = await requireUser();
  if (user.lineUserId !== getServerEnv().adminLineUserId) {
    throw new AuthError(403, "Admin access required");
  }
  return user;
}
