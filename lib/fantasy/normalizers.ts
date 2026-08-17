import type {
  FantasyGameweekScoreInsert,
  FantasyPlayerStatInsert,
  FplBootstrapSnapshot,
  FplEntryHistoryEvent,
} from "./types.ts";

export function normalizePlayerSnapshot(input: {
  seasonId: string;
  gameweekId: string;
  snapshot: FplBootstrapSnapshot;
  syncedAt: string;
}): FantasyPlayerStatInsert[] {
  return input.snapshot.players.map((player) => ({
    season_id: input.seasonId,
    gameweek_id: input.gameweekId,
    fpl_player_id: player.playerId,
    player_name: player.name,
    position: player.position,
    club_id: player.clubId,
    club_name: player.clubName,
    status: player.status,
    selected_by_percent: player.selectedByPercent,
    transfers_in_event: player.transfersInEvent,
      transfers_out_event: player.transfersOutEvent,
      form: player.form,
      is_global_captain: player.playerId === input.snapshot.mostCaptainedPlayerId,
      is_global_vice_captain: player.playerId === input.snapshot.mostViceCaptainedPlayerId,
      source_synced_at: input.syncedAt,
  }));
}

export function normalizeEntryHistory(input: {
  seasonId: string;
  mappingId: string;
  gameweekIdByNumber: Map<number, string>;
  history: FplEntryHistoryEvent[];
  syncedAt: string;
}): FantasyGameweekScoreInsert[] {
  return input.history.flatMap((event) => {
    const gameweekId = input.gameweekIdByNumber.get(event.event);
    if (!gameweekId) return [];
    return [{
      season_id: input.seasonId,
      mapping_id: input.mappingId,
      gameweek_id: gameweekId,
      points: event.points,
      event_transfers: event.event_transfers,
      event_transfers_cost: event.event_transfers_cost,
      points_on_bench: event.points_on_bench,
      source_synced_at: input.syncedAt,
    }];
  });
}
