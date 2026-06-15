import { AppShell } from "@/components/app/app-shell";
import { GroupsFinalsView } from "@/components/views/groups-finals-view";

export default function GroupsPage() {
  return (
    <AppShell kicker="Tables and qualification" title="Groups">
      <GroupsFinalsView />
    </AppShell>
  );
}
