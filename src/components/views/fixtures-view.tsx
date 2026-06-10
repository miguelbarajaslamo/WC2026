"use client";

import { Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { MatchRow } from "@/components/app/match-row";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/data-state";
import { useBootstrap } from "@/components/app/use-bootstrap";
import { cn } from "@/lib/cn";
import { formatMatchDate } from "@/lib/format";
import {
  filterFixturesMatches,
  type FixturesFilter,
} from "@/lib/match-filters";

export function FixturesView() {
  const { data, error, isLoading } = useBootstrap();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FixturesFilter[]>([]);
  // Defer filtering so keystrokes paint immediately and the list catches up.
  const deferredQuery = useDeferredValue(query);

  const matches = useMemo(() => {
    if (!data) {
      return [];
    }

    return filterFixturesMatches({ data, filters, query: deferredQuery });
  }, [data, filters, deferredQuery]);

  function toggleFilter(value: FixturesFilter) {
    setFilters((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  if (isLoading || !data) {
    return <LoadingState label="Loading fixtures" />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-black/10 bg-white p-3">
        <label className="grid grid-cols-[20px_1fr] items-center gap-2 rounded-md bg-stone-100 px-3 py-2">
          <Search size={17} />
          <input
            className="min-w-0 bg-transparent text-sm font-bold outline-none placeholder:text-stone-400"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search teams, groups, stages"
            value={query}
          />
        </label>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {([
            ["missing", "Missing"],
            ["upcoming", "Upcoming"],
            ["finished", "Finished"],
          ] as Array<[FixturesFilter, string]>).map(([value, label]) => {
            const active = filters.includes(value);
            return (
              <button
                aria-pressed={active}
                className={cn(
                  "flex h-10 items-center justify-center rounded-md text-xs font-black uppercase tracking-wide",
                  active
                    ? "bg-stone-950 text-white"
                    : "bg-stone-100 text-stone-500",
                )}
                key={value}
                onClick={() => toggleFilter(value)}
                type="button"
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {matches.length === 0 ? (
        <EmptyState body="Try another search or fixture filter." title="No fixtures" />
      ) : (
        <div className="space-y-4">
          {matches.map((match, index) => {
            const previous = matches[index - 1];
            const showDate =
              !previous || formatMatchDate(previous.kickoffAt) !== formatMatchDate(match.kickoffAt);

            return (
              <div className="space-y-2" key={match.id}>
                {showDate ? (
                  <h2 className="text-xs font-black uppercase tracking-wide text-stone-500">
                    {formatMatchDate(match.kickoffAt)}
                  </h2>
                ) : null}
                <MatchRow data={data} match={match} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
