import { formatShareErrorMessage, shareFlexMessage, type ShareTargetPickerApi } from "../line/share.ts";
import {
  buildFantasyLeaderboardShareFlex,
  buildFantasyPlayerStatsShareFlex,
  buildFantasySquadShareFlex,
} from "./fantasy-share-payload.ts";

export type FantasyShareStatus = {
  state: "shared" | "cancelled" | "error";
  message?: string;
};

type FantasyShareInput = Parameters<typeof buildFantasyLeaderboardShareFlex>[0] | Parameters<typeof buildFantasyPlayerStatsShareFlex>[0] | Parameters<typeof buildFantasySquadShareFlex>[0];

async function shareFantasyMessage(api: ShareTargetPickerApi, message: Parameters<typeof shareFlexMessage>[1]): Promise<FantasyShareStatus> {
  try {
    const result = await shareFlexMessage(api, message);
    return result === "shared"
      ? { state: "shared", message: "แชร์เข้า LINE แล้ว" }
      : { state: "cancelled", message: "ยกเลิกการแชร์แล้ว ยังไม่ได้ส่งข้อความเข้า LINE" };
  } catch (error) {
    return { state: "error", message: formatShareErrorMessage(error) };
  }
}

export function shareFantasyLeaderboard(api: ShareTargetPickerApi, input: Parameters<typeof buildFantasyLeaderboardShareFlex>[0]): Promise<FantasyShareStatus> {
  return shareFantasyMessage(api, buildFantasyLeaderboardShareFlex(input));
}

export function shareFantasyPlayerStats(api: ShareTargetPickerApi, input: Parameters<typeof buildFantasyPlayerStatsShareFlex>[0]): Promise<FantasyShareStatus> {
  return shareFantasyMessage(api, buildFantasyPlayerStatsShareFlex(input));
}

export function shareFantasySquad(api: ShareTargetPickerApi, input: Parameters<typeof buildFantasySquadShareFlex>[0]): Promise<FantasyShareStatus> {
  return shareFantasyMessage(api, buildFantasySquadShareFlex(input));
}

export type { FantasyShareInput };
