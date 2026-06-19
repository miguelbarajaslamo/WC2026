"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/data-state";
import { Flag } from "@/components/ui/flag";
import { FollowStar } from "@/components/app/follow-star";
import { MatchLineups } from "@/components/views/match-lineups";
import { PredictionForm } from "@/components/app/prediction-form";
import { StatusPill } from "@/components/ui/status-pill";
import { useBootstrap } from "@/components/app/use-bootstrap";
import { cn } from "@/lib/cn";
import { formatLockTime, formatMinute, scoreText } from "@/lib/format";
import {
  getMatch,
  getMatchEvents,
  getMatchPredictions,
  getProfile,
  getTeam,
  isMatchLocked,
} from "@/lib/data/selectors";
import { predictionResultLabel } from "@/lib/predictions";
import { matchUsesScorePrediction } from "@/lib/stages";
import { formatMatchTiming } from "@/lib/time";
import type { MatchEvent } from "@/lib/types";

// Goals and cards only — substitutions and unmapped events (VAR etc., which the
// sync falls back to "goal" with no player) are noise in a picks app.
function eventIcon(event: MatchEvent) {
  if (event.type === "yellow_card") {
    return "🟨";
  }
  if (event.type === "red_card") {
    return "🟥";
  }
  return "⚽";
}

function goalDetail(event: MatchEvent) {
  const detail = event.detail?.toLowerCase() ?? "";
  if (detail.includes("own")) {
    return " (own goal)";
  }
  if (detail.includes("penalty")) {
    return detail.includes("missed") ? " (missed penalty)" : " (penalty)";
  }
  return "";
}

