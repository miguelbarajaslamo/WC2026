"use client";

import { EmptyState, ErrorState, LoadingState } from "@/components/app/data-state";
import { InlinePredictionPicker } from "@/components/app/inline-prediction-picker";
import { MatchRow } from "@/components/app/match-row";
import { useBootstrap } from "@/components/app/use-bootstrap";
import { BonusPicksPanel } from "@/components/views/bonus-picks-panel";
import {
  getMissingUnlockedMatches,
  getUserPrediction,
  getVisibleMatches,
  isMatchLocked,
} from "@/lib/data/selectors";

export function PicksView() {
  const { data, error, isLoading } = useBootstrap();

  if (isLoading || !data) {
    return <LoadingState label="Loading picks" />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  const matches = getVisibleMatches(data);
  const missing = getMissingUnlockedMatches(data);
  const locked = matches.filter((match) => isMatchLocked(match));
  const openWithPick = matches.filter(
    (match) => !isMatchLocked(match) && getUserPrediction(data, match.id),
  );
  const exactHits = data.leaderboard.find((row) => row.userId === data.currentUserId)?.exactScores ?? 0;

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-3 gap-2">
        <Metric label="Missing" value={missing.length} />
        <Metric label="Open picks" value={openWithPick.length} />
        <Metric label="Exact hits" value={exactHits} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-wide text-stone-500">
          Missing picks
        </h2>
        {missing.length === 0 ? (
          <EmptyState body="You are covered for every currently open match." title="No missing picks" />
        ) : (
          missing.map((match) => (
            <InlinePredictionPicker
              compact
              data={data}
              key={match.id}
              match={match}
            />
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-wide text-stone-500">
          Saved and editable
        </h2>
        {openWithPick.map((match) => (
          <InlinePredictionPicker
            compact
            data={data}
            key={match.id}
            match={match}
          />
        ))}
      </section>

      <BonusPicksPanel data={data} />

      <section className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-wide text-stone-500">
          Locked / finished
        </h2>
        {locked.map((match) => (
          <MatchRow data={data} key={match.id} match={match} />
        ))}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-3 text-center">
      <p className="font-mono text-2xl font-black">{value}</p>
      <p className="text-[10px] font-black uppercase tracking-wide text-stone-500">
        {label}
      </p>
    </div>
  );
}
