import { AppShell } from "@/components/app/app-shell";
import { LeaderboardView } from "@/components/views/leaderboard-view";

export default function LeaderboardPage() {
  return (
    <AppShell kicker="Rank, points, movement" title="Leaderboard">
      <LeaderboardView />
    </AppShell>
  );
}
