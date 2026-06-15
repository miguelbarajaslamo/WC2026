"use client";

import { Trophy } from "lucide-react";

// Placeholder while the knockout bracket is built. The tab that renders this is
// gated to the system admin, so only you can see it for now.
export function FinalsView() {
  return (
    <div className="rounded-lg border border-dashed border-black/20 bg-white p-6 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-950 text-white">
        <Trophy size={22} />
      </div>
      <h2 className="mt-3 font-black">Knockout bracket — under construction</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm font-bold text-stone-500">
        Only visible to you while we build it. The bracket will appear here once
        knockout matchups can be projected from the group standings.
      </p>
    </div>
  );
}
