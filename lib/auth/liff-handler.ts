import { LiffVerificationError, type VerifiedLineProfile } from "./liff.ts";
import type { SessionPayload } from "./session-codec.ts";

export type LiffAuthIdentity = {
  appUserId: string;
  displayName: string;
  avatarUrl: string | null;
  seasonId: string;
  seasonName: string;
};

export type LiffAuthDependencies = {
  verifyIdToken: (idToken: string) => Promise<VerifiedLineProfile>;
  upsertUserAndJoinSeason: (profile: VerifiedLineProfile) => Promise<LiffAuthIdentity>;
  createSession: (payload: SessionPayload) => Promise<void>;
};

type LiffRequestBody = { idToken?: unknown };

function isJsonRequest(request: Request): boolean {
  return request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() === "application/json";
}

function isLiffRequestBody(value: unknown): value is { idToken: string } {
  if (typeof value !== "object" || value === null || !("idToken" in value)) return false;
  const body = value as LiffRequestBody;
  return typeof body.idToken === "string" && body.idToken.trim().length > 0 && body.idToken.length <= 4096;
}

export function createLiffAuthHandler(dependencies: LiffAuthDependencies) {
  return async function POST(request: Request): Promise<Response> {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (!isJsonRequest(request) || (contentLength > 0 && contentLength > 8192)) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    if (!isLiffRequestBody(body)) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    try {
      const profile = await dependencies.verifyIdToken(body.idToken);
      const identity = await dependencies.upsertUserAndJoinSeason(profile);
      await dependencies.createSession({
        userId: identity.appUserId,
        lineUserId: profile.lineUserId,
      });

      return Response.json({
        user: {
          id: identity.appUserId,
          displayName: identity.displayName,
          avatarUrl: identity.avatarUrl,
        },
        season: {
          id: identity.seasonId,
          name: identity.seasonName,
        },
      });
    } catch (error) {
      if (error instanceof LiffVerificationError) {
        return Response.json({ error: "Invalid LIFF identity" }, { status: 401 });
      }
      return Response.json({ error: "Unable to sign in" }, { status: 500 });
    }
  };
}
