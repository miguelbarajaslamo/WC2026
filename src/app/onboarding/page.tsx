import { AppShell } from "@/components/app/app-shell";
import { OnboardingView } from "@/components/views/onboarding-view";

export default function OnboardingPage() {
  return (
    <AppShell kicker="Rules, reminders, initial picks" title="Onboarding">
      <OnboardingView />
    </AppShell>
  );
}
