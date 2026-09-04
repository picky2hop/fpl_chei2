import { getPredictionResult, normalizePredictionPercentage } from "../predictions.ts";

export type PredictionChoice = "home" | "draw" | "away";

export type FlexTeam = {
  name: string;
  logoUrl?: string;
};

export type PredictionFlexInput = {
  displayName: string;
  avatarUrl?: string;
  gameweek: number;
  currentPoints?: number;
  fixtures: Array<{
    homeTeam: FlexTeam;
    awayTeam: FlexTeam;
    choice: PredictionChoice;
    kickoffAt?: string;
    dateLabel?: string;
    status?: "upcoming" | "live" | "finished" | "postponed";
    homeScore?: number | null;
    awayScore?: number | null;
  }>;
};

export type FixturePredictionFlexInput = {
  gameweek: number;
  dateLabel: string;
  kickoffAt?: string;
  status: "upcoming" | "live" | "finished" | "postponed";
  homeScore?: number | null;
  awayScore?: number | null;
  homeTeam: FlexTeam;
  awayTeam: FlexTeam;
  predictionPercentages: Record<PredictionChoice, number>;
  predictors: Array<{
    name: string;
    avatarUrl?: string;
    choice: PredictionChoice;
  }>;
};

export type StandingsFlexInput = {
  period: "gameweek" | "season";
  gameweek?: number;
  updatedAtLabel?: string;
  rows: Array<{
    rank: number;
    displayName: string;
    avatarUrl?: string;
    points: number;
  }>;
};

export type TodayFixturesFlexInput = {
  dateLabel: string;
  fixtures: Array<{
    dayLabel?: string;
    kickoffLabel: string;
    scoreLabel?: string;
    statusLabel: string;
    homeTeam: FlexTeam;
    awayTeam: FlexTeam;
  }>;
};

export type PredictionAwardsFlexInput = {
  gameweek: number;
  champions: Array<{ displayName: string; avatarUrl?: string; points: number }>;
  woodenSpoons: Array<{ displayName: string; avatarUrl?: string; points: number }>;
};

export type FantasyAwardsFlexInput = {
  leagueFplId: number;
  leagueName: string;
  gameweek: number;
  champions: Array<{ entryId: number; displayName: string; managerName: string; teamName: string; avatarUrl?: string; points: number }>;
  woodenSpoons: Array<{ entryId: number; displayName: string; managerName: string; teamName: string; avatarUrl?: string; points: number }>;
};

export type FlexMessage = {
  type: "flex";
  altText: string;
  contents: Record<string, unknown>;
};

const MAIN_BACKGROUND = "#071525";
const CARD_BACKGROUND = "#10253A";
const ACCENT = "#D9FF58";
const PRIMARY_TEXT = "#FFFFFF";
const MUTED_TEXT = "#8CA6BD";
const APP_URI = "https://liff.line.me/2010604800-Y9eFejTF";
const PREDICTION_APP_URI = `${APP_URI}/dashboard?tab=predictions`;
const PREDICTION_APP_BUTTON_LABEL = "กดเพื่อเข้าไป ทายผล";
const MENU_APP_BUTTON_LABEL = "เข้า App แฟนตาซี + ทายผลบอล";
const BANGKOK_TIME_ZONE = "Asia/Bangkok";
const PREMIER_LEAGUE_BADGE = /^https:\/\/resources\.premierleague\.com\/premierleague25\/badges-alt\/(\d+)\.svg$/i;

const choiceLabels: Record<PredictionChoice, string> = {
  home: "เหย้า",
  draw: "เสมอ",
  away: "เยือน",
};

function lineImageUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed?.startsWith("https://")) return undefined;
  const badge = trimmed.match(PREMIER_LEAGUE_BADGE);
  if (badge) return `https://resources.premierleague.com/premierleague25/badges/${badge[1]}.png`;
  if (/\.svg(?:$|\?)/i.test(trimmed)) return undefined;
  return trimmed;
}

