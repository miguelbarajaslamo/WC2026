import type { BootstrapData } from "@/lib/types";

export const bootstrapQueryKey = ["bootstrap"];

// Carries the server's machine-readable error code (e.g. "NO_POOL") so the UI
// can branch on it instead of matching error strings.
export class BootstrapError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "BootstrapError";
    this.code = code;
  }
}

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
    throw new BootstrapError("Not authenticated");
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
    };
    throw new BootstrapError(
      body.error ?? "Could not load WORLD CUP PICKS data",
      body.code,
    );
  }

  return response.json();
}
