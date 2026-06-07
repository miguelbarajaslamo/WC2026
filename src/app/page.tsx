import { AppShell } from "@/components/app/app-shell";
import { TodayView } from "@/components/views/today-view";

export default function HomePage() {
  return (
    <AppShell kicker="Live and upcoming matches" title="Today">
      <TodayView />
    </AppShell>
  );
}
