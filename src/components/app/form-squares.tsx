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

export function FormSquares({
  className,
  form,
}: {
  className?: string;
  form?: TeamFormEntry[];
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!form || form.length === 0) {
    return (
      <span className="text-[11px] font-bold text-white/50">No recent form</span>
    );
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {form.map((entry, index) => (
        <div className="relative" key={`${entry.date}-${index}`}>
          <button
            aria-label={`${RESULT_LABEL[entry.result]} ${entry.gf}-${entry.ga} vs ${entry.opponent}`}
            className={cn(
              "grid size-6 place-items-center rounded text-[10px] font-black text-white",
              RESULT_STYLE[entry.result],
            )}
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            type="button"
          >
            {entry.result}
          </button>
          {openIndex === index ? (
            <div className="absolute left-1/2 top-full z-30 mt-1 w-max max-w-[180px] -translate-x-1/2 rounded-md bg-white px-2 py-1.5 text-center text-stone-950 shadow-xl">
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
