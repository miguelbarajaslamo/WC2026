"use client";

import { useMemo } from "react";
import { ErrorState, LoadingState } from "@/components/app/data-state";
import { Flag } from "@/components/ui/flag";
import { useBootstrap } from "@/components/app/use-bootstrap";
import { type BracketRoundView, projectBracket, type ResolvedSlot } from "@/lib/bracket";
import { cn } from "@/lib/cn";

const ROW_HEIGHT = 56;
const TOTAL_ROWS = 32;
const ROUND_SPAN: Record<BracketRoundView["round"], number> = {
  Final: 32,
  QF: 8,
  R16: 4,
  R32: 2,
  SF: 16,
};

export function FinalsView() {
  const { data, error, isLoading } = useBootstrap();
  const rounds = useMemo(() => (data ? projectBracket(data) : []), [data]);

  if (isLoading || !data) {
    return <LoadingState label="Loading bracket" />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-[#022c22] p-4 text-white">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
          Knockout bracket
        </p>
        <h2 className="mt-1 text-2xl font-black">Finals tree</h2>
        <p className="mt-2 text-sm font-bold text-white/70">
          Projected from current standings until knockout teams are confirmed.
        </p>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-3">
        <div
          className="grid min-w-[1120px] grid-flow-col auto-cols-[176px] gap-12"
          style={{ minHeight: TOTAL_ROWS * ROW_HEIGHT }}
        >
          {rounds.map((round, index) => (
            <RoundColumn
              key={round.round}
              round={round}
              showConnectors={index < rounds.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function RoundColumn({
  round,
  showConnectors,
}: {
  round: BracketRoundView;
  showConnectors: boolean;
}) {
  const span = ROUND_SPAN[round.round];

  return (
    <section className="relative">
      <h3 className="sticky left-0 top-0 z-10 mb-3 bg-[#f4f1ea] py-1 text-center text-[11px] font-black uppercase tracking-wide text-stone-500">
        {round.title}
      </h3>
      <div
        className="relative grid"
        style={{
          gridTemplateRows: `repeat(${TOTAL_ROWS}, ${ROW_HEIGHT}px)`,
          minHeight: TOTAL_ROWS * ROW_HEIGHT,
        }}
      >
        {round.matches.map((match, index) => {
          const start = index * span + 1;

          return (
            <MatchCard
              key={match.matchNo}
              match={match}
              rowSpan={span}
              start={start}
            />
          );
        })}

        {showConnectors ? <Connectors matchCount={round.matches.length} span={span} /> : null}
      </div>
    </section>
  );
}

function MatchCard({
  match,
  rowSpan,
  start,
}: {
  match: BracketRoundView["matches"][number];
  rowSpan: number;
  start: number;
}) {
  return (
    <div
      className="z-10 self-center overflow-hidden rounded-md border border-black/10 bg-white shadow-sm"
      style={{ gridRow: `${start} / span ${rowSpan}` }}
    >
      <div className="border-b border-black/5 bg-stone-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-stone-400">
        M{match.matchNo}
      </div>
      <SlotRow slot={match.home} />
      <div className="border-t border-black/5" />
      <SlotRow slot={match.away} />
    </div>
  );
}

function Connectors({ matchCount, span }: { matchCount: number; span: number }) {
  return (
    <div className="pointer-events-none absolute left-full top-0 h-full w-12">
      {Array.from({ length: Math.floor(matchCount / 2) }, (_, pairIndex) => {
        const firstCenter = (pairIndex * 2 * span + span / 2) * ROW_HEIGHT;
        const secondCenter = ((pairIndex * 2 + 1) * span + span / 2) * ROW_HEIGHT;
        const middle = (firstCenter + secondCenter) / 2;

        return (
          <div key={pairIndex}>
            <ConnectorLine left={0} top={firstCenter} width={24} />
            <ConnectorLine left={0} top={secondCenter} width={24} />
            <div
              className="absolute border-l-2 border-stone-300"
              style={{
                height: secondCenter - firstCenter,
                left: 24,
                top: firstCenter,
              }}
            />
            <ConnectorLine left={24} top={middle} width={24} />
          </div>
        );
      })}
    </div>
  );
}

function ConnectorLine({
  left,
  top,
  width,
}: {
  left: number;
  top: number;
  width: number;
}) {
  return (
    <div
      className="absolute border-t-2 border-stone-300"
      style={{ left, top, width }}
    />
  );
}

function SlotRow({ slot }: { slot: ResolvedSlot }) {
  return (
    <div className="flex min-h-9 items-center gap-1.5 px-2 py-2">
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
