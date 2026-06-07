import { AppShell } from "@/components/app/app-shell";
import { MatchDetailView } from "@/components/views/match-detail-view";

export default async function MatchPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;

  return (
    <AppShell kicker="Score, events, predictions" title="Match">
      <MatchDetailView matchId={matchId} />
    </AppShell>
  );
}
