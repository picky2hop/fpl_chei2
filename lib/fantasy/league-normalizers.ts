import type {
  DeduplicatedLeagueMember,
  FantasyEntryGameweekScoreInsert,
  FantasyLeagueMembershipInsert,
  LeagueMemberSource,
} from "./league-types.ts";
import type { FplEntryHistoryEvent } from "./types.ts";

function validateMember(leagueId: string, member: { entryId: number; teamName: string; managerName: string }): void {
  if (!leagueId.trim()) throw new Error("Invalid FPL league ID");
  if (!Number.isSafeInteger(member.entryId) || member.entryId <= 0) throw new Error("Invalid FPL entry ID");
  if (!member.teamName.trim() || !member.managerName.trim()) throw new Error("Invalid FPL member identity");
}

export function deduplicateLeagueMembers(sources: LeagueMemberSource[]): DeduplicatedLeagueMember[] {
  const byEntry = new Map<number, DeduplicatedLeagueMember>();

  for (const source of sources) {
    for (const member of source.members) {
      validateMember(source.leagueId, member);
      const existing = byEntry.get(member.entryId);
      if (!existing) {
        byEntry.set(member.entryId, {
          entryId: member.entryId,
          teamName: member.teamName.trim(),
          managerName: member.managerName.trim(),
          ...(member.eventTotal === undefined ? {} : { eventTotal: member.eventTotal }),
          ...(member.seasonTotal === undefined ? {} : { seasonTotal: member.seasonTotal }),
          ...(member.eventTransfers === undefined ? {} : { eventTransfers: member.eventTransfers }),
          ...(member.eventTransfersCost === undefined ? {} : { eventTransfersCost: member.eventTransfersCost }),
          leagues: [{ leagueId: source.leagueId, rank: member.rank }],
        });
        continue;
      }
      if (existing.eventTotal === undefined && member.eventTotal !== undefined) existing.eventTotal = member.eventTotal;
      if (existing.seasonTotal === undefined && member.seasonTotal !== undefined) existing.seasonTotal = member.seasonTotal;
      if (existing.eventTransfers === undefined && member.eventTransfers !== undefined) existing.eventTransfers = member.eventTransfers;
      if (existing.eventTransfersCost === undefined && member.eventTransfersCost !== undefined) existing.eventTransfersCost = member.eventTransfersCost;
      if (!existing.leagues.some((league) => league.leagueId === source.leagueId)) {
        existing.leagues.push({ leagueId: source.leagueId, rank: member.rank });
      }
    }
  }

  return [...byEntry.values()];
}

export function buildMembershipSnapshotRows(input: {
  seasonId: string;
  gameweekId: string;
  syncedAt: string;
  sources: LeagueMemberSource[];
}): FantasyLeagueMembershipInsert[] {
  const rows: FantasyLeagueMembershipInsert[] = [];
  const seen = new Set<string>();

  for (const source of input.sources) {
    for (const member of source.members) {
      validateMember(source.leagueId, member);
      const key = `${source.leagueId}:${member.entryId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        season_id: input.seasonId,
        league_id: source.leagueId,
        gameweek_id: input.gameweekId,
        fpl_entry_id: member.entryId,
        fpl_team_name: member.teamName.trim(),
        fpl_manager_name: member.managerName.trim(),
        source_synced_at: input.syncedAt,
      });
    }
  }

  return rows;
}

export function buildEntryScoreRequestIds(rows: FantasyLeagueMembershipInsert[]): number[] {
  return [...new Set(rows.map((row) => row.fpl_entry_id))];
}

export function buildEntryGameweekScoreRows(input: {
  seasonId: string;
  gameweekIdByNumber: Map<number, string>;
  historyByEntry: Map<number, FplEntryHistoryEvent[]>;
  membersByEntry: Map<number, Pick<DeduplicatedLeagueMember, "teamName" | "managerName">>;
  syncedAt: string;
}): FantasyEntryGameweekScoreInsert[] {
  const rows: FantasyEntryGameweekScoreInsert[] = [];
  for (const [entryId, history] of input.historyByEntry) {
    const member = input.membersByEntry.get(entryId);
    if (!member) throw new Error("Fantasy Entry member identity is unavailable");
    for (const event of history) {
      const gameweekId = input.gameweekIdByNumber.get(event.event);
      if (!gameweekId) continue;
      rows.push({
        season_id: input.seasonId,
        gameweek_id: gameweekId,
        fpl_entry_id: entryId,
        fpl_team_name: member.teamName,
        fpl_manager_name: member.managerName,
        points: event.points,
        event_transfers: event.event_transfers,
        event_transfers_cost: event.event_transfers_cost,
        points_on_bench: event.points_on_bench,
        calculation_method: "legacy_fpl_history",
        source_synced_at: input.syncedAt,
      });
    }
  }
  return rows;
}
