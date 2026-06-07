"use client";

import { Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { bootstrapQueryKey } from "@/lib/api/bootstrap";
import { getTeam, getUserPrediction, isMatchLocked } from "@/lib/data/selectors";
import type { BootstrapData, Match, PredictionResult } from "@/lib/types";

function scoreResult(homeScore: number, awayScore: number): PredictionResult {
  if (homeScore > awayScore) {
    return "home";
  }

  if (awayScore > homeScore) {
    return "away";
  }

  return "draw";
}

export function PredictionForm({
  data,
  match,
}: {
  data: BootstrapData;
  match: Match;
}) {
  const existing = getUserPrediction(data, match.id);
  const [homeScore, setHomeScore] = useState(existing?.homeScore ?? 1);
  const [awayScore, setAwayScore] = useState(existing?.awayScore ?? 1);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const locked = isMatchLocked(match);
  const home = getTeam(data, match.homeTeamId);
  const away = getTeam(data, match.awayTeamId);
  const result = useMemo(
    () => scoreResult(homeScore, awayScore),
    [awayScore, homeScore],
  );

  async function savePrediction() {
    setSaving(true);
    setMessage("");

    const response = await fetch("/api/predictions", {
      body: JSON.stringify({
        awayScore,
        homeScore,
        matchId: match.id,
        poolId: data.pool.id,
        predictedResult: result,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const body = (await response.json()) as { error?: string };

    setSaving(false);
    if (response.ok) {
      setMessage("Pick saved.");
      void queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
    } else {
      setMessage(body.error ?? "Could not save pick.");
    }
  }

  return (
    <div className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-black">Your prediction</h2>
          <p className="text-sm font-bold text-stone-500">
            {locked ? "Locked for this match" : "Editable until lock"}
          </p>
        </div>
        <span
          className={cn(
            "rounded px-2 py-1 text-xs font-black uppercase",
            locked ? "bg-stone-950 text-white" : "bg-emerald-100 text-emerald-950",
          )}
        >
          {locked ? "Locked" : "Open"}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_72px_72px] items-center gap-2">
        <span className="text-sm font-black">{home.shortName}</span>
        <ScoreControl
          disabled={locked}
          onChange={setHomeScore}
          value={homeScore}
        />
        <span />
        <span className="text-sm font-black">{away.shortName}</span>
        <ScoreControl
          disabled={locked}
          onChange={setAwayScore}
          value={awayScore}
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          ["home", home.shortName],
          ["draw", "Draw"],
          ["away", away.shortName],
        ].map(([value, label]) => (
          <button
            className={cn(
              "h-10 rounded-md border text-xs font-black uppercase",
              result === value
                ? "border-emerald-950 bg-emerald-950 text-white"
                : "border-black/10 bg-stone-50 text-stone-500",
            )}
            disabled
            key={value}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <button
        className="mt-4 h-12 w-full rounded-md bg-stone-950 text-sm font-black uppercase tracking-wide text-white disabled:bg-stone-300 disabled:text-stone-500"
        disabled={locked || saving}
        onClick={savePrediction}
        type="button"
      >
        {saving ? "Saving" : "Save pick"}
      </button>
      {message ? (
        <p className="mt-2 text-xs font-bold text-stone-500">{message}</p>
      ) : null}
    </div>
  );
}

function ScoreControl({
  disabled,
  onChange,
  value,
}: {
  disabled: boolean;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <div className="grid grid-cols-[28px_1fr_28px] overflow-hidden rounded-md border border-black/10 bg-stone-50">
      <button
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
        className="grid h-10 place-items-center disabled:text-stone-300"
        disabled={disabled}
        onClick={() => onChange(Math.min(30, value + 1))}
        type="button"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
