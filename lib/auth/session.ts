import "server-only";

import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env";
import { decodeSession, encodeSession, type SessionPayload } from "./session-codec";

export const SESSION_COOKIE_NAME = "fpl_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await encodeSession(payload, getServerEnv().sessionSecret, SESSION_TTL_SECONDS);
  const cookieStore = await cookies();

  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return decodeSession(token, getServerEnv().sessionSecret);
}

export async function deleteSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE_NAME);
}
