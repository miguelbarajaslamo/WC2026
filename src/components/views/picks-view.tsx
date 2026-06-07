"use client";

import { useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/data-state";
import { InlinePredictionPicker } from "@/components/app/inline-prediction-picker";
import { MatchRow } from "@/components/app/match-row";
import { TournamentSpecialsBanner } from "@/components/app/tournament-specials-banner";
import { useBootstrap } from "@/components/app/use-bootstrap";
import { BonusPicksPanel } from "@/components/views/bonus-picks-panel";
import { cn } from "@/lib/cn";
import { isMatchLocked } from "@/lib/data/selectors";
import {
  filterPicksMatches,
  type PicksFilter,
} from "@/lib/match-filters";

export function PicksView() {
  const { data, error, isLoading } = useBootstrap();
  const [filter, setFilter] = useState<PicksFilter>("all");

  if (isLoading || !data) {
    return <LoadingState label="Loading picks" />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  const filteredMatches = filterPicksMatches(data, filter);
  const missing = filterPicksMatches(data, "missing");
  const open = filterPicksMatches(data, "open");
  const locked = filterPicksMatches(data, "locked");
  const filters: Array<{ filter: PicksFilter; label: string; value: number }> = [
    { filter: "all", label: "All", value: data.matches.length },
    { filter: "missing", label: "Missing", value: missing.length },
    { filter: "open", label: "Open", value: open.length },
    { filter: "locked", label: "Locked", value: locked.length },
  ];

  return (
    <div className="space-y-5">
      <TournamentSpecialsBanner data={data} />

      <section className="grid grid-cols-4 gap-2">
        {filters.map((item) => (
          <button
            aria-pressed={filter === item.filter}
            className={cn(
              "rounded-lg border border-black/10 bg-white p-3 text-center shadow-sm",
              filter === item.filter && "bg-emerald-950 text-white",
            )}
            key={item.filter}
            onClick={() => setFilter(item.filter)}
            type="button"
          >
            <p className="font-mono text-xl font-black">{item.value}</p>
            <p
              className={cn(
                "text-[10px] font-black uppercase tracking-wide text-stone-500",
                filter === item.filter && "text-emerald-100",
              )}
            >
              {item.label}
            </p>
          </button>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-wide text-stone-500">
          {filter === "all"
            ? "All match picks"
            : filter === "missing"
              ? "Missing picks"
              : filter === "open"
                ? "Open for edits"
                : "Locked / finished"}
        </h2>
        {filteredMatches.length === 0 ? (
          <EmptyState body="Try another filter or wait for more fixtures." title="No matches" />
        ) : (
          filteredMatches.map((match) => (
            isMatchLocked(match) ? (
              <MatchRow data={data} key={match.id} match={match} />
            ) : (
              <InlinePredictionPicker
                compact
                data={data}
                key={match.id}
                match={match}
              />
            )
          ))
        )}
      </section>

      <BonusPicksPanel data={data} />
    </div>
  );
}
