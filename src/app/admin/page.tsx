import { AppShell } from "@/components/app/app-shell";
import { AdminView } from "@/components/views/admin-view";

export default function AdminPage() {
  return (
    <AppShell kicker="Sync, scoring, corrections" title="Admin">
      <AdminView />
    </AppShell>
  );
}
