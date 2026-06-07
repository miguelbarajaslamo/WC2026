"use client";

import { Avatar } from "@/components/ui/avatar";
import { MatchRow } from "@/components/app/match-row";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/data-state";
import { useBootstrap } from "@/components/app/use-bootstrap";
import { getUserPrediction, getVisibleMatches } from "@/lib/data/selectors";

export function PlayerDetailView({ playerId }: { playerId: string }) {
  const { data, error, isLoading } = useBootstrap();

  if (isLoading || !data) {
    return <LoadingState label="Loading player" />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  const profile = data.profiles.find((item) => item.id === playerId);
  const row = data.leaderboard.find((item) => item.userId === playerId);

  if (!profile) {
    return <EmptyState body="This player is not in the pool." title="Player not found" />;
  }

  const matchesWithPicks = getVisibleMatches(data).filter((match) =>
    getUserPrediction(data, match.id, playerId),
  );

  return (
    <div className="space-y-4">
      <section className="rounded-lg bg-[#022c22] p-4 text-white">
        <div className="flex items-center gap-3">
          <Avatar color={profile.avatarColor} name={profile.displayName} size="lg" />
          <div>
            <h2 className="text-2xl font-black">{profile.displayName}</h2>
            <p className="text-sm font-bold text-white/70">
              Rank {row?.rank ?? "-"} · {row?.points ?? 0} points
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <Metric label="Today" value={row?.todayPoints ?? 0} />
        <Metric label="Exact" value={row?.exactScores ?? 0} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-wide text-stone-500">
          Picks history
        </h2>
        {matchesWithPicks.map((match) => (
          <MatchRow
            data={data}
            key={match.id}
            match={match}
            predictionLabelPrefix={`${profile.displayName}'s pick`}
            predictionUserId={playerId}
          />
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
