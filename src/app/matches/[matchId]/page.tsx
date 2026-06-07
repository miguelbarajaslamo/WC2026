import { AppShell } from "@/components/app/app-shell";
import { MatchDetailView } from "@/components/views/match-detail-view";
import { safeRelativeRedirect } from "@/lib/auth/redirect";

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { matchId } = await params;
  const { from } = await searchParams;

  return (
    <AppShell kicker="Score, events, predictions" title="Match">
      <MatchDetailView from={safeRelativeRedirect(from, "/")} matchId={matchId} />
    </AppShell>
  );
}
