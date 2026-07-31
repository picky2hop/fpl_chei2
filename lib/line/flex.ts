export type PredictionChoice = "home" | "draw" | "away";

export type PredictionFlexInput = {
  displayName: string;
  gameweek: number;
  fixtures: Array<{
    homeTeam: string;
    awayTeam: string;
    choice: PredictionChoice;
  }>;
};

export type StandingsFlexInput = {
  gameweek: number;
  rows: Array<{
    rank: number;
    displayName: string;
    points: number;
  }>;
};

export type FlexMessage = {
  type: "flex";
  altText: string;
  contents: Record<string, unknown>;
};

const choiceLabels: Record<PredictionChoice, string> = {
  home: "เหย้า",
  draw: "เสมอ",
  away: "เยือน",
};

function text(textValue: string, size = "sm", weight = "regular") {
  return { type: "text", text: textValue, size, weight, color: "#17324D", wrap: true };
}

function header(title: string, subtitle: string) {
  return {
    type: "box",
    layout: "vertical",
    backgroundColor: "#D9FF58",
    paddingAll: "20px",
    contents: [
      text(title, "xl", "bold"),
      { ...text(subtitle, "sm", "regular"), color: "#49621F", margin: "sm" },
    ],
  };
}

export function buildPredictionResultFlex(input: PredictionFlexInput): FlexMessage {
  const fixtureContents = input.fixtures.map((fixture) => ({
    type: "box",
    layout: "horizontal",
    margin: "md",
    contents: [
      { ...text(`${fixture.homeTeam} vs ${fixture.awayTeam}`, "sm", "bold"), flex: 1 },
      { ...text(choiceLabels[fixture.choice], "sm", "bold"), color: "#3D8B6B", align: "end" },
    ],
  }));

  return {
    type: "flex",
    altText: `FPL Chei Chei · ผลทาย GW${input.gameweek} ของ ${input.displayName}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          header(`ผลทาย GW${input.gameweek}`, `ของ ${input.displayName}`),
          {
            type: "box",
            layout: "vertical",
            paddingAll: "16px",
            contents: fixtureContents.length ? fixtureContents : [text("ยังไม่มีคำทาย", "sm")],
          },
        ],
      },
    },
  };
}

export function buildStandingsFlex(input: StandingsFlexInput): FlexMessage {
  const rows = input.rows.map((row) => ({
    type: "box",
    layout: "horizontal",
    margin: "md",
    contents: [
      { ...text(`${row.rank}.`, "sm", "bold"), flex: 0 },
      { ...text(row.displayName, "sm", "bold"), flex: 1, margin: "md" },
      { ...text(`${row.points} คะแนน`, "sm", "bold"), align: "end" },
    ],
  }));

  return {
    type: "flex",
    altText: `FPL Chei Chei · ตารางคะแนน GW${input.gameweek}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          header(`ตารางคะแนน GW${input.gameweek}`, "FPL Chei Chei"),
          {
            type: "box",
            layout: "vertical",
            paddingAll: "16px",
            contents: rows.length ? rows : [text("ยังไม่มีคะแนน", "sm")],
          },
        ],
      },
    },
  };
}
