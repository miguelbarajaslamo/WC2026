"use client";

import { Avatar } from "@/components/ui/avatar";
import { MatchRow } from "@/components/app/match-row";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/data-state";
import { useBootstrap } from "@/components/app/use-bootstrap";
import {
  getUserPrediction,
  getVisibleMatches,
  isMatchLocked,
} from "@/lib/data/selectors";
import { specialPoints, specialSlots } from "@/lib/specials";

function actualResult(homeScore: number, awayScore: number) {
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
}

export function MemberDetailView({ userId }: { userId: string }) {
  const { data, error, isLoading } = useBootstrap();

  if (isLoading || !data) {
    return <LoadingState label="Loading member" />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  const profile = data.profiles.find((item) => item.id === userId);
  const row = data.leaderboard.find((item) => item.userId === userId);

  if (!profile) {
    return (
      <EmptyState body="This member is not in the pool." title="Member not found" />
    );
  }

  // Correct picks: member's predictions on finished matches with the right result.
  const finishedById = new Map(
    data.matches
      .filter((match) => match.status === "finished")
      .map((match) => [match.id, match]),
  );
  const correctPicks = data.predictions.filter((prediction) => {
    if (prediction.userId !== userId) {
      return false;
    }
    const match = finishedById.get(prediction.matchId);
    if (!match || match.homeScore == null || match.awayScore == null) {
      return false;
    }
    return (
      prediction.predictedResult === actualResult(match.homeScore, match.awayScore)
    );
  }).length;

  // History = every match that counts for them: any they picked, plus locked
  // matches they missed (no pick), so misses are visible instead of hidden.
  // Future, still-open matches aren't shown — they aren't missed yet.
  const history = getVisibleMatches(data).filter(
    (match) =>
      getUserPrediction(data, match.id, userId) || isMatchLocked(match),
  );

  const specials = specialSlots.map((slot) => {
    const pick = data.bonusPicks.find(
      (item) =>
        item.userId === userId &&
        item.type === slot.type &&
        item.slot === slot.slot,
    );
    const option = pick
      ? data.bonusPickOptions.find((item) => item.id === pick.optionId)
      : undefined;
    const score = data.bonusScoreSnapshots.find(
      (item) =>
        item.userId === userId &&
        item.type === slot.type &&
        item.slot === slot.slot,
    );
    return { label: slot.label, option, score, type: slot.type };
  });
  const specialsFilled = specials.filter((item) => item.option).length;

  return (
    <div className="space-y-4">
      <section className="rounded-lg bg-[#022c22] p-4 text-white">
        <div className="flex items-center gap-3">
          <Avatar
            color={profile.avatarColor}
            imageUrl={profile.avatarUrl}
            name={profile.displayName}
            size="lg"
          />
          <div>
            <h2 className="text-2xl font-black">{profile.displayName}</h2>
            <p className="text-sm font-bold text-white/70">
              Rank {row?.rank ?? "-"} · {row?.points ?? 0} points
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-4 gap-2">
        <Metric label="Points" value={row?.points ?? 0} />
        <Metric label="Correct" value={correctPicks} />
        <Metric label="Exact" value={row?.exactScores ?? 0} />
        <Metric label="Specials" value={`${specialsFilled}/${specialSlots.length}`} />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-black uppercase tracking-wide text-stone-500">
          Tournament specials
        </h2>
        <div className="overflow-hidden rounded-lg border border-black/10 bg-white">
          {specials.map((item) => (
            <div
              className="flex items-center justify-between gap-3 border-b border-black/5 p-3 last:border-0"
              key={`${item.type}-${item.label}`}
            >
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-wide text-stone-400">
                  {item.label}
                </p>
                <p className="truncate font-bold">
                  {item.option ? item.option.label : "Hidden until lock"}
                </p>
              </div>
              {item.score ? (
                <span className="shrink-0 rounded bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-900">
                  +{item.score.points}
                </span>
              ) : (
                <span className="shrink-0 text-xs font-bold text-stone-400">
                  {specialPoints[item.type]} pts
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-wide text-stone-500">
          Picks history
        </h2>
        {history.length === 0 ? (
          <EmptyState
            body="No locked matches to show yet."
            title="Nothing here yet"
          />
        ) : (
          history.map((match) => (
            <MatchRow
              data={data}
              key={match.id}
              match={match}
              predictionLabelPrefix={`${profile.displayName}'s pick`}
              predictionUserId={userId}
            />
          ))
        )}
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-3 text-center">
      <p className="font-mono text-xl font-black">{value}</p>
      <p className="text-[10px] font-black uppercase tracking-wide text-stone-500">
        {label}
      </p>
    </div>
  );
}
