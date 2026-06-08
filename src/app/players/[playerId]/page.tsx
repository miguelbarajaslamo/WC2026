import { AppShell } from "@/components/app/app-shell";
import { PlayerDetailView } from "@/components/views/player-detail-view";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;

  return (
    <AppShell kicker="Squad and tournament stats" title="Player">
      <PlayerDetailView playerId={playerId} />
    </AppShell>
  );
}
