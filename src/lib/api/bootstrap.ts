import type { BootstrapData } from "@/lib/types";

export const bootstrapQueryKey = ["bootstrap"];

export async function fetchBootstrapData(): Promise<BootstrapData> {
  const response = await fetch("/api/bootstrap", {
    credentials: "include",
  });

  // Session expired while the app was open: send the user back to login
  // instead of surfacing a generic error.
  if (response.status === 401 && typeof window !== "undefined") {
    const next = encodeURIComponent(
      `${window.location.pathname}${window.location.search}`,
    );
    window.location.href = `/login?next=${next}`;
    throw new Error("Not authenticated");
  }

  if (!response.ok) {
    throw new Error("Could not load WORLD CUP PICKS data");
  }

  return response.json();
}
