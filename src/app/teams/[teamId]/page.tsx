import { AppShell } from "@/components/app/app-shell";
import { TeamDetailView } from "@/components/views/team-detail-view";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;

  return (
    <AppShell kicker="Fixtures, results, table" title="Team">
      <TeamDetailView teamId={teamId} />
    </AppShell>
  );
}
