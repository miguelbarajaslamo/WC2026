"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { MatchRow } from "@/components/app/match-row";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/data-state";
import { useBootstrap } from "@/components/app/use-bootstrap";
import { formatMatchDate } from "@/lib/format";
import {
  getTeam,
  getUserPrediction,
  getVisibleMatches,
  isMatchLocked,
} from "@/lib/data/selectors";

export function FixturesView() {
  const { data, error, isLoading } = useBootstrap();
  const [query, setQuery] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);

  const matches = useMemo(() => {
    if (!data) {
      return [];
    }

    return getVisibleMatches(data).filter((match) => {
      const home = getTeam(data, match.homeTeamId);
      const away = getTeam(data, match.awayTeamId);
      const label = `${home.name} ${away.name} ${home.shortName} ${away.shortName} ${match.groupName ?? ""}`.toLowerCase();
      const hasPick = Boolean(getUserPrediction(data, match.id));

      return (
        label.includes(query.toLowerCase()) &&
        (!missingOnly || (!hasPick && !isMatchLocked(match)))
      );
    });
  }, [data, missingOnly, query]);

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
        <button
          className="mt-3 h-10 rounded-md bg-stone-950 px-3 text-xs font-black uppercase text-white aria-pressed:bg-amber-400 aria-pressed:text-stone-950"
          aria-pressed={missingOnly}
          onClick={() => setMissingOnly((value) => !value)}
          type="button"
        >
          Missing only
        </button>
      </div>

      {matches.length === 0 ? (
        <EmptyState body="Try another search or turn off missing-only." title="No fixtures" />
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
