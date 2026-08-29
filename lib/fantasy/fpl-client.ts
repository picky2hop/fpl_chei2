import { getServerEnv } from "../env.ts";
import { normalizeEntryCurrentSquad } from "./normalizers.ts";
import { buildFplPlayerPhotoUrl, photoKeyFromFplPhoto } from "./player-image.ts";
import type { FplLeagueMember, FplLeagueSummary } from "./league-types.ts";
import type {
  FantasyFplProviderWithPicks,
  FplDreamTeamSnapshot,
  FplEventLivePlayer,
  FantasySquadPlayer,
  FplBootstrapSnapshot,
  FplEntryCurrentSquad,
  FplEntryHistoryEvent,
  FplEntrySummary,
  FplPlayerSnapshot,
} from "./types.ts";

type FetchFantasyFplOptions = {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
};

export class FantasyFplError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "FantasyFplError";
    this.code = code;
  }
}

function numberValue(value: unknown, field: string): number {
  const result = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(result)) throw new FantasyFplError("FANTASY_FPL_INVALID_DATA", `Invalid FPL field: ${field}`);
  return result;
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null) throw new FantasyFplError("FANTASY_FPL_INVALID_DATA", `Invalid FPL ${label}`);
  return value as Record<string, unknown>;
}

function arrayValue(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new FantasyFplError("FANTASY_FPL_INVALID_DATA", `Invalid FPL ${label}`);
  return value;
}

function nullableNumberValue(value: unknown, field: string): number | null {
  return value == null ? null : numberValue(value, field);
}

function leagueMeta(value: unknown): FplLeagueSummary {
  const root = objectValue(value, "league standings");
  const league = objectValue(root.league, "league details");
  const leagueId = numberValue(league.id, "league id");
  const officialName = String(league.name ?? "").trim();
  if (!officialName) throw new FantasyFplError("FANTASY_FPL_INVALID_DATA", "FPL league name is missing");
  return { leagueId, officialName };
}

function leagueMembersPage(value: unknown): { meta: FplLeagueSummary; members: FplLeagueMember[]; hasNext: boolean } {
  const root = objectValue(value, "league standings");
  const meta = leagueMeta(value);
  const standings = objectValue(root.standings, "league standings data");
  const members = arrayValue(standings.results, "league standings results").map((item) => {
    const row = objectValue(item, "league member");
    const teamName = String(row.entry_name ?? "").trim();
    const managerName = String(row.player_name ?? "").trim();
    if (!teamName || !managerName) throw new FantasyFplError("FANTASY_FPL_INVALID_DATA", "FPL league member identity is missing");
    return {
      entryId: numberValue(row.entry, "league entry id"),
      teamName,
      managerName,
      rank: row.rank == null ? null : numberValue(row.rank, "league member rank"),
      ...(row.event_total == null ? {} : { eventTotal: numberValue(row.event_total, "league member event total") }),
      ...(row.total == null ? {} : { seasonTotal: numberValue(row.total, "league member season total") }),
      ...(row.event_transfers == null ? {} : { eventTransfers: numberValue(row.event_transfers, "league member event transfers") }),
      ...(row.event_transfers_cost == null ? {} : { eventTransfersCost: numberValue(row.event_transfers_cost, "league member event transfers cost") }),
    } satisfies FplLeagueMember;
  });
  return { meta, members, hasNext: standings.has_next === true };
}

