"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { bootstrapQueryKey } from "@/lib/api/bootstrap";
import { cn } from "@/lib/cn";
import { STAGE_CATEGORIES } from "@/lib/stages";
import type { BootstrapData } from "@/lib/types";

export function ScoringStagesCard({ data }: { data: BootstrapData }) {
  const queryClient = useQueryClient();
  const [stages, setStages] = useState<string[]>(
    data.pool.scorePredictionStages ?? [],
  );
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(next: string[]) {
    setStages(next);
    setSaving(true);
    setMessage("");

    const response = await fetch("/api/admin/scoring-stages", {
      body: JSON.stringify({ poolId: data.pool.id, stages: next }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };

    setSaving(false);
    if (!response.ok) {
      setMessage(body.error ?? "Could not save");
      return;
    }
    setMessage("Saved");
    void queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
  }

  function toggle(key: string) {
    save(
      stages.includes(key)
        ? stages.filter((stage) => stage !== key)
        : [...stages, key],
    );
  }

  return (
    <section className="rounded-lg border border-black/10 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-black">Score prediction by stage</h2>
          <p className="mt-1 text-xs font-bold text-stone-500">
            On = full score prediction. Off = result only (1X2). New picks
            follow this per match stage.
          </p>
        </div>
        {saving ? (
          <span className="text-[10px] font-black uppercase text-stone-400">
            Saving
          </span>
        ) : message ? (
          <span className="text-[10px] font-black uppercase text-emerald-700">
            {message}
          </span>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        {STAGE_CATEGORIES.map((category) => {
          const on = stages.includes(category.key);
          return (
            <button
              aria-pressed={on}
              className="flex w-full items-center justify-between gap-3 rounded-md border border-black/10 bg-stone-50 px-3 py-2.5 text-left"
              key={category.key}
              onClick={() => toggle(category.key)}
              type="button"
            >
              <span className="text-sm font-black">{category.label}</span>
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-[10px] font-black uppercase",
                    on ? "text-emerald-700" : "text-stone-400",
                  )}
                >
                  {on ? "Score" : "1X2"}
                </span>
                <span
                  className={cn(
                    "relative h-4 w-7 rounded-full transition-colors",
                    on ? "bg-emerald-600" : "bg-stone-300",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 size-3 rounded-full bg-white transition-all",
                      on ? "left-3.5" : "left-0.5",
                    )}
                  />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