export function MatchDetailView({
  from,
  matchId,
}: {
  from: string;
  matchId: string;
}) {
  const { data, error, isLoading } = useBootstrap();
  const router = useRouter();
  const [tab, setTab] = useState<"lineups" | "overview">("overview");

  if (isLoading || !data) {
    return <LoadingState label="Loading match" />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  const match = getMatch(data, matchId);

  if (!match) {
    return <EmptyState body="This match does not exist in the local data set." title="Match not found" />;
  }

  const home = getTeam(data, match.homeTeamId);
  const away = getTeam(data, match.awayTeamId);
  // Full event list (incl. substitutions) for the lineup badges.
  const allEvents = getMatchEvents(data, match.id);
  // Goals and cards with a named player; substitutions and VAR reversals
  // (disallowed goals, missed penalties) are noise in a picks app.
  const events = allEvents.filter(
    (event) =>
      ["goal", "yellow_card", "red_card"].includes(event.type) &&
      event.playerName &&
      event.playerName.trim(),
  );
  const predictions = getMatchPredictions(data, match.id);
  const locked = isMatchLocked(match);
  const useScore = matchUsesScorePrediction(
    data.pool.scorePredictionStages,
    match.stage,
  );
  const distribution = predictions.reduce(
    (counts, prediction) => {
      counts[prediction.predictedResult] += 1;
      return counts;
    },
    { away: 0, draw: 0, home: 0 },
  );

  return (
    <div className="space-y-4">
      <button
        className="inline-flex h-10 items-center gap-2 rounded-md bg-white px-3 text-sm font-black text-stone-950 shadow-sm ring-1 ring-black/10"
        onClick={() => {
          if (window.history.length > 1) {
            router.back();
            return;
          }

          router.push(from || "/");
        }}
        type="button"
      >
        <ArrowLeft size={17} />
        Back
      </button>

      <section className="rounded-lg bg-[#022c22] p-4 text-white">
        <div className="mb-4 flex items-center justify-between">
          <StatusPill status={match.status} />
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-sm font-black">{formatMinute(match)}</span>
            {match.status !== "finished" && data.authMode !== "demo" ? (
              <FollowStar matchId={match.id} userId={data.currentUserId} />
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
          <Link className="space-y-2" href={`/teams/${home.id}`}>
            <Flag code={home.iso2} label={home.name} size="lg" />
            <p className="text-lg font-black">{home.shortName}</p>
            <p className="truncate text-xs font-bold text-white/60">{home.name}</p>
          </Link>
          <div>
            <p className="font-mono text-4xl font-black">{scoreText(match)}</p>
            <p className="mt-1 text-xs font-black uppercase tracking-wide text-emerald-200">
              {match.groupName ?? match.stage}
            </p>
          </div>
          <Link className="space-y-2" href={`/teams/${away.id}`}>
            <Flag code={away.iso2} label={away.name} size="lg" />
            <p className="text-lg font-black">{away.shortName}</p>
            <p className="truncate text-xs font-bold text-white/60">{away.name}</p>
          </Link>
        </div>
        <p className="mt-4 text-center text-xs font-bold text-white/65">
          {formatMatchTiming({
            kickoffAt: match.kickoffAt,
            lockAt: match.predictionLockAt,
          })} · {match.venue}, {match.city}
        </p>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <button
          aria-pressed={tab === "overview"}
          className={cn(
            "rounded-lg border border-black/10 px-3 py-2 text-sm font-black shadow-sm",
            tab === "overview" ? "bg-emerald-950 text-white" : "bg-white text-stone-950",
          )}
          onClick={() => setTab("overview")}
          type="button"
        >
          Overview
        </button>
        <button
          aria-pressed={tab === "lineups"}
          className={cn(
            "rounded-lg border border-black/10 px-3 py-2 text-sm font-black shadow-sm",
            tab === "lineups" ? "bg-emerald-950 text-white" : "bg-white text-stone-950",
          )}
          onClick={() => setTab("lineups")}
          type="button"
        >
          Line-ups
        </button>
      </div>

      {tab === "lineups" ? (
        <MatchLineups
          away={away}
          events={allEvents}
          home={home}
          isDemo={data.authMode === "demo"}
          matchId={match.id}
        />
      ) : (
        <>
      <PredictionForm data={data} match={match} />

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <h2 className="font-black">Match events</h2>
        {events.length === 0 ? (
          <p className="mt-2 text-sm font-bold text-stone-500">No events reported.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {events.map((event) => {
              const team = getTeam(data, event.teamId);
              return (
                <div
                  className="grid grid-cols-[36px_22px_28px_1fr] items-center gap-2.5 border-b border-black/10 pb-3 last:border-0 last:pb-0"
                  key={event.id}
                >
                  <span className="font-mono text-sm font-black">
                    {event.minute}&apos;
                  </span>
                  <span aria-hidden className="text-base leading-none">
                    {eventIcon(event)}
                  </span>
                  <Flag code={team.iso2} label={team.name} size="sm" />
                  <p className="text-sm font-bold">
                    {event.playerName}
                    {event.type === "goal" ? (
                      <span className="text-stone-500">{goalDetail(event)}</span>
                    ) : null}
                    {event.assistName ? (
                      <span className="block text-xs text-stone-500">
                        Assist: {event.assistName}
                      </span>
                    ) : null}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-black">Pool picks</h2>
          <span className="text-xs font-black uppercase text-stone-500">
            {locked ? "Revealed" : formatLockTime(match.predictionLockAt)}
          </span>
        </div>
        {!locked ? (
          <p className="text-sm font-bold text-stone-500">
            Picks reveal for everyone once the match locks.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <DistributionPill label={home.shortName} value={distribution.home} />
              <DistributionPill label="Draw" value={distribution.draw} />
              <DistributionPill label={away.shortName} value={distribution.away} />
            </div>
            {predictions.map((prediction) => {
              const profile = getProfile(data, prediction.userId);
              const resultLabel = predictionResultLabel({
                awayShortName: away.shortName,
                homeShortName: home.shortName,
                result: prediction.predictedResult,
              });
              return (
                <div
                  className="grid grid-cols-[40px_1fr_auto_auto] items-center gap-3"
                  key={prediction.id}
                >
                  <Avatar
                    color={profile.avatarColor}
                    imageUrl={profile.avatarUrl}
                    name={profile.displayName}
                  />
                  <span className="font-bold">{profile.displayName}</span>
                  <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-black uppercase text-emerald-950">
                    {resultLabel}
                  </span>
                  {/* Score guesses only mean something when the stage scores them. */}
                  {useScore ? (
                    <span className="font-mono text-lg font-black">
                      {prediction.homeScore}-{prediction.awayScore}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
        </>
      )}
    </div>
  );
}

function DistributionPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-stone-100 px-2 py-2 text-center">
      <p className="text-[10px] font-black uppercase tracking-wide text-stone-500">
        {label}
      </p>
      <p className="font-mono text-lg font-black">{value}</p>
    </div>
  );
}
