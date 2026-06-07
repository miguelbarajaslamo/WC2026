"use client";

import { Flag } from "@/components/ui/flag";
import { MatchRow } from "@/components/app/match-row";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/data-state";
import { useBootstrap } from "@/components/app/use-bootstrap";
import { getVisibleMatches } from "@/lib/data/selectors";

export function TeamDetailView({ teamId }: { teamId: string }) {
  const { data, error, isLoading } = useBootstrap();

  if (isLoading || !data) {
    return <LoadingState label="Loading team" />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  const team = data.teams.find((item) => item.id === teamId);

  if (!team) {
    return <EmptyState body="This team is not in the tournament data." title="Team not found" />;
  }

  const fixtures = getVisibleMatches(data).filter(
    (match) => match.homeTeamId === team.id || match.awayTeamId === team.id,
  );
  const standings = Object.values(data.standings)
    .flat()
    .find((row) => row.teamId === team.id);

  return (
    <div className="space-y-4">
      <section className="rounded-lg bg-[#022c22] p-4 text-white">
        <Flag code={team.iso2} label={team.name} size="lg" />
        <h2 className="mt-3 text-3xl font-black">{team.shortName}</h2>
        <p className="text-sm font-bold text-white/70">
          {team.name} · {team.groupName}
        </p>
      </section>

      {standings ? (
        <section className="grid grid-cols-4 gap-2">
          <Metric label="Played" value={standings.played} />
          <Metric label="GF" value={standings.goalsFor} />
          <Metric label="GA" value={standings.goalsAgainst} />
          <Metric label="Pts" value={standings.points} />
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-wide text-stone-500">
          Matches
        </h2>
        {fixtures.map((match) => (
          <MatchRow data={data} key={match.id} match={match} />
        ))}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-3 text-center">
      <p className="font-mono text-xl font-black">{value}</p>
      <p className="text-[10px] font-black uppercase tracking-wide text-stone-500">
        {label}
      </p>
    </div>
  );
}
