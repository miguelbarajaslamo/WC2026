"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { ErrorState, LoadingState } from "@/components/app/data-state";
import { useBootstrap } from "@/components/app/use-bootstrap";
import { getProfile } from "@/lib/data/selectors";

export function PoolView() {
  const { data, error, isLoading } = useBootstrap();

  if (isLoading || !data) {
    return <LoadingState label="Loading pool" />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg bg-[#022c22] p-4 text-white">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
          Private pool
        </p>
        <h2 className="mt-1 text-2xl font-black">{data.pool.name}</h2>
        <p className="mt-2 text-sm font-bold text-white/70">{data.pool.prizeNote}</p>
      </section>

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <h2 className="font-black">Rules</h2>
        <div className="mt-3 space-y-3 text-sm font-bold text-stone-600">
          <p>Picks lock {data.pool.lockMinutesBeforeKickoff} minutes before kickoff.</p>
          <p>Other players&apos; picks reveal when the match locks.</p>
          <p>
            Traditional scoring: correct winner or draw gives 3 points. Exact
            score adds 3 more, for 6 total.
          </p>
          <p>
            Pot scoring, if selected before lock, splits the match pot among
            correct result picks and adds a 2 point exact-score bonus.
          </p>
          <p>Official scoring mode: {data.pool.scoringMode}.</p>
          <p>
            Tournament specials lock before the first kickoff
            {data.pool.bonusLockAt ? ` (${new Date(data.pool.bonusLockAt).toLocaleString()})` : ""}.
          </p>
          <p>Saved early picks count if you miss the deadline.</p>
        </div>
      </section>

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <h2 className="font-black">Members</h2>
        <div className="mt-3 space-y-3">
          {data.members.map((member) => {
            const profile = getProfile(data, member.userId);
            return (
              <Link
                className="grid grid-cols-[40px_1fr_auto_16px] items-center gap-3 rounded-md p-1 -m-1 hover:bg-stone-50"
                href={`/members/${member.userId}`}
                key={member.userId}
              >
                <Avatar
                  color={profile.avatarColor}
                  imageUrl={profile.avatarUrl}
                  name={profile.displayName}
                />
                <span className="font-bold">{profile.displayName}</span>
                <span className="rounded bg-stone-100 px-2 py-1 text-[10px] font-black uppercase text-stone-500">
                  {member.role}
                </span>
                <ChevronRight className="text-stone-300" size={16} />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <h2 className="font-black">Install app</h2>
        <p className="mt-2 text-sm font-bold leading-6 text-stone-600">
          iPhone: Share, Add to Home Screen. Android: browser menu, Install app.
          The PWA opens without the normal browser chrome once installed.
        </p>
      </section>
    </div>
  );
}
