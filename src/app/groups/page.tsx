import { AppShell } from "@/components/app/app-shell";
import { GroupsView } from "@/components/views/groups-view";

export default function GroupsPage() {
  return (
    <AppShell kicker="Tables and qualification" title="Groups">
      <GroupsView />
    </AppShell>
  );
}
