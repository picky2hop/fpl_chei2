export type VerifiedLineProfile = {
  lineUserId: string;
  displayName: string;
  pictureUrl: string | null;
};

export class LiffVerificationError extends Error {
  constructor() {
    super("LINE ID token verification failed");
    this.name = "LiffVerificationError";
  }
}

type LineVerifyResponse = {
  iss?: unknown;
  sub?: unknown;
  aud?: unknown;
  exp?: unknown;
  name?: unknown;
  picture?: unknown;
};

export async function verifyLiffIdToken(
  idToken: string,
  fetchImpl: typeof fetch = fetch,
  channelId = process.env.LINE_CHANNEL_ID,
): Promise<VerifiedLineProfile> {
  if (!channelId || idToken.trim().length === 0 || idToken.length > 4096) {
    throw new LiffVerificationError();
  }

  const response = await fetchImpl("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
  });

  if (!response.ok) throw new LiffVerificationError();

  let verified: LineVerifyResponse;
  try {
    verified = await response.json() as LineVerifyResponse;
  } catch {
    throw new LiffVerificationError();
  }

  const expiry = typeof verified.exp === "number" ? verified.exp : 0;
  if (
    verified.iss !== "https://access.line.me"
    || verified.aud !== channelId
    || typeof verified.sub !== "string"
    || !/^U[0-9a-f]{32}$/i.test(verified.sub)
    || typeof verified.name !== "string"
    || expiry <= Math.floor(Date.now() / 1000)
  ) {
    throw new LiffVerificationError();
  }

  return {
    lineUserId: verified.sub,
    displayName: verified.name,
    pictureUrl: typeof verified.picture === "string" ? verified.picture : null,
  };
}
