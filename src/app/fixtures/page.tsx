import { AppShell } from "@/components/app/app-shell";
import { FixturesView } from "@/components/views/fixtures-view";

export default function FixturesPage() {
  return (
    <AppShell kicker="Schedule, filters, quick picks" title="Fixtures">
      <FixturesView />
    </AppShell>
  );
}