function text(value: string, size = "sm", weight = "regular", color = PRIMARY_TEXT) {
  return { type: "text", text: value, size, weight, color, wrap: true };
}

function imageOrFallback(url: string | undefined, fallback: string, size = "40px") {
  const imageUrl = lineImageUrl(url);
  return imageUrl
    ? {
        type: "box",
        layout: "vertical",
        width: size,
        height: size,
        cornerRadius: "xxl",
        backgroundColor: "#29435D",
        justifyContent: "center",
        alignItems: "center",
        contents: [{ type: "image", url: imageUrl, size: "full", aspectMode: "cover", aspectRatio: "1:1", flex: 0 }],
      }
    : {
        type: "box",
        layout: "vertical",
        width: size,
        height: size,
        cornerRadius: "xxl",
        backgroundColor: "#29435D",
        justifyContent: "center",
        alignItems: "center",
        contents: [text(fallback.slice(0, 2), "xs", "bold")],
      };
}

function teamLogoOrFallback(url: string | undefined, fallback: string, size = "40px") {
  const imageUrl = lineImageUrl(url);
  if (!imageUrl) return imageOrFallback(undefined, fallback, size);
  return {
    type: "image",
    url: imageUrl,
    size,
    aspectMode: "fit",
    aspectRatio: "1:1",
    flex: 0,
  };
}

function teamSide(team: FlexTeam, side: "home" | "away", highlighted = false, centered = false, result?: "correct" | "incorrect") {
  const name = {
    ...text(team.name, "xs", "bold", highlighted ? "#d9ff58" : PRIMARY_TEXT),
    ...(centered ? { align: "center" } : {}),
  };
  const resultLabel = result
    ? { ...text(result === "correct" ? "ทายถูก" : "ทายผิด", "xxs", "bold", result === "correct" ? "#D9FF58" : "#FF647C"), align: centered ? "center" : side === "home" ? "end" : "start" }
    : null;
  const nameContent = resultLabel
    ? { type: "box", layout: "vertical", flex: 1, alignItems: centered ? "center" : side === "home" ? "flex-end" : "flex-start", contents: [name, resultLabel] }
    : name;
  const logo = teamLogoOrFallback(team.logoUrl, team.name, "36px");
  return {
    type: "box",
    layout: "horizontal",
    flex: 1,
    spacing: "sm",
    paddingAll: centered ? "8px" : highlighted ? "8px" : "none",
    cornerRadius: "md",
    backgroundColor: highlighted ? "#d9ff5815" : centered ? MAIN_BACKGROUND : CARD_BACKGROUND,
    justifyContent: centered ? "center" : side === "home" ? "flex-end" : "flex-start",
    alignItems: "center",
    contents: side === "home" ? [nameContent, logo] : [logo, nameContent],
  };
}

function footerButton(uri = PREDICTION_APP_URI, label = PREDICTION_APP_BUTTON_LABEL, textSize = "xxl") {
  return {
    type: "box",
    layout: "horizontal",
    height: "56px",
    cornerRadius: "xl",
    backgroundColor: ACCENT,
    justifyContent: "center",
    alignItems: "center",
    action: { type: "uri", label, uri },
    contents: [{ ...text(label, textSize, "bold", "#071525"), align: "center" }],
  };
}

export type CommandMenuItem = string | { label: string; text: string };
export type CommandMenuSection = { title?: string; rows: CommandMenuItem[][] };

function commandMenuButton(command: CommandMenuItem) {
    const item = typeof command === "string" ? { label: command, text: command } : command;
    return {
      type: "box",
      layout: "horizontal",
      height: "48px",
      flex: 1,
      cornerRadius: "xl",
      backgroundColor: "#E53935",
      justifyContent: "center",
      alignItems: "center",
      action: { type: "message", label: item.label, text: item.text },
      contents: [{ ...text(item.label, "sm", "bold", "#FFFFFF"), align: "center" }],
    };
}

