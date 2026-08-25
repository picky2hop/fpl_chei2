import type { LiffAuthIdentity } from "./liff-handler.ts";

export type RepositoryUser = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

export type RepositorySeason = {
  id: string;
  name: string;
};

export type RepositoryGameweek = {
  id: string;
  status: "open" | "upcoming" | "closed" | "reopened";
};

export type AppUserRole = "player" | "admin";

export function getAppUserRole(lineUserId: string, adminLineUserId: string): AppUserRole {
  return lineUserId === adminLineUserId ? "admin" : "player";
}

export function getMissingParticipantGameweekIds(
  seasonGameweeks: readonly RepositoryGameweek[],
  existingParticipantGameweekIds: readonly string[],
): string[] {
  const existing = new Set(existingParticipantGameweekIds);
  return seasonGameweeks
    .filter((gameweek) => gameweek.status === "open" || gameweek.status === "upcoming")
    .map((gameweek) => gameweek.id)
    .filter((id) => !existing.has(id));
}

export function toLiffAuthIdentity(
  user: RepositoryUser,
  season: RepositorySeason,
): LiffAuthIdentity {
  return {
    appUserId: user.id,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    seasonId: season.id,
    seasonName: season.name,
  };
}
