import { AppShell } from "@/components/app/app-shell";
import { MemberDetailView } from "@/components/views/member-detail-view";

export default async function MemberPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  return (
    <AppShell kicker="Picks, points, specials" title="Pool member">
      <MemberDetailView userId={userId} />
    </AppShell>
  );
}
