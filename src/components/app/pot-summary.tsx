"use client";

import { Coins } from "lucide-react";
import { formatKr, getPotInfo } from "@/lib/pool-money";
import type { BootstrapData } from "@/lib/types";

// Shows the running pot (entry fee × members paid). Renders nothing until the
// owner has set an entry fee.
export function PotSummary({ data }: { data: BootstrapData }) {
  const pot = getPotInfo(data);

  if (!pot.configured) {
    return null;
  }

  return (
    <section className="flex items-center gap-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-950 text-white">
        <Coins size={22} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
          Potten
        </p>
        <p className="text-2xl font-black text-emerald-950">{formatKr(pot.pot)}</p>
        <p className="text-sm font-bold text-emerald-800/80">
          {pot.paidCount} av {pot.totalMembers} har betalat · {formatKr(pot.entryFee)}/person
        </p>
      </div>
    </section>
  );
}