function commandMenuSection(section: CommandMenuSection) {
  return [
    ...(section.title ? [text(section.title, "sm", "bold", ACCENT)] : []),
    ...section.rows.map((row) => ({
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      contents: row.map(commandMenuButton),
    })),
  ];
}

export function buildCommandMenuFlex(sections: CommandMenuSection[]): FlexMessage {
  const contents = sections.flatMap(commandMenuSection);

  return {
    type: "flex",
    altText: "เมนูคำสั่ง เกมทายผลพรีเมียร์ลีก",
    contents: bubble([
      header("เมนูคำสั่ง", "เลือกคำสั่งที่ต้องการ"),
      ...contents,
    ], APP_URI, MENU_APP_BUTTON_LABEL, "xl"),
  };
}

function bubble(contents: Record<string, unknown>[], footerUri = PREDICTION_APP_URI, footerLabel = PREDICTION_APP_BUTTON_LABEL, footerTextSize = "xxl") {
  return {
    type: "bubble",
    size: "giga",
    styles: {
      body: { backgroundColor: MAIN_BACKGROUND },
      footer: { backgroundColor: MAIN_BACKGROUND },
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents,
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [footerButton(footerUri, footerLabel, footerTextSize)],
    },
  };
}

function awardsBubble(contents: Record<string, unknown>[]) {
  return {
    type: "bubble",
    size: "giga",
    styles: {
      body: { backgroundColor: MAIN_BACKGROUND },
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents,
    },
  };
}

function container(bubbles: Record<string, unknown>[]) {
  return bubbles.length === 1 ? bubbles[0] : { type: "carousel", contents: bubbles };
}

function header(title: string, subtitle?: string) {
  return {
    type: "box",
    layout: "vertical",
    paddingAll: "16px",
    cornerRadius: "lg",
    backgroundColor: CARD_BACKGROUND,
    contents: [
      text(title, "xl", "bold"),
      ...(subtitle ? [text(subtitle, "sm", "regular", MUTED_TEXT)] : []),
    ],
  };
}

