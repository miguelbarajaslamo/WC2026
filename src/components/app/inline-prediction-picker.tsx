"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { bootstrapQueryKey } from "@/lib/api/bootstrap";
import { Flag } from "@/components/ui/flag";
import { FormSquares } from "@/components/app/form-squares";
import { usePicksSave } from "@/components/app/picks-save-context";
import { cn } from "@/lib/cn";
import { getTeam, getUserPrediction, isMatchLocked } from "@/lib/data/selectors";
import { scoreContradictsAdvancement, scoreResult } from "@/lib/predictions";
import { isKnockoutStage, matchUsesScorePrediction } from "@/lib/stages";
import { formatMatchTiming } from "@/lib/time";
import type {
  BootstrapData,
  Match,
  Prediction,
  PredictionResult,
  Team,
  TeamFormEntry,
} from "@/lib/types";

export function InlinePredictionPicker({
  compact = false,
  data,
  match,
}: {
  compact?: boolean;
  data: BootstrapData;
  match: Match;
}) {
  const existing = getUserPrediction(data, match.id);
  const knockout = isKnockoutStage(match.stage);
  const useScore = matchUsesScorePrediction(
    data.pool.scorePredictionStages,
    match.stage,
  );
  const validExisting =
    knockout && existing?.predictedResult === "draw" ? undefined : existing;
  const existingHasScorePrediction =
    !validExisting || validExisting.scorePredictionEnabled !== false;
  const scoreModeSaved = Boolean(validExisting && existingHasScorePrediction);

  const [homeScore, setHomeScore] = useState(validExisting?.homeScore ?? 0);
  const [awayScore, setAwayScore] = useState(validExisting?.awayScore ?? 0);
  const [result, setResult] = useState<PredictionResult | "">(
    validExisting?.predictedResult ?? "",
  );
  const [lastSavedScore, setLastSavedScore] = useState(
    scoreModeSaved ? `${validExisting?.homeScore}-${validExisting?.awayScore}` : "",
  );
  const [lastSavedResult, setLastSavedResult] = useState<PredictionResult | "">(
    validExisting?.predictedResult ?? "",
  );
  const [hasSaved, setHasSaved] = useState(
    validExisting != null && (!useScore || scoreModeSaved),
  );
  const [saveFailed, setSaveFailed] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const picksSave = usePicksSave();
  const pickerId = useId();
  const locked = isMatchLocked(match);
  const home = getTeam(data, match.homeTeamId);
  const away = getTeam(data, match.awayTeamId);
  const needsAdvancementPick = useScore && knockout;

  const dirty = useScore
    ? `${homeScore}-${awayScore}` !== lastSavedScore ||
      (needsAdvancementPick && result !== lastSavedResult)
    : result !== lastSavedResult;
  const contradictsAdvancement =
    needsAdvancementPick &&
    result !== "" &&
    scoreContradictsAdvancement({
      awayScore,
      homeScore,
      result,
    });
  const hasRequiredResult =
    !knockout || (result !== "" && result !== "draw");
  const canSave =
    dirty &&
    (useScore
      ? (!needsAdvancementPick || hasRequiredResult) && !contradictsAdvancement
      : result !== "" && !(knockout && result === "draw"));
  const predictedResult: PredictionResult = useScore
    ? needsAdvancementPick
      ? result || "draw"
      : scoreResult(homeScore, awayScore)
    : result || "draw";

  async function savePrediction() {
    if (locked || !canSave) {
      return;
    }

    setSaving(true);
    setSaveFailed(false);
    setSaveError(null);
    const previousData = queryClient.getQueryData<BootstrapData>(bootstrapQueryKey);

    const optimisticPrediction: Prediction = {
      id: existing?.id ?? `local-${match.id}-${data.currentUserId}`,
      awayScore: useScore ? awayScore : 0,
      homeScore: useScore ? homeScore : 0,
      matchId: match.id,
      poolId: data.pool.id,
      predictedResult,
      updatedAt: new Date().toISOString(),
      userId: data.currentUserId,
    };

    queryClient.setQueryData<BootstrapData>(bootstrapQueryKey, (current) => {
      if (!current) {
        return current;
      }

      const withoutOld = current.predictions.filter(
        (prediction) =>
          !(
            prediction.matchId === match.id &&
            prediction.userId === current.currentUserId
          ),
      );

      return {
        ...current,
        predictions: [...withoutOld, optimisticPrediction],
      };
    });

    try {
      const response = await fetch("/api/predictions", {
        body: JSON.stringify(
          useScore
            ? {
                awayScore,
                homeScore,
                matchId: match.id,
                poolId: data.pool.id,
                ...(needsAdvancementPick && { result }),
              }
            : { matchId: match.id, poolId: data.pool.id, result },
        ),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        if (previousData) {
          queryClient.setQueryData(bootstrapQueryKey, previousData);
        }
        setSaveFailed(true);
        setSaveError(body?.error ?? "Could not save prediction");
        return;
      }

      setLastSavedScore(`${homeScore}-${awayScore}`);
      setLastSavedResult(needsAdvancementPick ? result : predictedResult);
      setHasSaved(true);
      void queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
    } catch {
      if (previousData) {
        queryClient.setQueryData(bootstrapQueryKey, previousData);
      }
      setSaveFailed(true);
      setSaveError("Could not reach the server");
    } finally {
      setSaving(false);
    }
  }

  // Register with the "Save all" bar (no-op outside the picks list).
  const saveRef = useRef(savePrediction);
  useEffect(() => {
    saveRef.current = savePrediction;
  });
  useEffect(() => {
    if (!picksSave || locked) {
      return;
    }
    picksSave.register(pickerId, {
      dirty: canSave,
      save: () => saveRef.current(),
    });
    return () => picksSave.unregister(pickerId);
  // picksSave omitted: register/unregister are stable; including it re-triggers on every provider render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSave, locked, pickerId]);

  return (
    <div
      className={cn(
        "rounded-lg border border-black/10 bg-white shadow-sm",
        compact ? "p-3" : "p-4",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={cn("font-black", compact ? "text-sm" : "text-base")}>
            {compact
              ? `${home.shortName} vs ${away.shortName}`
              : knockout && !useScore
                ? "Who advances?"
                : "Your prediction"}
          </h2>
          <p className="mt-1 text-xs font-bold text-stone-500">
            {formatMatchTiming({
              kickoffAt: match.kickoffAt,
              lockAt: match.predictionLockAt,
            })}
          </p>
        </div>
        <span
          className={cn(
            "rounded px-2 py-1 text-xs font-black uppercase",
            locked && "bg-stone-950 text-white",
            !locked && dirty && "bg-amber-200 text-stone-950",
            !locked && !dirty && hasSaved && "bg-emerald-100 text-emerald-950",
            !locked && !dirty && !hasSaved && "bg-red-100 text-red-700",
          )}
        >
          {locked
            ? "Locked"
            : saving
              ? "Saving"
              : saveFailed
                ? "Failed"
                : dirty
                  ? "Unsaved"
                  : hasSaved
                    ? "Saved"
                    : "Missing"}
        </span>
      </div>

      {useScore ? (
        <>
          <div className="mt-4 space-y-2">
            <ScoreLine
              disabled={locked}
              form={home.recentForm}
              iso2={home.iso2}
              label={home.shortName}
              onChange={setHomeScore}
              side="home"
              teamName={home.name}
              value={homeScore}
            />
            <ScoreLine
              disabled={locked}
              form={away.recentForm}
              iso2={away.iso2}
              label={away.shortName}
              onChange={setAwayScore}
              side="away"
              teamName={away.name}
              value={awayScore}
            />
          </div>
          {needsAdvancementPick ? (
            <>
              <p className="mt-3 text-[11px] font-black uppercase tracking-wide text-stone-500">
                Who advances?
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <ResultButton
                  disabled={locked}
                  label={home.shortName}
                  onClick={() => setResult("home")}
                  selected={result === "home"}
                  sub="Advances"
                />
                <ResultButton
                  disabled={locked}
                  label={away.shortName}
                  onClick={() => setResult("away")}
                  selected={result === "away"}
                  sub="Advances"
                />
              </div>
              <p
                className={cn(
                  "mt-2 text-xs font-bold",
                  contradictsAdvancement ? "text-red-700" : "text-stone-500",
                )}
              >
                Score is after 120 minutes, excluding penalties.
              </p>
              {contradictsAdvancement ? (
                <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                  Score cannot contradict who advances.
                </p>
              ) : null}
            </>
          ) : null}
        </>
      ) : (
        <>
          <div className="mt-4 space-y-2">
            <TeamFormRow team={home} />
            <TeamFormRow team={away} />
          </div>
          <div className={cn("mt-3 grid gap-2", knockout ? "grid-cols-2" : "grid-cols-3")}>
            <ResultButton
              disabled={locked}
              label={home.shortName}
              onClick={() => setResult("home")}
              selected={result === "home"}
              sub={knockout ? "Advances" : "1"}
            />
            {knockout ? null : (
              <ResultButton
                disabled={locked}
                label="Draw"
                onClick={() => setResult("draw")}
                selected={result === "draw"}
                sub="X"
              />
            )}
            <ResultButton
              disabled={locked}
              label={away.shortName}
              onClick={() => setResult("away")}
              selected={result === "away"}
              sub={knockout ? "Advances" : "2"}
            />
          </div>
        </>
      )}

      {saveError ? (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
          {saveError}
        </p>
      ) : null}

      <button
        className="mt-3 h-11 w-full rounded-md bg-stone-950 text-xs font-black uppercase tracking-wide text-white disabled:bg-stone-300 disabled:text-stone-500"
        disabled={locked || saving || !canSave}
        onClick={savePrediction}
        type="button"
      >
        {saving ? "Saving" : dirty ? "Save pick" : hasSaved ? "Saved" : "Save pick"}
      </button>
    </div>
  );
}

function TeamFormRow({ team }: { team: Team }) {
  return (
    <span className="flex min-w-0 items-center justify-between gap-2 text-sm font-black">
      <span className="flex min-w-0 items-center gap-1.5">
        <Flag code={team.iso2} label={team.name} />
        <span className="truncate" title={team.name}>
          {team.name}
        </span>
      </span>
      <FormSquares className="shrink-0" form={team.recentForm} size="md" />
    </span>
  );
}

function ResultButton({
  disabled,
  label,
  onClick,
  selected,
  sub,
}: {
  disabled: boolean;
  label: string;
  onClick: () => void;
  selected: boolean;
  sub: string;
}) {
  return (
    <button
      aria-pressed={selected}
      className={cn(
        "rounded-md border py-2 text-center",
        selected
          ? "border-emerald-700 bg-emerald-50 text-emerald-900"
          : "border-black/10 bg-stone-50 text-stone-600",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <p className="text-[10px] font-black uppercase tracking-wide text-stone-400">
        {sub}
      </p>
      <p className="truncate text-sm font-black">{label}</p>
    </button>
  );
}

function ScoreLine({
  disabled,
  form,
  iso2,
  label,
  onChange,
  side,
  teamName,
  value,
}: {
  disabled: boolean;
  form?: TeamFormEntry[];
  iso2?: string;
  label: string;
  onChange: (value: number) => void;
  side: "away" | "home";
  teamName: string;
  value: number;
}) {
  return (
    <div className="grid grid-cols-[1fr_104px] items-center gap-2">
      <span className="flex min-w-0 items-center justify-between gap-2 text-sm font-black">
        <span className="flex min-w-0 items-center gap-1.5">
          <Flag code={iso2} label={teamName} />
          <span className="truncate" title={teamName}>
            {teamName}
          </span>
        </span>
        <FormSquares className="shrink-0" form={form} size="md" />
      </span>
      <div className="grid grid-cols-[30px_1fr_30px] overflow-hidden rounded-md border border-black/10 bg-stone-50">
        <button
          aria-label={`Decrease ${label} ${side} score`}
          className="grid h-10 place-items-center disabled:text-stone-300"
          disabled={disabled}
          onClick={() => onChange(Math.max(0, value - 1))}
          type="button"
        >
          <Minus size={14} />
        </button>
        <span className="grid place-items-center font-mono text-lg font-black">
          {value}
        </span>
        <button
          aria-label={`Increase ${label} ${side} score`}
          className="grid h-10 place-items-center disabled:text-stone-300"
          disabled={disabled}
          onClick={() => onChange(Math.min(30, value + 1))}
          type="button"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
