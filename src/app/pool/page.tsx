import { AppShell } from "@/components/app/app-shell";
import { PoolView } from "@/components/views/pool-view";

export default function PoolPage() {
  return (
    <AppShell kicker="Members, rules, install" title="Pool">
      <PoolView />
    </AppShell>
  );
}
