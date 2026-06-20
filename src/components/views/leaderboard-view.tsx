"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, BarChart3, Crown, Minus } from "lucide-react";
import { ClickableAvatar } from "@/components/app/clickable-avatar";
import { ErrorState, LoadingState } from "@/components/app/data-state";
import { PotSummary } from "@/components/app/pot-summary";
import { useBootstrap } from "@/components/app/use-bootstrap";

export function LeaderboardView() {
  const { data, error, isLoading } = useBootstrap();

  if (isLoading || !data) {
    return <LoadingState label="Loading leaderboard" />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg bg-[#022c22] p-4 text-white">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
          Official mode
        </p>
        <h2 className="mt-1 text-2xl font-black capitalize">
          {data.pool.scoringMode} scoring
        </h2>
        <p className="mt-2 text-sm font-bold text-white/70">
          Scores update after finished matches and admin recalculations.
          Ties on points are broken by best streak.
        </p>
        <Link
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-white px-3 text-xs font-black uppercase tracking-wide text-emerald-950"
          href="/stats"
        >
          <BarChart3 size={16} />
          Categories
        </Link>
      </section>

      <PotSummary data={data} />

      <div className="space-y-2">
        {data.leaderboard.map((row) => {
          const detailHref = `/members/${row.userId}`;
          return (
            <div
              className="grid grid-cols-[36px_40px_1fr_auto] items-center gap-3 rounded-lg border border-black/10 bg-white p-3 shadow-sm"
              key={row.userId}
            >
              <Link className="contents" href={detailHref}>
                {row.rank === 1 ? (
                  <Crown
                    aria-label="1st place"
                    className="text-amber-500"
                    fill="currentColor"
                    size={20}
                  />
                ) : (
                  <span className="font-mono text-lg font-black">{row.rank}</span>
                )}
              </Link>
              <ClickableAvatar
                color={row.avatarColor}
                fallbackHref={detailHref}
                imageUrl={row.avatarUrl}
                name={row.displayName}
              />
              {/* display:contents lets these cells flow into the grid while the
                  avatar stays a separate tap target for the photo. */}
              <Link className="contents" href={detailHref}>
                <div className="min-w-0">
                  <p className="truncate font-black">{row.displayName}</p>
                  <p className="text-xs font-bold text-stone-500">
                    Streak {row.currentStreak} · Best {row.longestStreak}
                    {data.pool.scoringMode === "pot" ? ` · Risk ${row.riskyHits}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xl font-black">{row.points}</p>
                  <Movement value={row.movement} />
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Movement({ value }: { value: number }) {
  if (value > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700">
        <ArrowUp size={12} />
        {value}
      </span>
    );
  }

  if (value < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-black text-red-700">
        <ArrowDown size={12} />
        {Math.abs(value)}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-black text-stone-500">
      <Minus size={12} />
      0
    </span>
  );
}
