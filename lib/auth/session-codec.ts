import { SignJWT, jwtVerify } from "jose";

export type SessionPayload = {
  userId: string;
  lineUserId: string;
};

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function encodeSession(
  payload: SessionPayload,
  secret: string,
  ttlSeconds = 60 * 60 * 24 * 7,
  now = new Date(),
): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + ttlSeconds)
    .sign(secretKey(secret));
}

export async function decodeSession(
  token: string | undefined,
  secret: string,
  currentDate = new Date(),
): Promise<SessionPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey(secret), {
      algorithms: ["HS256"],
      currentDate,
    });

    if (typeof payload.userId !== "string" || typeof payload.lineUserId !== "string") {
      return null;
    }

    return {
      userId: payload.userId,
      lineUserId: payload.lineUserId,
    };
  } catch {
    return null;
  }
}
