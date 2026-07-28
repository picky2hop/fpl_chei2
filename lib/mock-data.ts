export type Team = {
  id: string;
  name: string;
  shortName: string;
  accent: string;
  crest: string;
};

export type FixtureStatus = "upcoming" | "live" | "finished";

export type Fixture = {
  id: string;
  gameweek: number;
  kickoff: string;
  dateLabel: string;
  status: FixtureStatus;
  homeTeam: Team;
  awayTeam: Team;
  homeScore?: number;
  awayScore?: number;
  predictionPercentages: {
    home: number;
    draw: number;
    away: number;
  };
  predictors: {
    home: string[];
    draw: string[];
    away: string[];
  };
};

export type Gameweek = {
  id: number;
  label: string;
  state: "current" | "past" | "future";
  fixtureCount: number;
};

export type UserProfile = {
  id: string;
  displayName: string;
  avatarUrl: string;
  shortName: string;
};

export type LeaderboardEntry = UserProfile & {
  rank: number;
  gameweekPoints: number;
  seasonPoints: number;
  trend: "up" | "down" | "same";
  form: number[];
};

const crest = (teamId: number) =>
  `https://resources.premierleague.com/premierleague/badges/50/t${teamId}.png`;

export const teams: Record<string, Team> = {
  arsenal: { id: "arsenal", name: "อาร์เซนอล", shortName: "ARS", accent: "#ef233c", crest: crest(1) },
  chelsea: { id: "chelsea", name: "เชลซี", shortName: "CHE", accent: "#2563eb", crest: crest(4) },
  liverpool: { id: "liverpool", name: "ลิเวอร์พูล", shortName: "LIV", accent: "#dc2626", crest: crest(14) },
  manCity: { id: "man-city", name: "แมนฯ ซิตี้", shortName: "MCI", accent: "#38bdf8", crest: crest(43) },
  newcastle: { id: "newcastle", name: "นิวคาสเซิล", shortName: "NEW", accent: "#334155", crest: crest(23) },
  tottenham: { id: "tottenham", name: "สเปอร์ส", shortName: "TOT", accent: "#64748b", crest: crest(6) },
  villa: { id: "villa", name: "แอสตัน วิลลา", shortName: "AVL", accent: "#7c3aed", crest: crest(2) },
  brighton: { id: "brighton", name: "ไบรท์ตัน", shortName: "BHA", accent: "#0ea5e9", crest: crest(36) },
};

export const currentUser: UserProfile = {
  id: "line-demo-user",
  displayName: "คุณเชยเชย",
  shortName: "ชย",
  avatarUrl: "https://i.pravatar.cc/120?img=12",
};

const users: UserProfile[] = [
  currentUser,
  { id: "user-mook", displayName: "มุกสายวิเคราะห์", shortName: "มว", avatarUrl: "https://i.pravatar.cc/120?img=47" },
  { id: "user-bank", displayName: "Bank The Kop", shortName: "BK", avatarUrl: "https://i.pravatar.cc/120?img=33" },
  { id: "user-palm", displayName: "ปาล์มพยากรณ์", shortName: "ปพ", avatarUrl: "https://i.pravatar.cc/120?img=68" },
  { id: "user-nut", displayName: "นัทบอลดึก", shortName: "นบ", avatarUrl: "https://i.pravatar.cc/120?img=11" },
];

const makeFixture = (
  id: string,
  gameweek: number,
  kickoff: string,
  dateLabel: string,
  homeTeam: Team,
  awayTeam: Team,
  status: FixtureStatus,
  result?: [number, number],
  percentages = { home: 45, draw: 20, away: 35 },
  predictors = { home: ["คุณเชยเชย", "มุกสายวิเคราะห์"], draw: ["นัทบอลดึก"], away: ["Bank The Kop", "ปาล์มพยากรณ์"] },
): Fixture => ({
  id,
  gameweek,
  kickoff,
  dateLabel,
  status,
  homeTeam,
  awayTeam,
  ...(result ? { homeScore: result[0], awayScore: result[1] } : {}),
  predictionPercentages: percentages,
  predictors,
});

export const gameweeks: Gameweek[] = [
  { id: 27, label: "GW 27", state: "past", fixtureCount: 4 },
  { id: 28, label: "GW 28", state: "current", fixtureCount: 4 },
  { id: 29, label: "GW 29", state: "future", fixtureCount: 4 },
];

