import type { FantasyEntryCurrentSquad } from "./types.ts";

type StoredCurrentSquad = FantasyEntryCurrentSquad & {
  gameweekId: string;
  sourceSyncedAt: string;
};

export type CurrentSquadRepository = {
  getCurrentSquad(input: { seasonId: string; entryId: number }): Promise<StoredCurrentSquad | null>;
  upsertCurrentSquad(input: {
    seasonId: string;
    entryId: number;
    gameweekId: string;
    squad: FantasyEntryCurrentSquad;
    syncedAt: string;
  }): Promise<void>;
};

export type CurrentSquadResult = {
  entryId: number;
  squad: FantasyEntryCurrentSquad;
  cached: boolean;
  sourceSyncedAt: string;
};

export async function loadCurrentSquad(input: {
  seasonId: string;
  entryId: number;
  gameweekId: string;
  gameweekNumber: number;
  now: string;
  repository: CurrentSquadRepository;
  provider: { getEntryPicks(entryId: number, gameweekNumber: number): Promise<FantasyEntryCurrentSquad> };
}): Promise<CurrentSquadResult> {
  const stored = await input.repository.getCurrentSquad({
    seasonId: input.seasonId,
    entryId: input.entryId,
  });

  if (stored?.gameweekId === input.gameweekId && stored.gameweekNumber === input.gameweekNumber) {
    const squad: FantasyEntryCurrentSquad = {
      gameweekNumber: stored.gameweekNumber,
      formation: stored.formation,
      captainPlayerId: stored.captainPlayerId,
      viceCaptainPlayerId: stored.viceCaptainPlayerId,
      starters: stored.starters,
      bench: stored.bench,
    };
    return {
      entryId: input.entryId,
      squad,
      cached: true,
      sourceSyncedAt: stored.sourceSyncedAt,
    };
  }

  const squad = await input.provider.getEntryPicks(input.entryId, input.gameweekNumber);
  await input.repository.upsertCurrentSquad({
    seasonId: input.seasonId,
    entryId: input.entryId,
    gameweekId: input.gameweekId,
    squad,
    syncedAt: input.now,
  });
  return {
    entryId: input.entryId,
    squad,
    cached: false,
    sourceSyncedAt: input.now,
  };
}
