"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { bootstrapQueryKey } from "@/lib/api/bootstrap";
import { cn } from "@/lib/cn";
import {
  getSpecialsProgress,
  specialLabels,
  specialPoints,
  specialSlots,
} from "@/lib/specials";
import type { BonusPick, BonusPickType, BootstrapData } from "@/lib/types";

export function BonusPicksPanel({ data }: { data: BootstrapData }) {
  const progress = getSpecialsProgress(data);

  return (
    <section className="space-y-3 scroll-mt-24" id="tournament-specials">
      <div className="rounded-lg bg-[#022c22] p-4 text-white">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
          Tournament specials
        </p>
        <h2 className="mt-1 text-2xl font-black">
          {progress.completed}/{progress.total} filled
        </h2>
        <p className="mt-2 text-sm font-bold text-white/65">
          {progress.locked
            ? "Locked for the tournament."
            : `Locks in ${progress.lockCountdown || "soon"}. These score separately.`}
        </p>
      </div>

      <div className="space-y-3">
        {specialSlots.map((row) => (
          <BonusPickRow
            data={data}
            key={`${row.type}-${row.slot}`}
            label={row.label}
            locked={progress.locked}
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
  locked,
  slot,
  type,
}: {
  data: BootstrapData;
  label?: string;
  locked: boolean;
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
  const existingOption = options.find((option) => option.id === existing?.optionId);
  const [query, setQuery] = useState(existingOption?.label ?? "");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(existing ? "Saved" : "Missing");
  const dirty = optionId !== (existing?.optionId ?? "");

  const trimmedQuery = query.trim().toLowerCase();
  const filtered = (
    trimmedQuery
      ? options.filter((option) => option.label.toLowerCase().includes(trimmedQuery))
      : options
  ).slice(0, 50);

  async function save() {
    const selectedOption = options.find((option) => option.id === optionId);

    if (!selectedOption || locked) {
      return;
    }

    setMessage("Saving");
    const previousData = queryClient.getQueryData<BootstrapData>(bootstrapQueryKey);
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

    try {
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

      if (!response.ok) {
        if (previousData) {
          queryClient.setQueryData(bootstrapQueryKey, previousData);
        }
        setMessage(body.error ?? "Save failed");
        return;
      }

      setMessage("Saved");
      void queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
    } catch {
      if (previousData) {
        queryClient.setQueryData(bootstrapQueryKey, previousData);
      }
      setMessage("Save failed");
    }
  }

  return (
    <div className="rounded-lg border border-black/10 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-black">{label ?? specialLabels[type]}</p>
          <p className="text-xs font-bold text-stone-500">
            {specialPoints[type]} pts
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
          {locked ? "Locked" : dirty ? "Unsaved" : message}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_76px] items-start gap-2">
        <div className="relative">
          <input
            className="h-11 w-full min-w-0 rounded-md border border-black/10 bg-stone-50 px-3 text-sm font-bold outline-none focus:border-emerald-700"
            disabled={locked}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);
              setOpen(true);
              const exact = options.find(
                (option) => option.label.toLowerCase() === nextQuery.trim().toLowerCase(),
              );
              setOptionId(exact?.id ?? "");
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search by name…"
            value={query}
          />
          {open && !locked ? (
            <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-black/10 bg-white py-1 shadow-xl">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm font-bold text-stone-400">
                  No matches
                </li>
              ) : (
                filtered.map((option) => (
                  <li key={option.id}>
                    <button
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-bold hover:bg-stone-100",
                        option.id === optionId && "bg-emerald-50 text-emerald-950",
                      )}
                      // onMouseDown (not onClick) so selection fires before the
                      // input's onBlur closes the list.
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setOptionId(option.id);
                        setQuery(option.label);
                        setOpen(false);
                      }}
                      type="button"
                    >
                      {option.label}
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
        <button
          className="h-11 rounded-md bg-stone-950 text-xs font-black uppercase text-white disabled:bg-stone-300 disabled:text-stone-500"
          disabled={locked || !dirty || !optionId}
          onClick={save}
          type="button"
        >
          Save
        </button>
      </div>
    </div>
  );
}
