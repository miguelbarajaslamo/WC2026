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

const SIZE_STYLE: Record<"sm" | "md" | "lg", string> = {
  sm: "size-4 text-[8px]",
  md: "size-5 text-[9px]",
  lg: "size-6 text-[10px]",
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
  interactive?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!form || form.length === 0) {
    return interactive ? (
      <span className="text-[11px] font-bold text-white/50">No recent form</span>
    ) : null;
  }

  // World Cup matches get a highlighted edge so they stand out from friendlies.
  const squareClass = (entry: TeamFormEntry) =>
    cn(
      "grid shrink-0 place-items-center rounded font-black text-white",
      SIZE_STYLE[size],
      RESULT_STYLE[entry.result],
      entry.wc && "ring-2 ring-amber-300",
    );

  if (!interactive) {
    return (
      <div className={cn("flex items-center gap-0.5", className)}>
        {form.map((entry, index) => (
          <span
            className={squareClass(entry)}
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
            className={squareClass(entry)}
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            type="button"
          >
            {entry.result}
          </button>
          {openIndex === index ? (
            <div
              className={cn(
                "absolute top-full z-30 mt-1 w-max max-w-[200px] rounded-md bg-white px-2 py-1.5 text-center text-stone-950 shadow-xl",
                index < form.length / 2 ? "left-0" : "right-0",
              )}
            >
              <p className="flex items-center justify-center gap-1.5 text-xs font-black">
                {RESULT_LABEL[entry.result]} {entry.gf}-{entry.ga}
                {entry.wc ? (
                  <span className="rounded bg-amber-300 px-1 py-0.5 text-[9px] font-black uppercase text-stone-950">
                    WC
                  </span>
                ) : null}
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
