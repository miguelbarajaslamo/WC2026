"use client";

import Link from "next/link";
import { Flag } from "@/components/ui/flag";
import { ErrorState, LoadingState } from "@/components/app/data-state";
import { useBootstrap } from "@/components/app/use-bootstrap";
import { getTeam } from "@/lib/data/selectors";

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
      {Object.entries(data.standings).map(([groupName, rows]) => (
        <section
          className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm"
          key={groupName}
        >
          <div className="bg-stone-950 px-4 py-3 text-white">
            <h2 className="font-black">{groupName}</h2>
          </div>
          <div className="grid grid-cols-[1fr_28px_28px_28px_36px] gap-2 border-b border-black/10 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-stone-500">
            <span>Team</span>
            <span>P</span>
            <span>GD</span>
            <span>Pts</span>
            <span />
          </div>
          {rows.map((row) => {
            const team = getTeam(data, row.teamId);
            const goalDifference = row.goalsFor - row.goalsAgainst;
            return (
              <Link
                className="grid grid-cols-[1fr_28px_28px_28px_36px] items-center gap-2 border-b border-black/10 px-3 py-3 last:border-0"
                href={`/teams/${team.id}`}
                key={team.id}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Flag code={team.iso2} label={team.name} />
                  <span className="truncate text-sm font-black">{team.shortName}</span>
                </span>
                <span className="font-mono text-sm font-bold">{row.played}</span>
                <span className="font-mono text-sm font-bold">{goalDifference}</span>
                <span className="font-mono text-sm font-black">{row.points}</span>
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
