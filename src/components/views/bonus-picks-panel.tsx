"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { bootstrapQueryKey } from "@/lib/api/bootstrap";
import { cn } from "@/lib/cn";
import type { BonusPick, BonusPickType, BootstrapData } from "@/lib/types";

const bonusLabels: Record<BonusPickType, string> = {
  champion: "Champion",
  finalist: "Finalist",
  golden_glove: "Golden glove",
  most_assists: "Most assists",
  top_scorer: "Top scorer",
};

const bonusPoints: Record<BonusPickType, number> = {
  champion: 10,
  finalist: 5,
  golden_glove: 6,
  most_assists: 6,
  top_scorer: 8,
};

const orderedRows: Array<{ label?: string; slot: number; type: BonusPickType }> = [
  { slot: 1, type: "champion" },
  { label: "Finalist 1", slot: 1, type: "finalist" },
  { label: "Finalist 2", slot: 2, type: "finalist" },
  { slot: 1, type: "top_scorer" },
  { slot: 1, type: "most_assists" },
  { slot: 1, type: "golden_glove" },
];

export function BonusPicksPanel({ data }: { data: BootstrapData }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-black uppercase tracking-wide text-stone-500">
          Tournament specials
        </h2>
        <p className="mt-1 text-xs font-bold text-stone-500">
          These lock before the first match starts and score separately.
        </p>
      </div>

      <div className="space-y-3">
        {orderedRows.map((row) => (
          <BonusPickRow
            data={data}
            key={`${row.type}-${row.slot}`}
            label={row.label}
            slot={row.slot}
            type={row.type}
          />
        ))}
      </div>
    </section>
  );
}

function BonusPickRow({
  data,
  label,
  slot,
  type,
}: {
  data: BootstrapData;
  label?: string;
  slot: number;
  type: BonusPickType;
}) {
  const queryClient = useQueryClient();
  const existing = data.bonusPicks.find(
    (pick) =>
      pick.userId === data.currentUserId &&
      pick.type === type &&
      pick.slot === slot,
  );
  const options = data.bonusPickOptions.filter((option) => option.type === type);
  const [optionId, setOptionId] = useState(existing?.optionId ?? "");
  const [message, setMessage] = useState(existing ? "Saved" : "Missing");
  const dirty = optionId !== (existing?.optionId ?? "");

  async function save() {
    if (!optionId) {
      return;
    }

    setMessage("Saving");
    const optimisticPick: BonusPick = {
      id: existing?.id ?? `local-bonus-${type}-${data.currentUserId}`,
      optionId,
      poolId: data.pool.id,
      slot,
      type,
      updatedAt: new Date().toISOString(),
      userId: data.currentUserId,
    };

    queryClient.setQueryData<BootstrapData>(bootstrapQueryKey, (current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        bonusPicks: [
          ...current.bonusPicks.filter(
            (pick) =>
              !(
                pick.userId === current.currentUserId &&
                pick.type === type &&
                pick.slot === slot
              ),
          ),
          optimisticPick,
        ],
      };
    });

    const response = await fetch("/api/bonus-picks", {
      body: JSON.stringify({
        optionId,
        poolId: data.pool.id,
        slot,
        type,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const body = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? "Saved"
        : body.error === "Not authenticated"
          ? "Saved locally"
          : body.error ?? "Save failed",
    );
  }

  return (
    <div className="rounded-lg border border-black/10 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-black">{label ?? bonusLabels[type]}</p>
          <p className="text-xs font-bold text-stone-500">
            {bonusPoints[type]} pts
          </p>
        </div>
        <span
          className={cn(
            "rounded px-2 py-1 text-[10px] font-black uppercase",
            dirty && "bg-amber-200 text-stone-950",
            !dirty && optionId && "bg-emerald-100 text-emerald-950",
            !optionId && "bg-red-100 text-red-800",
          )}
        >
          {dirty ? "Unsaved" : message}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_76px] gap-2">
        <select
          className="h-11 min-w-0 rounded-md border border-black/10 bg-stone-50 px-3 text-sm font-bold"
          onChange={(event) => setOptionId(event.target.value)}
          value={optionId}
        >
          <option value="">Choose</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          className="rounded-md bg-stone-950 text-xs font-black uppercase text-white disabled:bg-stone-300 disabled:text-stone-500"
          disabled={!dirty || !optionId}
          onClick={save}
          type="button"
        >
          Save
        </button>
      </div>
    </div>
  );
}
