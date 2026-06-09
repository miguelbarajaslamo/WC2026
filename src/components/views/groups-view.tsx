"use client";

import Link from "next/link";
import { Flag } from "@/components/ui/flag";
import { ErrorState, LoadingState } from "@/components/app/data-state";
import { StatLegend } from "@/components/app/stat-legend";
import { useBootstrap } from "@/components/app/use-bootstrap";
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
        <StatLegend items={GROUP_LEGEND} />
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
