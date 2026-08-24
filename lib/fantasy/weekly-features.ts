import { buildFplPlayerPhotoUrl } from "./player-image.ts";
import type {
  FantasyPlayerOfWeek,
  FantasySquadPlayer,
  FantasyTeamOfWeek,
  FantasyWeeklyFeatureState,
  FplBootstrapSnapshot,
  FplDreamTeamSnapshot,
  FplEventLivePlayer,
  FantasyFplProvider,
} from "./types.ts";

function playerFromBootstrap(bootstrap: FplBootstrapSnapshot, playerId: number, points: number, pickPosition: number): FantasySquadPlayer | null {
  const player = bootstrap.players.find((candidate) => candidate.playerId === playerId);
  if (!player) return null;
  return {
    pickPosition,
    playerId: player.playerId,
    playerName: player.name,
    position: player.position,
    clubName: player.clubName,
    clubShortName: player.clubShortName,
    multiplier: 1,
    isCaptain: false,
    isViceCaptain: false,
    photoUrl: player.photoKey ? buildFplPlayerPhotoUrl(player.photoKey) : undefined,
    points,
  } satisfies FantasySquadPlayer;
}

export function resolvePlayerOfWeek(input: {
  bootstrap: FplBootstrapSnapshot;
  gameweek: number;
  eventLive: FplEventLivePlayer[];
}): FantasyPlayerOfWeek | null {
  const validPoints = input.eventLive.map((player) => player.points).filter(Number.isFinite);
  if (!validPoints.length) return null;
  const topPoints = Math.max(...validPoints);
  const players = input.eventLive
    .filter((player) => player.points === topPoints)
    .sort((left, right) => left.playerId - right.playerId)
    .map((player, index) => playerFromBootstrap(input.bootstrap, player.playerId, player.points, index + 1))
    .filter((player): player is FantasySquadPlayer => player !== null);
  return players.length ? { gameweek: input.gameweek, topPoints, players } : null;
}

export function resolveLatestPlayerOfWeek(input: {
  bootstrap: FplBootstrapSnapshot;
  eventLiveByGameweek: ReadonlyMap<number, FplEventLivePlayer[]>;
}): FantasyWeeklyFeatureState<FantasyPlayerOfWeek> {
  const candidates = input.bootstrap.gameweeks
    .filter((gameweek) => gameweek.number <= input.bootstrap.currentGameweek)
    .sort((left, right) => right.number - left.number);
  for (const gameweek of candidates) {
    const eventLive = input.eventLiveByGameweek.get(gameweek.number);
    if (!eventLive) continue;
    const result = resolvePlayerOfWeek({ bootstrap: input.bootstrap, gameweek: gameweek.number, eventLive });
    if (result) return { state: "ready", value: result };
  }
  return { state: "unavailable", message: "ยังไม่มีข้อมูล Player of the Week" };
}

export async function loadLatestPlayerOfWeek(input: {
  provider: Pick<FantasyFplProvider, "getBootstrap" | "getEventLive">;
}): Promise<FantasyWeeklyFeatureState<FantasyPlayerOfWeek>> {
  let bootstrap: FplBootstrapSnapshot;
  try {
    bootstrap = await input.provider.getBootstrap();
  } catch {
    return { state: "unavailable", message: "ไม่สามารถโหลด Player of the Week ได้ในขณะนี้" };
  }
  const candidates = bootstrap.gameweeks
    .filter((gameweek) => gameweek.number <= bootstrap.currentGameweek)
    .sort((left, right) => right.number - left.number);
  for (const gameweek of candidates) {
    try {
      const result = resolvePlayerOfWeek({
        bootstrap,
        gameweek: gameweek.number,
        eventLive: await input.provider.getEventLive(gameweek.number),
      });
      if (result) return { state: "ready", value: result };
    } catch {
      // Try the previous GW when this candidate is unavailable or malformed.
    }
  }
  return { state: "unavailable", message: "ยังไม่มีข้อมูล Player of the Week" };
}

export function resolveTeamOfWeek(input: {
  bootstrap: FplBootstrapSnapshot;
  dreamTeam: FplDreamTeamSnapshot;
  gameweek: number;
}): FantasyTeamOfWeek | null {
  if (input.dreamTeam.players.length !== 11) return null;
  const playerIds = input.dreamTeam.players.map((player) => player.playerId);
  if (new Set(playerIds).size !== playerIds.length) return null;
  const players = input.dreamTeam.players
    .map((player, index) => playerFromBootstrap(input.bootstrap, player.playerId, player.points, index + 1))
    .filter((player): player is FantasySquadPlayer => player !== null);
  return players.length === 11 ? { gameweek: input.gameweek, source: "FPL Official", players } : null;
}

export async function loadLatestTeamOfWeek(input: {
  provider: Pick<FantasyFplProvider, "getBootstrap" | "getDreamTeam">;
}): Promise<FantasyWeeklyFeatureState<FantasyTeamOfWeek>> {
  try {
    const bootstrap = await input.provider.getBootstrap();
    const gameweeks = bootstrap.gameweeks
      .filter((gameweek) => gameweek.number <= bootstrap.currentGameweek)
      .sort((left, right) => right.number - left.number);
    for (const gameweek of gameweeks) {
      try {
        const result = resolveTeamOfWeek({
          bootstrap,
          dreamTeam: await input.provider.getDreamTeam(gameweek.number),
          gameweek: gameweek.number,
        });
        if (result) return { state: "ready", value: result };
      } catch {
        // Try the previous GW when this candidate is unavailable or malformed.
      }
    }
  } catch {
    // Return the safe feature-level error below.
  }
  return { state: "unavailable", message: "ไม่สามารถโหลด Team of the Week ได้ในขณะนี้" };
}
