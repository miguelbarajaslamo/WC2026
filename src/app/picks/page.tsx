import { AppShell } from "@/components/app/app-shell";
import { PicksView } from "@/components/views/picks-view";

export default function PicksPage() {
  return (
    <AppShell kicker="Missing, open, locked" title="My Picks">
      <PicksView />
    </AppShell>
  );
}
