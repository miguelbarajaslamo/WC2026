import { cn } from "@/lib/cn";
import type { MatchStatus } from "@/lib/types";

const statusCopy: Record<MatchStatus, string> = {
  cancelled: "Cancelled",
  finished: "FT",
  halftime: "Half-time",
  live: "Live",
  postponed: "Postponed",
  scheduled: "Upcoming",
};

export function statusPillLabel(
  status: MatchStatus,
  providerStatusCode?: string,
) {
  const code = providerStatusCode?.toUpperCase();

  if (code === "P" || code === "PEN") {
    return "PEN";
  }

  return statusCopy[status];
}

export function StatusPill({
  providerStatusCode,
  status,
}: {
  providerStatusCode?: string;
  status: MatchStatus;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded px-2 text-[11px] font-black uppercase tracking-wide",
        status === "live" && "bg-red-600 text-white",
        status === "halftime" && "bg-amber-300 text-stone-950",
        status === "finished" && "bg-stone-950 text-white",
        status === "scheduled" && "bg-emerald-100 text-emerald-950",
        status === "postponed" && "bg-stone-200 text-stone-700",
        status === "cancelled" && "bg-stone-200 text-stone-700",
      )}
    >
      {statusPillLabel(status, providerStatusCode)}
    </span>
  );
}
