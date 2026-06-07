import { AppShell } from "@/components/app/app-shell";
import { OnboardingView } from "@/components/views/onboarding-view";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<{ invite?: string }>;
}) {
  const params = await searchParams;

  return (
    <AppShell kicker="Rules, reminders, initial picks" title="Onboarding">
      <OnboardingView invite={params?.invite} />
    </AppShell>
  );
}