function chunks<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [[]];
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function formatBangkokDateTime(value: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: BANGKOK_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

const choiceColors: Record<PredictionChoice, { background: string; text: string }> = {
  home: { background: "#ff647c", text: "#FFFFFF" },
  draw: { background: "#47d7a0", text: "#071525" },
  away: { background: "#6da9ff", text: "#071525" },
};

export function formatPredictionDateLabel(kickoffAt?: string, fallback = "วันที่แข่งขัน"): string {
  if (!kickoffAt) return fallback;
  const date = new Date(kickoffAt);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: BANGKOK_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatPredictionTimeLabel(kickoffAt?: string, fallback = "เวลาไม่ระบุ"): string {
  if (!kickoffAt) return fallback;
  const date = new Date(kickoffAt);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: BANGKOK_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function predictionChoicePill(choice: PredictionChoice) {
  const colors = choiceColors[choice];
  return {
    type: "box",
    layout: "vertical",
    width: "48px",
    height: "32px",
    flex: 0,
    cornerRadius: "xxl",
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    contents: [{ ...text(choiceLabels[choice], "xxs", "bold", colors.text), align: "center" }],
  };
}

function predictionPercentageBar(choice: PredictionChoice, percentage: number) {
  const colors = choiceColors[choice];
  const width = `${normalizePredictionPercentage(percentage)}%`;
  return {
    type: "box",
    layout: "horizontal",
    height: "6px",
    cornerRadius: "sm",
    backgroundColor: "#FFFFFF1A",
    contents: [{
      type: "box",
      layout: "vertical",
      width,
      height: "6px",
      flex: 0,
      cornerRadius: "sm",
      backgroundColor: colors.background,
      contents: [],
    }],
  };
}

function predictionFixture(fixture: PredictionFlexInput["fixtures"][number]) {
  const hasScore = typeof fixture.homeScore === "number" && typeof fixture.awayScore === "number";
  const result = getPredictionResult(fixture, fixture.choice);
  const scoreLabel = hasScore ? `${fixture.homeScore}-${fixture.awayScore}` : "VS";
  const statusLabel = fixture.status === "finished"
    ? "จบแล้ว"
    : fixture.status === "live"
      ? "Live"
      : fixture.status === "postponed"
        ? "เลื่อนแข่ง"
        : undefined;
  const statusColor = fixture.status === "live" ? "#FF647C" : MUTED_TEXT;
  return {
    type: "box",
    layout: "horizontal",
    spacing: "xs",
    paddingAll: "4px",
    backgroundColor: MAIN_BACKGROUND,
    alignItems: "center",
    contents: [
      teamSide(fixture.homeTeam, "home", fixture.choice === "home", true, fixture.choice === "home" && result.status !== "pending" ? result.status : undefined),
      {
        type: "box",
        layout: "vertical",
         width: "32px",
        flex: 0,
        justifyContent: "center",
        alignItems: "center",
         contents: [
           { ...text(scoreLabel, "xs", "bold", hasScore ? PRIMARY_TEXT : MUTED_TEXT), align: "center", wrap: false },
           ...(statusLabel ? [{ ...text(statusLabel, "xxs", "regular", statusColor), align: "center" }] : []),
           ...(fixture.choice === "draw" && result.status !== "pending" ? [{ ...text(result.status === "correct" ? "ทายถูก" : "ทายผิด", "xxs", "bold", result.status === "correct" ? "#D9FF58" : "#FF647C"), align: "center" }] : []),
         ],
      },
      teamSide(fixture.awayTeam, "away", fixture.choice === "away", true, fixture.choice === "away" && result.status !== "pending" ? result.status : undefined),
      predictionChoicePill(fixture.choice),
    ],
  };
}

function fixtureTeam(team: FlexTeam) {
  return {
    type: "box",
    layout: "vertical",
    flex: 1,
    spacing: "xs",
    alignItems: "center",
    contents: [
      teamLogoOrFallback(team.logoUrl, team.name, "40px"),
      { ...text(team.name, "xs", "bold"), align: "center" },
    ],
  };
}

function fixtureMatchHeader(input: FixturePredictionFlexInput) {
  const scoreLabel = typeof input.homeScore === "number" && typeof input.awayScore === "number"
    ? input.homeScore + "-" + input.awayScore
    : input.status === "postponed"
      ? "เลื่อนแข่ง"
      : input.status === "live"
        ? "LIVE"
        : "VS";
  const dateLabel = formatPredictionDateLabel(input.kickoffAt, input.dateLabel);
  const timeLabel = formatPredictionTimeLabel(input.kickoffAt);
  const statusLabel = input.status === "finished"
    ? "จบแล้ว"
    : input.status === "live"
      ? "Live"
      : input.status === "postponed"
        ? "เลื่อนแข่ง"
        : undefined;
  const statusColor = input.status === "live" ? "#FF647C" : MUTED_TEXT;

  return {
    type: "box",
    layout: "vertical",
    spacing: "xs",
    paddingAll: "12px",
    cornerRadius: "lg",
    backgroundColor: CARD_BACKGROUND,
    contents: [
      {
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        alignItems: "center",
        contents: [
          fixtureTeam(input.homeTeam),
          {
            type: "box",
            layout: "vertical",
            width: "44px",
            flex: 0,
            justifyContent: "center",
            alignItems: "center",
             contents: [
               { ...text(scoreLabel, "md", "bold"), align: "center", wrap: false },
               ...(statusLabel ? [{ ...text(statusLabel, "xxs", "regular", statusColor), align: "center" }] : []),
             ],
          },
          fixtureTeam(input.awayTeam),
        ],
      },
      { ...text(dateLabel + " · " + timeLabel, "xs", "regular", MUTED_TEXT), align: "center" },
    ],
  };
}

function fixturePredictorRow(predictor: FixturePredictionFlexInput["predictors"][number]) {
  return {
    type: "box",
    layout: "horizontal",
    spacing: "sm",
    paddingAll: "8px",
    cornerRadius: "md",
    backgroundColor: CARD_BACKGROUND,
    alignItems: "center",
    contents: [
      imageOrFallback(predictor.avatarUrl, predictor.name, "40px"),
      {
        type: "box",
        layout: "vertical",
        flex: 1,
        contents: [{ ...text(predictor.name, "sm", "bold"), maxLines: 2 }],
      },
      predictionChoicePill(predictor.choice),
    ],
  };
}

function fixturePredictionGroup(
  choice: PredictionChoice,
  percentage: number,
  predictors: FixturePredictionFlexInput["predictors"],
) {
  const rows = predictors.map(fixturePredictorRow);
  const rowGroups = rows.length
    ? chunks(rows, 10).map((group) => ({
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: group,
      }))
    : [{ ...text("ยังไม่มีคนเลือกฝั่งนี้", "xs", "regular", MUTED_TEXT) }];

  return {
    type: "box",
    layout: "vertical",
    spacing: "sm",
    contents: [
      {
        type: "box",
        layout: "horizontal",
        justifyContent: "space-between",
        alignItems: "center",
        contents: [
          predictionChoicePill(choice),
           { ...text(percentage + "%", "sm", "bold", MUTED_TEXT), align: "end" },
        ],
      },
      predictionPercentageBar(choice, percentage),
      ...rowGroups,
    ],
  };
}

function predictionDateGroups(fixtures: PredictionFlexInput["fixtures"]) {
  type TimeGroup = {
    label: string;
    firstIndex: number;
    sortTime: number;
    fixtures: PredictionFlexInput["fixtures"];
  };
  type DateGroup = {
    label: string;
    firstIndex: number;
    sortTime: number;
    times: Map<string, TimeGroup>;
  };

  const groups = new Map<string, DateGroup>();
  fixtures.forEach((fixture, index) => {
    const timestamp = fixture.kickoffAt ? new Date(fixture.kickoffAt).getTime() : Number.NaN;
    const sortTime = Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
    const dateLabel = formatPredictionDateLabel(fixture.kickoffAt, fixture.dateLabel);
    const timeLabel = formatPredictionTimeLabel(fixture.kickoffAt);
    const dateKey = Number.isNaN(timestamp) ? `fallback:${dateLabel}` : dateLabel;
    const timeKey = Number.isNaN(timestamp) ? `fallback:${timeLabel}` : timeLabel;
    const dateGroup = groups.get(dateKey) ?? { label: dateLabel, firstIndex: index, sortTime, times: new Map() };
    const timeGroup = dateGroup.times.get(timeKey) ?? { label: timeLabel, firstIndex: index, sortTime, fixtures: [] };
    timeGroup.fixtures.push(fixture);
    dateGroup.times.set(timeKey, timeGroup);
    groups.set(dateKey, dateGroup);
  });

  const sortGroups = <T extends { sortTime: number; firstIndex: number }>(items: T[]) => items.sort((left, right) => left.sortTime - right.sortTime || left.firstIndex - right.firstIndex);
  return sortGroups([...groups.values()]).map((group) => ({
    type: "box",
    layout: "vertical",
    spacing: "xs",
    contents: [
      text(`${group.label} — ${[...group.times.values()].reduce((count, timeGroup) => count + timeGroup.fixtures.length, 0)} คู่`, "sm", "bold", ACCENT),
      ...sortGroups([...group.times.values()]).map((timeGroup) => ({
        type: "box",
        layout: "vertical",
        spacing: "xs",
        contents: [
          text(`${timeGroup.label} · ${timeGroup.fixtures.length} คู่`, "xs", "bold", ACCENT),
          ...timeGroup.fixtures.map(predictionFixture),
        ],
      })),
    ],
  }));
}

export function buildPredictionResultFlex(input: PredictionFlexInput): FlexMessage {
  const currentPoints = input.currentPoints ?? input.fixtures.reduce((total, fixture) => total + getPredictionResult(fixture, fixture.choice).points, 0);
  const profile = {
    type: "box",
    layout: "horizontal",
    spacing: "md",
    paddingAll: "12px",
    cornerRadius: "lg",
    backgroundColor: CARD_BACKGROUND,
    alignItems: "center",
    contents: [
      imageOrFallback(input.avatarUrl, input.displayName, "48px"),
      {
        type: "box",
        layout: "vertical",
        flex: 1,
        contents: [text(input.displayName, "md", "bold"), text(`คำทายของ GW ${input.gameweek}`, "xs", "regular", MUTED_TEXT)],
      },
      {
        type: "box",
        layout: "vertical",
        alignItems: "flex-end",
        contents: [text("คะแนนปัจจุบัน", "xxs", "regular", MUTED_TEXT), { ...text(`${currentPoints} คะแนน`, "md", "bold", ACCENT), align: "end" }],
      },
    ],
  };
  return {
    type: "flex",
    altText: `FPL Chei Chei · คำทาย GW${input.gameweek} ของ ${input.displayName}`,
    contents: bubble([
      profile,
      ...(input.fixtures.length ? predictionDateGroups(input.fixtures) : [text("ยังไม่มีคำทาย", "sm", "regular", MUTED_TEXT)]),
    ]),
  };
}

export function buildFixturePredictionFlex(input: FixturePredictionFlexInput): FlexMessage {
  const grouped = {
    home: input.predictors.filter((predictor) => predictor.choice === "home"),
    draw: input.predictors.filter((predictor) => predictor.choice === "draw"),
    away: input.predictors.filter((predictor) => predictor.choice === "away"),
  };

  return {
    type: "flex",
    altText: "FPL Chei Chei · ผลคำทาย GW" + input.gameweek + " · " + input.homeTeam.name + " vs " + input.awayTeam.name,
    contents: bubble([
      fixtureMatchHeader(input),
      fixturePredictionGroup("home", input.predictionPercentages.home, grouped.home),
      fixturePredictionGroup("draw", input.predictionPercentages.draw, grouped.draw),
      fixturePredictionGroup("away", input.predictionPercentages.away, grouped.away),
    ]),
  };
}

const MAX_FLEX_BUBBLE_BYTES = 30 * 1024;

export function validateFlexMessage(message: FlexMessage): void {
  if (message.type !== "flex" || typeof message.altText !== "string" || !message.contents || typeof message.contents !== "object") {
    throw new Error("FLEX_MESSAGE_INVALID");
  }

  const serialized = JSON.stringify(message);
  if (new TextEncoder().encode(serialized).byteLength > MAX_FLEX_BUBBLE_BYTES) {
    throw new Error("FLEX_MESSAGE_TOO_LARGE");
  }

  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    const component = value as Record<string, unknown>;
    if (component.type === "text" && ("width" in component || "height" in component)) {
      throw new Error("FLEX_MESSAGE_INVALID");
    }
    if (component.type === "image") {
      const url = typeof component.url === "string" ? component.url : "";
      if (!url.startsWith("https://") || /\.svg(?:$|\?)/i.test(url)) throw new Error("FLEX_MESSAGE_INVALID");
      if (component.aspectMode !== undefined && component.aspectMode !== "fit" && component.aspectMode !== "cover") {
        throw new Error("FLEX_MESSAGE_INVALID");
      }
    }
    if ((component.type === "box" || component.type === "carousel") && Array.isArray(component.contents) && component.contents.length > 12) {
      throw new Error("FLEX_MESSAGE_INVALID");
    }
    Object.values(component).forEach(visit);
  };

  visit(message.contents);
}

function standingsRow(row: StandingsFlexInput["rows"][number]) {
  return {
    type: "box",
    layout: "horizontal",
    spacing: "xs",
    paddingAll: "9px",
    cornerRadius: "md",
    backgroundColor: row.rank === 1 ? "#233A2D" : CARD_BACKGROUND,
    alignItems: "center",
    contents: [
      { ...text(String(row.rank), "sm", "bold", row.rank === 1 ? ACCENT : MUTED_TEXT), flex: 0 },
      { type: "box", layout: "vertical", width: "12px", height: "1px", flex: 0, contents: [{ type: "filler" }] },
      { ...imageOrFallback(row.avatarUrl, row.displayName, "34px"), flex: 0 },
      { type: "box", layout: "vertical", width: "12px", height: "1px", flex: 0, contents: [{ type: "filler" }] },
      { ...text(row.displayName, "sm", "bold"), flex: 1 },
      { ...text(`${row.points} คะแนน`, "sm", "bold", row.rank === 1 ? ACCENT : PRIMARY_TEXT), flex: 0 },
    ],
  };
}

function awardRecipientRow(recipient: PredictionAwardsFlexInput["champions"][number]) {
  return {
    type: "box",
    layout: "horizontal",
    spacing: "sm",
    paddingAll: "9px",
    cornerRadius: "md",
    backgroundColor: CARD_BACKGROUND,
    alignItems: "center",
    contents: [
      { ...imageOrFallback(recipient.avatarUrl, recipient.displayName, "38px"), flex: 0 },
      { ...text(recipient.displayName, "sm", "bold"), flex: 1 },
      { ...text(`${recipient.points} คะแนน`, "sm", "bold", ACCENT), flex: 0 },
    ],
  };
}

function awardSection(
  title: string,
  recipients: PredictionAwardsFlexInput["champions"],
) {
  return {
    type: "box",
    layout: "vertical",
    spacing: "xs",
    contents: [
      text(title, "md", "bold", ACCENT),
      ...(recipients.length ? recipients.map(awardRecipientRow) : [text("ไม่มีข้อมูล", "sm", "regular", MUTED_TEXT)]),
    ],
  };
}

export function buildPredictionAwardsFlex(input: PredictionAwardsFlexInput): FlexMessage {
  const title = `แชมป์บ๊วยทายผล · GW ${input.gameweek}`;
  return {
    type: "flex",
    altText: `เกมทายผลพรีเมียร์ลีก · ${title}`,
    contents: awardsBubble([
      text("เกมทายผลพรีเมียร์ลีก", "lg", "bold", ACCENT),
      text(`ผลตัดสิน GW ${input.gameweek}`, "sm", "bold"),
      awardSection("🏆 แชมป์", input.champions),
      awardSection("🥄 บ๊วย", input.woodenSpoons),
    ]),
  };
}

function fantasyAwardRecipientRow(recipient: FantasyAwardsFlexInput["champions"][number]) {
  return {
    type: "box",
    layout: "horizontal",
    spacing: "sm",
    paddingAll: "9px",
    cornerRadius: "md",
    backgroundColor: CARD_BACKGROUND,
    alignItems: "center",
    contents: [
      { ...imageOrFallback(recipient.avatarUrl, recipient.displayName, "38px"), flex: 0 },
      {
        type: "box",
        layout: "vertical",
        spacing: "2px",
        flex: 1,
        contents: [
          text(recipient.displayName, "sm", "bold"),
          text(`ทีม : ${recipient.teamName}`, "xs", "regular", MUTED_TEXT),
        ],
      },
      { ...text(`${recipient.points} คะแนน`, "sm", "bold", ACCENT), flex: 0 },
    ],
  };
}

function fantasyAwardSection(title: string, recipients: FantasyAwardsFlexInput["champions"]) {
  return {
    type: "box",
    layout: "vertical",
    spacing: "xs",
    contents: [
      text(title, "md", "bold", ACCENT),
      ...(recipients.length ? recipients.map(fantasyAwardRecipientRow) : [text("ไม่มีข้อมูล", "sm", "regular", MUTED_TEXT)]),
    ],
  };
}

export function buildFantasyAwardsFlex(input: FantasyAwardsFlexInput): FlexMessage {
  const title = `แชมป์บ๊วยแฟนตาซี · GW ${input.gameweek}`;
  return {
    type: "flex",
    altText: `${input.leagueName} · ${title}`,
    contents: awardsBubble([
      text(`แฟนตาซี ${input.leagueName}`, "lg", "bold", ACCENT),
      text(`ผลตัดสิน GW ${input.gameweek}`, "sm", "bold"),
      fantasyAwardSection("🏆 แชมป์", input.champions),
      fantasyAwardSection("🥄 บ๊วย", input.woodenSpoons),
    ]),
  };
}

export function buildStandingsFlex(input: StandingsFlexInput): FlexMessage {
  const title = input.period === "gameweek" ? `ตารางคะแนน GW ${input.gameweek ?? ""}` : "ตารางคะแนนทั้งฤดูกาล";
  const updatedAtLabel = input.updatedAtLabel ?? formatBangkokDateTime(new Date());
  const pages = chunks(input.rows, 8);
  const bubbles = pages.map((page, index) => bubble([
    text("เกมทายผลพรีเมียร์ลีก", "lg", "bold", ACCENT),
    text(title, "sm", "bold"),
    text(index === 0 ? "อันดับ · ผู้เล่น · คะแนน" : `หน้าที่ ${index + 1}`, "xs", "regular", MUTED_TEXT),
    ...(page.length ? page.map(standingsRow) : [text("ยังไม่มีคะแนน", "sm", "regular", MUTED_TEXT)]),
    text(`อัปเดต ${updatedAtLabel}`, "xs", "regular", MUTED_TEXT),
  ]));

  return {
    type: "flex",
    altText: `FPL Chei Chei · ${title}`,
    contents: container(bubbles),
  };
}

function todayFixture(fixture: TodayFixturesFlexInput["fixtures"][number]) {
  return {
    type: "box",
    layout: "horizontal",
    spacing: "xs",
    paddingAll: "8px",
    cornerRadius: "md",
    backgroundColor: CARD_BACKGROUND,
    alignItems: "center",
    contents: [
      teamSide(fixture.homeTeam, "home"),
      {
        type: "box",
        layout: "vertical",
        width: "48px",
        alignItems: "center",
         contents: [
           text(fixture.kickoffLabel, "xxs", "bold", ACCENT),
           ...(fixture.scoreLabel ? [{ ...text(fixture.scoreLabel, "xs", "bold", PRIMARY_TEXT), align: "center" }] : []),
           text(fixture.statusLabel, "xxs", "regular", fixture.statusLabel === "Live" ? "#FF647C" : MUTED_TEXT),
         ],
      },
      teamSide(fixture.awayTeam, "away"),
    ],
  };
}

export function buildTodayFixturesFlex(input: TodayFixturesFlexInput): FlexMessage {
  const groups = [...new Set(input.fixtures.map((fixture) => fixture.dayLabel ?? "วันนี้"))].map((dayLabel) => ({
    dayLabel,
    fixtures: input.fixtures.filter((fixture) => (fixture.dayLabel ?? "วันนี้") === dayLabel),
  }));

  return {
    type: "flex",
    altText: `FPL Chei Chei · บอลวันนี้ ${input.dateLabel}`,
    contents: bubble([
      header("บอลวันนี้", input.dateLabel),
      ...(groups.length
        ? groups.map((group) => ({
          type: "box",
          layout: "vertical",
          spacing: "xs",
          contents: [text(group.dayLabel, "sm", "bold", ACCENT), ...group.fixtures.map(todayFixture)],
        }))
        : [text("วันนี้และพรุ่งนี้ไม่มีการแข่งขัน", "sm", "regular", MUTED_TEXT)]),
    ]),
  };
}
