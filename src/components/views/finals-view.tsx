"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { ErrorState, LoadingState } from "@/components/app/data-state";
import { Flag } from "@/components/ui/flag";
import { useBootstrap } from "@/components/app/use-bootstrap";
import { type BracketRoundView, projectBracket, type ResolvedSlot } from "@/lib/bracket";
import { cn } from "@/lib/cn";

// Two knockout rounds per page, with an arrow to step to the next pair; each
// page scrolls vertically. Slots that aren't decided yet show their position
// ("1A"), candidate thirds ("3rd A/B/C/D/F"), or "Winner Mxx" — like a normal
// bracket. Admin-gated by its parent while we build it.
const PAGES: Array<[number, number] | [number]> = [[0, 1], [2, 3], [4]];

export function FinalsView() {
  const { data, error, isLoading } = useBootstrap();
  const rounds = useMemo(() => (data ? projectBracket(data) : []), [data]);
  const [page, setPage] = useState(0);

  if (isLoading || !data) {
    return <LoadingState label="Loading bracket" />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  const columns = PAGES[page].map((index) => rounds[index]).filter(Boolean);
  const fromLabel = columns[0]?.title ?? "";
  const toLabel = columns.length > 1 ? columns[columns.length - 1]?.title : "";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <NavButton
          disabled={page === 0}
          icon={<ChevronLeft size={18} />}
          label="Earlier rounds"
          onClick={() => setPage((current) => Math.max(0, current - 1))}
        />
        <p className="min-w-0 truncate text-center text-xs font-black uppercase tracking-wide text-stone-500">
          {toLabel ? `${fromLabel} → ${toLabel}` : fromLabel}
        </p>
        <NavButton
          disabled={page === PAGES.length - 1}
          icon={<ChevronRight size={18} />}
          label="Later rounds"
          onClick={() => setPage((current) => Math.min(PAGES.length - 1, current + 1))}
        />
      </div>

      <div className={cn("grid gap-3", columns.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
        {columns.map((round) => (
          <RoundColumn key={round.round} round={round} />
        ))}
      </div>
    </div>
  );
}

function NavButton({
  disabled,
  icon,
  label,
  onClick,
}: {
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="grid size-9 shrink-0 place-items-center rounded-md border border-black/10 bg-white text-stone-700 shadow-sm disabled:opacity-30"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {icon}
    </button>
  );
}

function RoundColumn({ round }: { round: BracketRoundView }) {
  return (
    <div className="space-y-2">
      <h3 className="text-center text-[11px] font-black uppercase tracking-wide text-stone-500">
        {round.title}
      </h3>
      {round.matches.map((match) => (
        <div
          className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm"
          key={match.matchNo}
        >
          <SlotRow slot={match.home} />
          <div className="border-t border-black/5" />
          <SlotRow slot={match.away} />
        </div>
      ))}
    </div>
  );
}

function SlotRow({ slot }: { slot: ResolvedSlot }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-2">
      {slot.kind === "team" && slot.iso2 ? (
        <Flag code={slot.iso2} label={slot.label} size="sm" />
      ) : (
        <span className="size-4 shrink-0 rounded-sm bg-stone-200" />
      )}
      <span
        className={cn(
          "min-w-0 truncate text-xs",
          slot.kind === "team" ? "font-black" : "font-bold text-stone-400",
        )}
      >
        {slot.label}
      </span>
    </div>
  );
}
