import { AppShell } from "@/components/app/app-shell";
import { StatsView } from "@/components/views/stats-view";

export default function StatsPage() {
  return (
    <AppShell kicker="Goals, assists, cards" title="Stats">
      <StatsView />
    </AppShell>
  );
}
