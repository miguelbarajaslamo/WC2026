"use client";

import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Flag } from "@/components/ui/flag";
import { cn } from "@/lib/cn";
import { getSpecialsProgress } from "@/lib/specials";
import { aggregateTopTips } from "@/lib/tips";
import type { BootstrapData } from "@/lib/types";

// Pool consensus on the tournament specials: who picked which Champion, Top
// scorer, etc. Hidden until specials lock (same rule as specials visibility);
// each option's "Picked: N" toggles an inline list of the members below it.
export function TopTips({ data }: { data: BootstrapData }) {
  const locked = getSpecialsProgress(data).locked;
  const categories = useMemo(() => aggregateTopTips(data), [data]);
  const [openRow, setOpenRow] = useState<string | null>(null);

  if (!locked || !categories.some((category) => category.options.length > 0)) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-black uppercase tracking-wide text-stone-500">
        Top tips
      </h2>

      {categories.map((category) => (
        <div
          className="overflow-hidden rounded-lg border border-black/10 bg-white"
          key={category.key}
        >
          <div className="border-b border-black/5 bg-stone-50 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-stone-500">
            {category.label}
          </div>

          {category.options.length === 0 ? (
            <p className="px-3 py-3 text-sm font-bold text-stone-400">No picks.</p>
          ) : (
            category.options.map((option) => {
              const rowKey = `${category.key}:${option.optionId}`;
              const isOpen = openRow === rowKey;
              return (
                <div className="border-b border-black/5 last:border-0" key={rowKey}>
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    {option.iso2 ? (
                      <Flag code={option.iso2} label={option.label} size="sm" />
                    ) : null}
                    <span className="min-w-0 flex-1 truncate font-bold">
                      {option.label}
                    </span>
                    <button
                      aria-expanded={isOpen}
                      className={cn(
                        "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black",
                        isOpen
                          ? "bg-emerald-950 text-white"
                          : "bg-stone-100 text-stone-600",
                      )}
                      onClick={() => setOpenRow(isOpen ? null : rowKey)}
                      type="button"
                    >
                      Picked: {option.count}
                      <ChevronDown
                        className={cn("transition-transform", isOpen && "rotate-180")}
                        size={13}
                      />
                    </button>
                  </div>

                  {isOpen ? (
                    <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                      {option.members.map((member) => (
                        <span
                          className="rounded-full bg-stone-100 px-2 py-1 text-xs font-bold text-stone-700"
                          key={member}
                        >
                          {member}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      ))}
    </section>
  );
}
