"use client";

import { Check, Copy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Countdown } from "@/components/app/countdown";
import { Section } from "@/components/ui/section";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/data-state";
import { MatchRow } from "@/components/app/match-row";
import { TournamentSpecialsBanner } from "@/components/app/tournament-specials-banner";
import { useBootstrap } from "@/components/app/use-bootstrap";
import {
  getMissingPicksWithinDays,
  getVisibleMatches,
} from "@/lib/data/selectors";
import { formatKr, shouldNudgeSwish } from "@/lib/pool-money";
import { DEFAULT_WARNING_DAYS, getWarningDays } from "@/lib/preferences";
import { getLocalTimeZone, getNextLockMatch } from "@/lib/time";
import type { BootstrapData } from "@/lib/types";

export function TodayView() {
  const { data, error, isLoading, isFetching } = useBootstrap();
  const [warningDays, setWarningDays] = useState(DEFAULT_WARNING_DAYS);
  // Read the per-device preference after mount (avoids SSR/hydration mismatch).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setWarningDays(getWarningDays()), []);

  if (isLoading || !data) {
    return <LoadingState label="Loading tournament data" />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  const matches = getVisibleMatches(data);
  const liveMatches = matches.filter((match) =>
    ["live", "halftime"].includes(match.status),
  );
  const upcoming = matches.filter((match) => match.status === "scheduled").slice(0, 4);
  const finished = matches.filter((match) => match.status === "finished").slice(0, 3);
  const missing = getMissingPicksWithinDays(data, warningDays);
  const nextLock = getNextLockMatch(data);
  const currentRank = data.leaderboard.find(
    (row) => row.userId === data.currentUserId,
  )?.rank;

  return (
    <div className="space-y-5">
      <section className="rounded-lg bg-[#022c22] p-4 text-white shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
              Pool status
            </p>
            <h2 className="mt-1 text-2xl font-black">{data.pool.name}</h2>
            <p className="mt-2 text-sm font-bold text-white/70">
              {isFetching ? "Refreshing in background" : "Data cached and ready"}
            </p>
          </div>
          {nextLock ? (
            <Countdown label="Next lock" target={nextLock.predictionLockAt} />
          ) : (
            <div className="rounded-md bg-white px-3 py-2 text-right text-stone-950">
              <p className="font-mono text-xl font-black">
                {currentRank ?? "-"}
              </p>
              <p className="text-[10px] font-black uppercase tracking-wide text-stone-500">
                Your rank
              </p>
            </div>
          )}
        </div>
        <p className="mt-3 text-xs font-bold text-white/55">
          Times shown in your device timezone: {getLocalTimeZone()}
        </p>
      </section>

      <SwishReminder data={data} />

      <TournamentSpecialsBanner data={data} />

      {missing.length > 0 ? (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-stone-950">Missing picks soon</h2>
              <p className="mt-1 text-sm font-bold text-stone-600">
                {missing.length} match{missing.length === 1 ? "" : "es"} in the next{" "}
                {warningDays} day{warningDays === 1 ? "" : "s"} need a pick.
              </p>
            </div>
            <Link
              className="rounded-md bg-stone-950 px-3 py-2 text-xs font-black uppercase text-white"
              href="/picks"
            >
              Fill
            </Link>
          </div>
        </section>
      ) : null}

      <Section title="Live now">
        {liveMatches.length > 0 ? (
          <div className="space-y-3">
            {liveMatches.map((match) => (
              <MatchRow data={data} key={match.id} match={match} />
            ))}
          </div>
        ) : (
          <EmptyState
            body="When a match is live, this section becomes the fastest route into score, events, and locked picks."
            title="No live matches"
          />
        )}
      </Section>

      <Section
        action={
          <Link className="text-xs font-black uppercase text-emerald-900" href="/fixtures">
            All fixtures
          </Link>
        }
        title="Upcoming"
      >
        <div className="space-y-3">
          {upcoming.map((match) => (
            <MatchRow data={data} key={match.id} match={match} />
          ))}
        </div>
      </Section>

      <Section title="Finished today">
        <div className="space-y-3">
          {finished.map((match) => (
            <MatchRow data={data} key={match.id} match={match} />
          ))}
        </div>
      </Section>
    </div>
  );
}

// "Swish the entry fee" nudge — shown only to members who aren't marked paid,
// and only until the first match locks (the pay-by deadline).
function SwishReminder({ data }: { data: BootstrapData }) {
  const [copied, setCopied] = useState(false);
  const { entryFee, swishNumber } = data.pool;

  if (!shouldNudgeSwish(data)) {
    return null;
  }

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(swishNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the number is shown anyway.
    }
  }

  return (
    <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <h2 className="font-black text-stone-950">Betala insatsen</h2>
      <p className="mt-1 text-sm font-bold text-stone-600">
        Swisha {formatKr(entryFee)} till numret nedan innan första matchen låser.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <span className="flex-1 rounded-md border border-amber-300 bg-white px-3 py-2 font-mono text-lg font-black tracking-wide text-stone-950">
          {swishNumber}
        </span>
        <button
          className="grid h-11 w-12 shrink-0 place-items-center rounded-md bg-stone-950 text-white"
          onClick={() => void copyNumber()}
          type="button"
        >
          {copied ? <Check size={18} /> : <Copy size={18} />}
        </button>
      </div>
      <p className="mt-2 text-xs font-bold text-stone-500">
        Pool-värden bockar av dig när betalningen kommit in.
      </p>
    </section>
  );
}
