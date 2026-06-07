"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";
import { getSpecialsProgress } from "@/lib/specials";
import type { BootstrapData } from "@/lib/types";

export function TournamentSpecialsBanner({ data }: { data: BootstrapData }) {
  const progress = getSpecialsProgress(data);

  if (progress.locked || progress.isComplete) {
    return null;
  }

  return (
    <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-amber-300 text-stone-950">
            <Trophy size={19} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-black text-stone-950">
              Tournament specials {progress.completed}/{progress.total}
            </h2>
            <p className="mt-1 truncate text-xs font-bold text-stone-600">
              Locks in {progress.lockCountdown || "soon"}
            </p>
          </div>
        </div>
        <Link
          className="shrink-0 rounded-md bg-stone-950 px-3 py-2 text-xs font-black uppercase text-white"
          href="/picks#tournament-specials"
        >
          Fill
        </Link>
      </div>
    </section>
  );
}
