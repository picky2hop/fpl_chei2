import { createLiffAuthHandler } from "@/lib/auth/liff-handler";
import { verifyLiffIdToken } from "@/lib/auth/liff";
import { createSession } from "@/lib/auth/session";
import { upsertUserAndJoinSeason } from "@/lib/data/auth";

export const POST = createLiffAuthHandler({
  verifyIdToken: verifyLiffIdToken,
  upsertUserAndJoinSeason,
  createSession,
});
