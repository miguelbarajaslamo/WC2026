"use client";

import { Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { bootstrapQueryKey } from "@/lib/api/bootstrap";
import { cn } from "@/lib/cn";
import { getTeam, getUserPrediction, isMatchLocked } from "@/lib/data/selectors";
import { scoreResult } from "@/lib/predictions";
import { formatMatchTiming } from "@/lib/time";
import type { BootstrapData, Match, Prediction } from "@/lib/types";

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
  const [homeScore, setHomeScore] = useState(existing?.homeScore ?? 0);
  const [awayScore, setAwayScore] = useState(existing?.awayScore ?? 0);
  const [lastSavedScore, setLastSavedScore] = useState(
    existing ? `${existing.homeScore}-${existing.awayScore}` : "",
  );
  const [message, setMessage] = useState(existing ? "Saved" : "Not saved");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const locked = isMatchLocked(match);
  const home = getTeam(data, match.homeTeamId);
  const away = getTeam(data, match.awayTeamId);
  const result = useMemo(
    () => scoreResult(homeScore, awayScore),
    [awayScore, homeScore],
  );
  const dirty = `${homeScore}-${awayScore}` !== lastSavedScore;

  async function savePrediction() {
    if (locked) {
      return;
    }

    setSaving(true);
    setMessage("Saving");
    const previousData = queryClient.getQueryData<BootstrapData>(bootstrapQueryKey);

    const optimisticPrediction: Prediction = {
      id: existing?.id ?? `local-${match.id}-${data.currentUserId}`,
      awayScore,
      homeScore,
      matchId: match.id,
      poolId: data.pool.id,
      predictedResult: result,
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
        body: JSON.stringify({
          awayScore,
          homeScore,
          matchId: match.id,
          poolId: data.pool.id,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        if (previousData) {
          queryClient.setQueryData(bootstrapQueryKey, previousData);
        }
        setMessage(body.error ?? "Save failed");
        return;
      }

      setLastSavedScore(`${homeScore}-${awayScore}`);
      setMessage("Saved");
      void queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
    } catch {
      if (previousData) {
        queryClient.setQueryData(bootstrapQueryKey, previousData);
      }
      setMessage("Save failed");
    } finally {
      setSaving(false);
    }
  }

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
            {compact ? `${home.shortName} vs ${away.shortName}` : "Your prediction"}
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
            dirty && !locked && "bg-amber-200 text-stone-950",
            !dirty && !locked && "bg-emerald-100 text-emerald-950",
            locked && "bg-stone-950 text-white",
          )}
        >
          {locked ? "Locked" : dirty ? "Unsaved" : message}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_72px] gap-3">
        <div className="space-y-2">
          <ScoreLine
            disabled={locked}
            label={home.shortName}
            onChange={setHomeScore}
            side="home"
            value={homeScore}
          />
          <ScoreLine
            disabled={locked}
            label={away.shortName}
            onChange={setAwayScore}
            side="away"
            value={awayScore}
          />
        </div>
        <div className="grid place-items-center rounded-md bg-stone-100 px-2 text-center">
          <p className="text-[10px] font-black uppercase tracking-wide text-stone-500">
            Pick
          </p>
          <p className="font-mono text-lg font-black">
            {homeScore}-{awayScore}
          </p>
          <p className="text-[10px] font-black uppercase text-stone-400">
            {locked ? "Locked" : "Score"}
          </p>
        </div>
      </div>

      <button
        className="mt-3 h-11 w-full rounded-md bg-stone-950 text-xs font-black uppercase tracking-wide text-white disabled:bg-stone-300 disabled:text-stone-500"
        disabled={locked || saving || !dirty}
        onClick={savePrediction}
        type="button"
      >
        {saving ? "Saving" : dirty ? "Save pick" : "Saved"}
      </button>
    </div>
  );
}

function ScoreLine({
  disabled,
  label,
  onChange,
  side,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: number) => void;
  side: "away" | "home";
  value: number;
}) {
  return (
    <div className="grid grid-cols-[1fr_104px] items-center gap-2">
      <span className="truncate text-sm font-black">{label}</span>
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