export const fixturesByGameweek: Record<number, Fixture[]> = {
  27: [
    makeFixture("gw27-ars-che", 27, "2026-02-28T19:30:00+07:00", "เสาร์ 28 ก.พ. · 19:30", teams.arsenal, teams.chelsea, "finished", [2, 1], { home: 58, draw: 18, away: 24 }),
    makeFixture("gw27-mci-liv", 27, "2026-03-01T23:30:00+07:00", "อาทิตย์ 1 มี.ค. · 23:30", teams.manCity, teams.liverpool, "finished", [1, 1], { home: 48, draw: 28, away: 24 }),
    makeFixture("gw27-tot-new", 27, "2026-03-02T02:00:00+07:00", "จันทร์ 2 มี.ค. · 02:00", teams.tottenham, teams.newcastle, "finished", [0, 2], { home: 22, draw: 20, away: 58 }),
    makeFixture("gw27-avl-bha", 27, "2026-03-02T21:00:00+07:00", "จันทร์ 2 มี.ค. · 21:00", teams.villa, teams.brighton, "finished", [3, 0], { home: 61, draw: 20, away: 19 }),
  ],
  28: [
    makeFixture("gw28-ars-liv", 28, "2026-03-07T19:30:00+07:00", "เสาร์ 7 มี.ค. · 19:30", teams.arsenal, teams.liverpool, "upcoming", undefined, { home: 39, draw: 24, away: 37 }),
    makeFixture("gw28-che-mci", 28, "2026-03-08T23:30:00+07:00", "อาทิตย์ 8 มี.ค. · 23:30", teams.chelsea, teams.manCity, "upcoming", undefined, { home: 28, draw: 24, away: 48 }),
    makeFixture("gw28-new-avl", 28, "2026-03-09T02:00:00+07:00", "จันทร์ 9 มี.ค. · 02:00", teams.newcastle, teams.villa, "upcoming", undefined, { home: 51, draw: 22, away: 27 }),
    makeFixture("gw28-bha-tot", 28, "2026-03-09T21:00:00+07:00", "จันทร์ 9 มี.ค. · 21:00", teams.brighton, teams.tottenham, "upcoming", undefined, { home: 44, draw: 25, away: 31 }),
  ],
  29: [
    makeFixture("gw29-mci-ars", 29, "2026-03-14T19:30:00+07:00", "เสาร์ 14 มี.ค. · 19:30", teams.manCity, teams.arsenal, "upcoming", undefined, { home: 42, draw: 25, away: 33 }),
    makeFixture("gw29-liv-che", 29, "2026-03-15T23:30:00+07:00", "อาทิตย์ 15 มี.ค. · 23:30", teams.liverpool, teams.chelsea, "upcoming", undefined, { home: 54, draw: 23, away: 23 }),
    makeFixture("gw29-avl-new", 29, "2026-03-16T02:00:00+07:00", "จันทร์ 16 มี.ค. · 02:00", teams.villa, teams.newcastle, "upcoming", undefined, { home: 40, draw: 25, away: 35 }),
    makeFixture("gw29-tot-bha", 29, "2026-03-16T21:00:00+07:00", "จันทร์ 16 มี.ค. · 21:00", teams.tottenham, teams.brighton, "upcoming", undefined, { home: 46, draw: 25, away: 29 }),
  ],
};

const makeLeaderboard = (gameweekPoints: number[], seasonPoints: number[]): LeaderboardEntry[] =>
  users.map((user, index) => ({
    ...user,
    rank: index + 1,
    gameweekPoints: gameweekPoints[index],
    seasonPoints: seasonPoints[index],
    trend: index === 0 ? "up" : index === 3 ? "down" : "same",
    form: [3, 1, 3, 0, 3].map((_, formIndex) => (gameweekPoints[index] + formIndex + index) % 4),
  }));

export const leaderboardByGameweek: Record<number, LeaderboardEntry[]> = {
  27: makeLeaderboard([12, 9, 9, 6, 3], [168, 158, 151, 140, 132]),
  28: makeLeaderboard([0, 0, 0, 0, 0], [180, 170, 162, 146, 141]),
  29: makeLeaderboard([0, 0, 0, 0, 0], [180, 170, 162, 146, 141]),
};
