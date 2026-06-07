import type { BootstrapData } from "@/lib/types";

export const bootstrapQueryKey = ["bootstrap"];

export async function fetchBootstrapData(): Promise<BootstrapData> {
  const response = await fetch("/api/bootstrap", {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Could not load WORLD CUP PICKS data");
  }

  return response.json();
}
