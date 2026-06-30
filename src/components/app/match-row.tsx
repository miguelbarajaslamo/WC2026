"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Flag } from "@/components/ui/flag";
import { FormSquares } from "@/components/app/form-squares";
import { StatusPill } from "@/components/ui/status-pill";
import { formatMinute, scorersSummary, scoreText, teamScoreText } from "@/lib/format";
import {
  getMatchEvents,
  getTeam,
  getUserPrediction,
  isMatchLocked,
} from "@/lib/data/selectors";
import { predictionResultLabel } from "@/lib/predictions";
import { matchUsesScorePrediction } from "@/lib/stages";
import { formatMatchTiming } from "@/lib/time";
import type { BootstrapData, Match } from "@/lib/types";

function TeamLine({
  penaltyScore,
  score,
  team,
}: {
  penaltyScore?: number;
  score?: number;
  team: ReturnType<typeof getTeam>;
}) {
  return (
    <div className="grid grid-cols-[28px_1fr_auto] items-center gap-2">
      <Flag code={team.iso2} label={team.name} />
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="w-9 shrink-0 text-sm font-black">{team.shortName}</span>
        <FormSquares form={team.recentForm} interactive={false} size="sm" />
      </span>
      <span className="font-mono text-base font-black tabular-nums">
        {teamScoreText(score, penaltyScore)}
      </span>
    </div>
  );
}

export function MatchRow({
  data,
  match,
  predictionLabelPrefix = "Your pick",
  predictionUserId,
}: {
  data: BootstrapData;
  match: Match;
  predictionLabelPrefix?: string;
  predictionUserId?: string;
}) {
  const home = getTeam(data, match.homeTeamId);
  const away = getTeam(data, match.awayTeamId);
  const events = getMatchEvents(data, match.id);
  const prediction = getUserPrediction(data, match.id, predictionUserId);
  const locked = isMatchLocked(match);
  const useScore = matchUsesScorePrediction(
    data.pool.scorePredictionStages,
    match.stage,
  );
  const pickLabel = !prediction
    ? "Missing"
    : useScore
      ? `${prediction.homeScore}-${prediction.awayScore}`
      : predictionResultLabel({
          awayShortName: away.shortName,
          homeShortName: home.shortName,
          result: prediction.predictedResult,
        });
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPath = `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}`;
  const matchHref = `/matches/${match.id}?from=${encodeURIComponent(currentPath)}`;

  return (
    <Link
      className="block rounded-lg border border-black/10 bg-white p-3 shadow-sm transition hover:border-emerald-900/30"
      href={matchHref}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-black uppercase tracking-wide text-stone-500">
            {match.groupName ?? match.stage} · {match.city}
          </p>
          <p className="truncate text-xs font-bold text-stone-500">
            {match.status === "scheduled"
              ? formatMatchTiming({
                  kickoffAt: match.kickoffAt,
                  lockAt: match.predictionLockAt,
                })
              : `${formatMatchTiming({ kickoffAt: match.kickoffAt })} · ${scorersSummary(events, data.teams)}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusPill status={match.status} />
          <span className="font-mono text-sm font-black">{formatMinute(match)}</span>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_78px] items-center gap-3">
        <div className="space-y-2">
          <TeamLine
            penaltyScore={match.homePenaltyScore}
            score={match.homeScore}
            team={home}
          />
          <TeamLine
            penaltyScore={match.awayPenaltyScore}
            score={match.awayScore}
            team={away}
          />
        </div>
        <div className="rounded-md bg-stone-100 px-2 py-3 text-center">
          <p className="font-mono text-[15px] font-black tabular-nums">
            {scoreText(match)}
          </p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-stone-500">
            Score
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-black/10 pt-2.5">
        <span className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-[10px] font-black uppercase tracking-wide text-stone-500">
            {predictionLabelPrefix}
          </span>
          <span
            className={`truncate rounded-md px-2.5 py-1 text-sm font-black ${
              prediction
                ? "bg-emerald-100 text-emerald-950"
                : "bg-red-100 text-red-800"
            }`}
          >
            {pickLabel}
          </span>
        </span>
        <span className="shrink-0 text-xs font-black uppercase tracking-wide text-stone-500">
          {locked ? "Locked" : "Open"}
        </span>
      </div>
    </Link>
  );
}
