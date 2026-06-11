"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Flag } from "@/components/ui/flag";
import { ErrorState, LoadingState } from "@/components/app/data-state";
import { StatLegend } from "@/components/app/stat-legend";
import { useBootstrap } from "@/components/app/use-bootstrap";
import { bootstrapQueryKey } from "@/lib/api/bootstrap";
import { cn } from "@/lib/cn";
import { getTeam } from "@/lib/data/selectors";

const GROUP_LEGEND: Array<[string, string]> = [
  ["P", "Played"],
  ["W", "Won"],
  ["D", "Drawn"],
  ["L", "Lost"],
  ["GF", "Goals for"],
  ["GA", "Goals against"],
  ["Pts", "Points"],
  ["Q", "Qualified"],
];

export function GroupsView() {
  const { data, error, isLoading } = useBootstrap();

  if (isLoading || !data) {
    return <LoadingState label="Loading groups" />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-black uppercase tracking-wide text-stone-500">
          Group standings
        </h1>
        <div className="flex items-center gap-2">
          {data.currentMemberRole === "admin" ? (
            <RefreshStandingsButton poolId={data.pool.id} />
          ) : null}
          <StatLegend items={GROUP_LEGEND} />
        </div>
      </div>

      {Object.entries(data.standings)
        .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
        .map(([groupName, rows]) => (
        <section
          className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm"
          key={groupName}
        >
          <div className="bg-stone-950 px-4 py-3 text-white">
            <h2 className="font-black">{groupName}</h2>
          </div>
          <div className="grid grid-cols-[1fr_16px_16px_16px_16px_22px_22px_22px_14px] gap-1 border-b border-black/10 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-stone-500">
            <span>Team</span>
            <span>P</span>
            <span>W</span>
            <span>D</span>
            <span>L</span>
            <span>GF</span>
            <span>GA</span>
            <span>Pts</span>
            <span />
          </div>
          {rows.map((row) => {
            const team = getTeam(data, row.teamId);
            return (
              <Link
                className="grid grid-cols-[1fr_16px_16px_16px_16px_22px_22px_22px_14px] items-center gap-1 border-b border-black/10 px-3 py-3 last:border-0"
                href={`/teams/${team.id}`}
                key={team.id}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Flag code={team.iso2} label={team.name} />
                  <span className="truncate text-sm font-black">{team.shortName}</span>
                </span>
                <span className="font-mono text-xs font-bold">{row.played}</span>
                <span className="font-mono text-xs font-bold">{row.won}</span>
                <span className="font-mono text-xs font-bold">{row.drawn}</span>
                <span className="font-mono text-xs font-bold">{row.lost}</span>
                <span className="font-mono text-xs font-bold">{row.goalsFor}</span>
                <span className="font-mono text-xs font-bold">{row.goalsAgainst}</span>
                <span className="font-mono text-xs font-black">{row.points}</span>
                <span className="text-[10px] font-black uppercase text-stone-400">
                  {row.qualification === "qualified" ? "Q" : ""}
                </span>
              </Link>
            );
          })}
        </section>
      ))}
    </div>
  );
}

// Subtle admin-only escape hatch for when the standings cron lags behind a
// finished match (API-Football refreshes its standings with some delay).
function RefreshStandingsButton({ poolId }: { poolId: string }) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ kind: "error" | "ok"; text: string } | null>(
    null,
  );
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  function showToast(kind: "error" | "ok", text: string) {
    setToast({ kind, text });
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }

  async function refresh() {
    if (refreshing) {
      return;
    }
    setRefreshing(true);

    try {
      const response = await fetch("/api/admin/refresh-standings", {
        body: JSON.stringify({ poolId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        showToast("error", body.error ?? "Could not refresh standings.");
        return;
      }

      await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
      showToast("ok", "Standings refreshed.");
    } catch {
      showToast("error", "Could not refresh standings.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <>
      <button
        aria-label="Refresh standings from the data provider"
        className="grid size-8 place-items-center rounded-md text-stone-400 hover:bg-stone-200 hover:text-stone-600 disabled:opacity-60"
        disabled={refreshing}
        onClick={() => void refresh()}
        title="Refresh standings"
        type="button"
      >
        <RefreshCw className={refreshing ? "animate-spin" : ""} size={15} />
      </button>
      {toast ? (
        <div
          className={cn(
            "fixed inset-x-4 top-[calc(80px+var(--safe-top))] z-50 mx-auto max-w-md rounded-lg px-4 py-3 text-sm font-black text-white shadow-xl",
            toast.kind === "ok" ? "bg-emerald-950" : "bg-red-700",
          )}
          role="status"
        >
          {toast.text}
        </div>
      ) : null}
    </>
  );
}
