"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { TeamFormEntry } from "@/lib/types";

const RESULT_STYLE: Record<TeamFormEntry["result"], string> = {
  W: "bg-emerald-600",
  D: "bg-stone-400",
  L: "bg-red-600",
};

const RESULT_LABEL: Record<TeamFormEntry["result"], string> = {
  W: "Win",
  D: "Draw",
  L: "Loss",
};

function summary(entry: TeamFormEntry) {
  return `${RESULT_LABEL[entry.result]} ${entry.gf}-${entry.ga} vs ${entry.opponent}`;
}

export function FormSquares({
  className,
  form,
  interactive = true,
  size = "md",
}: {
  className?: string;
  form?: TeamFormEntry[];
  // interactive = tappable squares with an opponent/score popup (team page).
  // non-interactive = plain coloured squares for dense cards (safe inside links).
  interactive?: boolean;
  size?: "sm" | "md";
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!form || form.length === 0) {
    return interactive ? (
      <span className="text-[11px] font-bold text-white/50">No recent form</span>
    ) : null;
  }

  const box =
    size === "sm" ? "size-4 text-[8px]" : "size-6 text-[10px]";

  if (!interactive) {
    return (
      <div className={cn("flex items-center gap-0.5", className)}>
        {form.map((entry, index) => (
          <span
            className={cn(
              "grid shrink-0 place-items-center rounded font-black text-white",
              box,
              RESULT_STYLE[entry.result],
            )}
            key={`${entry.date}-${index}`}
            title={summary(entry)}
          >
            {entry.result}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {form.map((entry, index) => (
        <div className="relative" key={`${entry.date}-${index}`}>
          <button
            aria-label={summary(entry)}
            className={cn(
              "grid place-items-center rounded font-black text-white",
              box,
              RESULT_STYLE[entry.result],
            )}
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            type="button"
          >
            {entry.result}
          </button>
          {openIndex === index ? (
            <div
              className={cn(
                "absolute top-full z-30 mt-1 w-max max-w-[180px] rounded-md bg-white px-2 py-1.5 text-center text-stone-950 shadow-xl",
                // Anchor early squares left and later ones right so the popup
                // never runs off the screen edge.
                index < form.length / 2 ? "left-0" : "right-0",
              )}
            >
              <p className="text-xs font-black">
                {RESULT_LABEL[entry.result]} {entry.gf}-{entry.ga}
              </p>
              <p className="text-[11px] font-bold text-stone-600">
                vs {entry.opponent}
              </p>
              <p className="text-[10px] font-bold text-stone-400">
                {entry.competition}
              </p>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
