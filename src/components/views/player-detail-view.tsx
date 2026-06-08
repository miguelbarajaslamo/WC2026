"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Flag } from "@/components/ui/flag";
import { MatchRow } from "@/components/app/match-row";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/data-state";
import { useBootstrap } from "@/components/app/use-bootstrap";
import { getVisibleMatches } from "@/lib/data/selectors";

export function PlayerDetailView({ playerId }: { playerId: string }) {
  const { data, error, isLoading } = useBootstrap();

  if (isLoading || !data) {
    return <LoadingState label="Loading player" />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  const player = data.players.find((item) => item.id === playerId);

  if (!player) {
    return (
      <EmptyState
        body="This player is not in the tournament data."
        title="Player not found"
      />
    );
  }

  const membership = data.squadMembers.find((item) => item.playerId === playerId);
  const team = membership
    ? data.teams.find((item) => item.id === membership.teamId)
    : undefined;
  const stat = data.playerStatSnapshots.find(
    (item) =>
      (item.playerId && item.playerId === playerId) ||
      (item.teamId === team?.id && item.playerName === player.name),
  );

  const fixtures = team
    ? getVisibleMatches(data).filter(
        (match) =>
          match.homeTeamId === team.id || match.awayTeamId === team.id,
      )
    : [];

  return (
    <div className="space-y-4">
      <section className="rounded-lg bg-[#022c22] p-4 text-white">
        <div className="flex items-center gap-3">
          {player.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={player.name}
              className="size-16 rounded-full bg-white/10 object-cover"
              src={player.photoUrl}
            />
          ) : (
            <Avatar color="#064e3b" name={player.name} size="lg" />
          )}
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-black">{player.name}</h2>
            <p className="text-sm font-bold text-white/70">
              {membership?.position ?? player.position ?? "Player"}
              {membership?.shirtNumber ? ` · #${membership.shirtNumber}` : ""}
            </p>
            {team ? (
              <Link
                className="mt-1 inline-flex items-center gap-2 text-sm font-bold text-emerald-200"
                href={`/teams/${team.id}`}
              >
                <Flag code={team.iso2} label={team.name} size="sm" />
                {team.name}
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-5 gap-2">
        <Metric label="Goals" value={stat?.goals ?? 0} />
        <Metric label="Assists" value={stat?.assists ?? 0} />
        <Metric label="Yellow" value={stat?.yellowCards ?? 0} />
        <Metric label="Red" value={stat?.redCards ?? 0} />
        <Metric label="Saves" value={stat?.saves ?? 0} />
      </section>

      {team ? (
        <section className="space-y-3">
          <h2 className="text-sm font-black uppercase tracking-wide text-stone-500">
            {team.shortName} fixtures
          </h2>
          {fixtures.map((match) => (
            <MatchRow data={data} key={match.id} match={match} />
          ))}
        </section>
      ) : null}
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
