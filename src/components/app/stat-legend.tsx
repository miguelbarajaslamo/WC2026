"use client";

import { Info } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

// Small "ⓘ" button that reveals what the stat abbreviations mean.
export function StatLegend({
  className,
  items,
}: {
  className?: string;
  items: Array<[string, string]>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("relative", className)}>
      <button
        aria-label="What do these letters mean?"
        className="grid size-6 place-items-center rounded-full bg-stone-100 text-stone-500 ring-1 ring-black/5"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <Info size={14} />
      </button>
      {open ? (
        <>
          <button
            aria-hidden
            className="fixed inset-0 z-20 cursor-default"
            onClick={() => setOpen(false)}
            tabIndex={-1}
            type="button"
          />
          <div className="absolute right-0 z-30 mt-1 w-48 rounded-md border border-black/10 bg-white p-2 shadow-xl">
            <p className="mb-1 px-1 text-[10px] font-black uppercase tracking-wide text-stone-400">
              Key
            </p>
            {items.map(([abbr, full]) => (
              <div
                className="flex items-baseline justify-between gap-3 px-1 py-0.5 text-xs"
                key={abbr}
              >
                <span className="font-black text-stone-950">{abbr}</span>
                <span className="text-right font-bold text-stone-500">{full}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
