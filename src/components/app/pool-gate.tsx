"use client";

import { BootstrapError } from "@/lib/api/bootstrap";
import { useBootstrap } from "@/components/app/use-bootstrap";
import { PoolSetupView } from "@/components/views/pool-setup-view";

// Authenticated users who aren't in a pool yet get the create/join screen
// instead of the app chrome (every view depends on pool data).
export function PoolGate({ children }: { children: React.ReactNode }) {
  const { error } = useBootstrap();

  if (error instanceof BootstrapError && error.code === "NO_POOL") {
    return <PoolSetupView />;
  }

  return <>{children}</>;
}
