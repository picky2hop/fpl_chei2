export type PredictionChoice = "home" | "draw" | "away";

export type FlexTeam = {
  name: string;
  logoUrl?: string;
};

export type PredictionFlexInput = {
  displayName: string;
  avatarUrl?: string;
  gameweek: number;
  fixtures: Array<{
    homeTeam: FlexTeam;
    awayTeam: FlexTeam;
    choice: PredictionChoice;
  }>;
};

export type StandingsFlexInput = {
  period: "gameweek" | "season";
  gameweek?: number;
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
    kickoffLabel: string;
    statusLabel: string;
    homeTeam: FlexTeam;
    awayTeam: FlexTeam;
  }>;
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
const APP_URI = "https://fpl-chei2.vercel.app/";

const choiceLabels: Record<PredictionChoice, string> = {
  home: "เหย้า",
  draw: "เสมอ",
  away: "เยือน",
};

function isHttpsUrl(value: string | undefined): value is string {
  return Boolean(value?.trim().startsWith("https://"));
}

function text(value: string, size = "sm", weight = "regular", color = PRIMARY_TEXT) {
  return { type: "text", text: value, size, weight, color, wrap: true };
}

function imageOrFallback(url: string | undefined, fallback: string, size = "40px") {
  return isHttpsUrl(url)
    ? { type: "image", url, size, aspectMode: "fit", aspectRatio: "1:1", flex: 0 }
    : {
        type: "box",
        layout: "vertical",
        width: size,
        height: size,
        cornerRadius: "xl",
        backgroundColor: "#29435D",
        justifyContent: "center",
        alignItems: "center",
        contents: [text(fallback.slice(0, 2), "xs", "bold")],
      };
}

function teamSide(team: FlexTeam, side: "home" | "away", highlighted = false) {
  const name = text(team.name, "xs", "bold", highlighted ? "#071525" : PRIMARY_TEXT);
  const logo = imageOrFallback(team.logoUrl, team.name, "36px");
  return {
    type: "box",
    layout: "horizontal",
    flex: 1,
    spacing: "sm",
    paddingAll: highlighted ? "8px" : "0px",
    cornerRadius: "md",
    backgroundColor: highlighted ? ACCENT : CARD_BACKGROUND,
    justifyContent: side === "home" ? "end" : "start",
    alignItems: "center",
    contents: side === "home" ? [name, logo] : [logo, name],
  };
}

function footerButton() {
  return {
    type: "button",
    style: "primary",
    color: ACCENT,
    action: { type: "uri", label: "เปิดแอป FPL Chei Chei", uri: APP_URI },
  };
}

function bubble(contents: Record<string, unknown>[]) {
  return {
    type: "bubble",
    size: "mega",
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
      contents: [footerButton()],
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

function predictionFixture(fixture: PredictionFlexInput["fixtures"][number]) {
  return {
    type: "box",
    layout: "vertical",
    spacing: "sm",
    paddingAll: "8px",
    backgroundColor: MAIN_BACKGROUND,
    cornerRadius: "md",
    contents: [
      {
        type: "box",
        layout: "horizontal",
        spacing: "xs",
        alignItems: "center",
        contents: [
          teamSide(fixture.homeTeam, "home", fixture.choice === "home"),
          text("VS", "xxs", "bold", MUTED_TEXT),
          teamSide(fixture.awayTeam, "away", fixture.choice === "away"),
        ],
      },
      {
        type: "box",
        layout: "horizontal",
        justifyContent: "center",
        contents: [{
          type: "box",
          layout: "vertical",
          paddingAll: "5px",
          cornerRadius: "md",
          backgroundColor: fixture.choice === "draw" ? ACCENT : CARD_BACKGROUND,
          contents: [text(choiceLabels[fixture.choice], "xs", "bold", fixture.choice === "draw" ? "#071525" : PRIMARY_TEXT)],
        }],
      },
    ],
  };
}

export function buildPredictionResultFlex(input: PredictionFlexInput): FlexMessage {
  const profile = {
    type: "box",
    layout: "horizontal",
    spacing: "md",
    alignItems: "center",
    contents: [
      imageOrFallback(input.avatarUrl, input.displayName, "48px"),
      {
        type: "box",
        layout: "vertical",
        flex: 1,
        contents: [text(input.displayName, "md", "bold"), text(`ผลทาย GW${input.gameweek}`, "xs", "regular", MUTED_TEXT)],
      },
    ],
  };
  const fixtures = chunks(input.fixtures, 5);
  const bubbles = fixtures.map((page, index) => bubble([
    header(`ผลทาย GW${input.gameweek}`, index === 0 ? "FPL Chei Chei" : `ต่อหน้า ${index + 1}`),
    profile,
    ...(page.length ? page.map(predictionFixture) : [text("ยังไม่มีคำทาย", "sm", "regular", MUTED_TEXT)]),
  ]));

  return {
    type: "flex",
    altText: `FPL Chei Chei · ผลทาย GW${input.gameweek} ของ ${input.displayName}`,
    contents: container(bubbles),
  };
}

function standingsRow(row: StandingsFlexInput["rows"][number]) {
  return {
    type: "box",
    layout: "horizontal",
    spacing: "sm",
    paddingAll: "8px",
    cornerRadius: "md",
    backgroundColor: row.rank === 1 ? "#233A2D" : CARD_BACKGROUND,
    alignItems: "center",
    contents: [
      text(String(row.rank).padStart(2, "0"), "sm", "bold", row.rank === 1 ? ACCENT : MUTED_TEXT),
      imageOrFallback(row.avatarUrl, row.displayName, "36px"),
      { ...text(row.displayName, "sm", "bold"), flex: 1 },
      text(`${row.points} คะแนน`, "sm", "bold", row.rank === 1 ? ACCENT : PRIMARY_TEXT),
    ],
  };
}

export function buildStandingsFlex(input: StandingsFlexInput): FlexMessage {
  const title = input.period === "gameweek" ? `ตารางคะแนน GW${input.gameweek ?? ""}` : "ตารางคะแนนทั้งฤดูกาล";
  const pages = chunks(input.rows, 8);
  const bubbles = pages.map((page, index) => bubble([
    header(title, index === 0 ? "FPL Chei Chei" : `หน้า ${index + 1}`),
    ...(page.length ? page.map(standingsRow) : [text("ยังไม่มีคะแนน", "sm", "regular", MUTED_TEXT)]),
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
        contents: [text(fixture.kickoffLabel, "xs", "bold", ACCENT), text(fixture.statusLabel, "xxs", "regular", MUTED_TEXT)],
      },
      teamSide(fixture.awayTeam, "away"),
    ],
  };
}

export function buildTodayFixturesFlex(input: TodayFixturesFlexInput): FlexMessage {
  const pages = chunks(input.fixtures, 5);
  const bubbles = pages.map((page, index) => bubble([
    header("บอลวันนี้", index === 0 ? input.dateLabel : `หน้า ${index + 1}`),
    ...(page.length ? page.map(todayFixture) : [text("วันนี้ไม่มีการแข่งขัน", "sm", "regular", MUTED_TEXT)]),
  ]));

  return {
    type: "flex",
    altText: `FPL Chei Chei · บอลวันนี้ ${input.dateLabel}`,
    contents: container(bubbles),
  };
}
