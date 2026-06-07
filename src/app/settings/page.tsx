import { AppShell } from "@/components/app/app-shell";
import { SettingsView } from "@/components/views/settings-view";

export default function SettingsPage() {
  return (
    <AppShell kicker="Profile, PWA, notifications" title="Settings">
      <SettingsView />
    </AppShell>
  );
}