async function fetchJson(path: string, options: Required<Pick<FetchFantasyFplOptions, "fetchImpl" | "baseUrl" | "timeoutMs">>): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await options.fetchImpl(`${options.baseUrl}/api/${path}`, {
      headers: { accept: "application/json", "user-agent": "fpl-chei-chei-fantasy" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new FantasyFplError(`FANTASY_FPL_HTTP_${response.status}`, "FPL source request failed");
    try {
      return await response.json();
    } catch {
      throw new FantasyFplError("FANTASY_FPL_INVALID_JSON", "FPL source response is invalid");
    }
  } catch (error) {
    if (error instanceof FantasyFplError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new FantasyFplError("FANTASY_FPL_TIMEOUT", "FPL source request timed out");
    throw new FantasyFplError("FANTASY_FPL_UNAVAILABLE", "FPL source is unavailable");
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeHistory(value: unknown): FplEntryHistoryEvent[] {
  const root = objectValue(value, "history");
  return arrayValue(root.current, "entry history").map((item) => {
    const row = objectValue(item, "entry history row");
    return {
      event: numberValue(row.event, "event"),
      points: numberValue(row.points, "points"),
      event_transfers: numberValue(row.event_transfers, "event_transfers"),
      event_transfers_cost: numberValue(row.event_transfers_cost, "event_transfers_cost"),
      points_on_bench: numberValue(row.points_on_bench, "points_on_bench"),
    };
  });
}

function normalizeEventLive(value: unknown): FplEventLivePlayer[] {
  const root = objectValue(value, "event live");
  return arrayValue(root.elements, "event live elements").map((item) => {
    const row = objectValue(item, "event live player");
    const stats = objectValue(row.stats, "event live stats");
    return {
      playerId: numberValue(row.id, "event live player id"),
      points: numberValue(stats.total_points, "event live total points"),
    } satisfies FplEventLivePlayer;
  });
}

function normalizeDreamTeam(value: unknown): FplDreamTeamSnapshot {
  const root = objectValue(value, "dream team");
  const topPlayer = root.top_player == null ? null : objectValue(root.top_player, "dream team top player");
  return {
    topPlayerId: topPlayer == null ? null : numberValue(topPlayer.id, "dream team top player id"),
    topPoints: topPlayer == null ? null : numberValue(topPlayer.points, "dream team top player points"),
    players: arrayValue(root.team, "dream team players").map((item) => {
      const row = objectValue(item, "dream team player");
      return {
        playerId: numberValue(row.element, "dream team player id"),
        points: numberValue(row.points, "dream team points"),
        position: numberValue(row.position, "dream team position"),
      };
    }),
  } satisfies FplDreamTeamSnapshot;
}

function normalizeEntryPicks(value: unknown, bootstrap: FplBootstrapSnapshot, gameweekNumber: number, eventPointsByPlayer = new Map<number, number>()): FplEntryCurrentSquad {
  const root = objectValue(value, "entry picks");
  const playersById = new Map(bootstrap.players.map((player) => [player.playerId, player]));
  const picks = arrayValue(root.picks, "entry picks").map((item, index) => {
    const row = objectValue(item, "entry pick");
    const playerId = numberValue(row.element, "pick player id");
    const player = playersById.get(playerId);
    if (!player) throw new FantasyFplError("FANTASY_FPL_INVALID_DATA", "Entry pick player is missing from bootstrap");
    const multiplier = numberValue(row.multiplier ?? 0, "pick multiplier");
    const isStartingPick = numberValue(row.position ?? index + 1, "pick position") <= 11;
    const wasCaptain = row.is_captain === true;
    const wasViceCaptain = row.is_vice_captain === true;
    return {
      pickPosition: numberValue(row.position ?? index + 1, "pick position"),
      playerId,
      playerName: player.name,
      position: player.position,
      clubName: player.clubName,
      clubShortName: player.clubShortName,
      multiplier,
      isCaptain: isStartingPick && multiplier > 1,
      isViceCaptain: wasViceCaptain && !(isStartingPick && multiplier > 1),
      wasCaptain,
      wasViceCaptain,
      photoUrl: player.photoKey ? buildFplPlayerPhotoUrl(player.photoKey) : undefined,
      points: eventPointsByPlayer.get(playerId) ?? player.eventPoints ?? null,
    } satisfies FantasySquadPlayer;
  });
  return normalizeEntryCurrentSquad({ gameweekNumber, picks });
}

function positionFor(value: unknown): FplPlayerSnapshot["position"] {
  if (value === "GKP") return "GK";
  if (value === "DEF" || value === "MID" || value === "FWD") return value;
  throw new FantasyFplError("FANTASY_FPL_INVALID_DATA", "Invalid FPL player position");
}

function normalizeBootstrap(value: unknown): FplBootstrapSnapshot {
  const root = objectValue(value, "bootstrap");
  const teams = new Map(arrayValue(root.teams, "teams").map((item) => {
    const team = objectValue(item, "team");
    return [numberValue(team.id, "team id"), { name: String(team.name ?? ""), shortName: String(team.short_name ?? "").trim() || undefined }] as const;
  }));
  const positions = new Map(arrayValue(root.element_types, "element types").map((item) => {
    const position = objectValue(item, "element type");
    return [numberValue(position.id, "element type id"), position.singular_name_short] as const;
  }));
  const events = arrayValue(root.events, "events").map((item) => objectValue(item, "event"));
  const gameweeks = events.map((event) => {
    const topInfo = event.top_element_info == null ? null : objectValue(event.top_element_info, "top element info");
    return {
      number: numberValue(event.id, "event id"),
      isCurrent: event.is_current === true,
      finished: event.finished === true,
      topPlayerId: nullableNumberValue(event.top_element, "top element"),
      topPoints: topInfo == null ? null : nullableNumberValue(topInfo.points, "top element points"),
    } satisfies FplBootstrapSnapshot["gameweeks"][number];
  });
  const current = events.find((event) => event.is_current === true);
  const finished = events.filter((event) => event.finished === true).map((event) => numberValue(event.id, "event id"));
  const latestFinishedGameweek = finished.length ? Math.max(...finished) : null;
  const next = events.find((event) => event.is_next === true);
  const currentGameweek = current
    ? numberValue(current.id, "current event id")
    : latestFinishedGameweek ?? (next ? numberValue(next.id, "next event id") : null);
  if (currentGameweek === null) throw new FantasyFplError("FANTASY_FPL_NO_GAMEWEEK", "FPL has no current or finished gameweek");

  const players = arrayValue(root.elements, "players").map((item) => {
    const player = objectValue(item, "player");
    const playerId = numberValue(player.id, "player id");
    const clubId = numberValue(player.team, "player team");
    const positionId = numberValue(player.element_type, "player position");
    const position = positionFor(positions.get(positionId));
    const club = teams.get(clubId);
    if (!club?.name) throw new FantasyFplError("FANTASY_FPL_INVALID_DATA", `Unknown FPL club for player ${playerId}`);
    return {
      playerId,
      photoKey: photoKeyFromFplPhoto(player.photo),
      name: String(player.web_name ?? `${player.first_name ?? ""} ${player.second_name ?? ""}`).trim(),
      position,
      clubId,
      clubName: club.name,
      clubShortName: club.shortName,
      status: String(player.status ?? ""),
      selectedByPercent: numberValue(player.selected_by_percent, "selected_by_percent"),
      transfersInEvent: numberValue(player.transfers_in_event, "transfers_in_event"),
      transfersOutEvent: numberValue(player.transfers_out_event, "transfers_out_event"),
      form: numberValue(player.form, "form"),
      defensiveContribution: numberValue(player.defensive_contribution ?? 0, "defensive_contribution"),
      bps: numberValue(player.bps ?? 0, "bps"),
      pointsPerGame: numberValue(player.points_per_game ?? 0, "points_per_game"),
      expectedGoalInvolvementsPer90: numberValue(player.expected_goal_involvements_per_90 ?? 0, "expected_goal_involvements_per_90"),
      eventPoints: numberValue(player.event_points, "event_points"),
    } satisfies FplPlayerSnapshot;
  });
  const selectedEvent = current ?? events.find((event) => numberValue(event.id, "event id") === currentGameweek);
  return {
    currentGameweek,
    latestFinishedGameweek,
    gameweeks,
    players,
    mostCaptainedPlayerId: selectedEvent?.most_captained == null ? null : numberValue(selectedEvent.most_captained, "most_captained"),
    mostViceCaptainedPlayerId: selectedEvent?.most_vice_captained == null ? null : numberValue(selectedEvent.most_vice_captained, "most_vice_captained"),
  };
}

export function createFantasyFplProvider(input: FetchFantasyFplOptions = {}): FantasyFplProviderWithPicks {
  const options = {
    fetchImpl: input.fetchImpl ?? fetch,
    baseUrl: (input.baseUrl ?? getServerEnv().fplApiBaseUrl).replace(/\/$/, ""),
    timeoutMs: input.timeoutMs ?? 10_000,
  };
  async function getLeagueStandingsPage(leagueId: number, page: number): Promise<{ meta: FplLeagueSummary; members: FplLeagueMember[]; hasNext: boolean }> {
    const query = page === 1
      ? "?page_standings=1&page_new_entries=1"
      : `?page_standings=1&page_new_entries=1&page=${page}`;
    return leagueMembersPage(await fetchJson(`leagues-classic/${leagueId}/standings/${query}`, options));
  }

  return {
    async getEntrySummary(entryId) {
      const root = objectValue(await fetchJson(`entry/${entryId}/`, options), "entry summary");
      return {
        entryId: numberValue(root.id ?? entryId, "entry id"),
        teamName: String(root.name ?? ""),
        managerName: `${String(root.player_first_name ?? "")} ${String(root.player_last_name ?? "")}`.trim(),
      } satisfies FplEntrySummary;
    },
    async getEntryHistory(entryId) {
      return normalizeHistory(await fetchJson(`entry/${entryId}/history/`, options));
    },
    async getEntryPicks(entryId, gameweekNumber) {
      const [picks, bootstrap, live] = await Promise.all([
        fetchJson(`entry/${entryId}/event/${gameweekNumber}/picks/`, options),
        fetchJson("bootstrap-static/", options),
        fetchJson(`event/${gameweekNumber}/live/`, options),
      ]);
      const normalizedBootstrap = normalizeBootstrap(bootstrap);
      const eventPointsByPlayer = new Map(normalizeEventLive(live).map((player) => [player.playerId, player.points]));
      return normalizeEntryPicks(picks, normalizedBootstrap, gameweekNumber, eventPointsByPlayer);
    },
    async getBootstrap() {
      return normalizeBootstrap(await fetchJson("bootstrap-static/", options));
    },
    async getEventLive(gameweekNumber) {
      return normalizeEventLive(await fetchJson(`event/${gameweekNumber}/live/`, options));
    },
    async getDreamTeam(gameweekNumber) {
      return normalizeDreamTeam(await fetchJson(`dream-team/${gameweekNumber}/`, options));
    },
    async getLeague(leagueId) {
      const page = await getLeagueStandingsPage(leagueId, 1);
      if (page.meta.leagueId !== leagueId) throw new FantasyFplError("FANTASY_FPL_INVALID_DATA", "FPL league ID does not match request");
      return page.meta;
    },
    async getLeagueMembers(leagueId) {
      const members: FplLeagueMember[] = [];
      let pageNumber = 1;
      let page = await getLeagueStandingsPage(leagueId, pageNumber);
      if (page.meta.leagueId !== leagueId) throw new FantasyFplError("FANTASY_FPL_INVALID_DATA", "FPL league ID does not match request");
      members.push(...page.members);
      while (page.hasNext) {
        pageNumber += 1;
        page = await getLeagueStandingsPage(leagueId, pageNumber);
        if (page.meta.leagueId !== leagueId) throw new FantasyFplError("FANTASY_FPL_INVALID_DATA", "FPL league ID does not match request");
        members.push(...page.members);
      }
      return members;
    },
  };
}
