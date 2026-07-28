import PredictionApp from "../components/prediction-app";
import {
  currentUser,
  fixturesByGameweek,
  gameweeks,
  leaderboardByGameweek,
} from "@/lib/mock-data";

export default function DashboardPage() {
  return (
    <PredictionApp
      currentUser={currentUser}
      gameweeks={gameweeks}
      fixturesByGameweek={fixturesByGameweek}
      leaderboardByGameweek={leaderboardByGameweek}
    />
  );
}
