"use client";

import { Activity, KeyRound, RotateCw, Shield, Users } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/app/data-state";
import { useBootstrap } from "@/components/app/use-bootstrap";

export function AdminView() {
  const { data, error, isLoading } = useBootstrap();

  if (isLoading || !data) {
    return <LoadingState label="Loading admin" />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg bg-stone-950 p-4 text-white">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
          Admin
        </p>
        <h2 className="mt-1 text-2xl font-black">Control room</h2>
        <p className="mt-2 text-sm font-bold text-white/65">
          Operational tools for sync, scoring, members, and corrections.
        </p>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <AdminCard
          body="Create invites, revoke links, promote admins."
          icon={<Users size={20} />}
          title="Invite management"
        />
        <AdminCard
          body={`Current official mode: ${data.pool.scoringMode}. Lock before tournament start.`}
          icon={<Shield size={20} />}
          title="Scoring mode"
        />
        <AdminCard
          body="Correct score, event, status, lock time, or kickoff changes."
          icon={<KeyRound size={20} />}
          title="Manual overrides"
        />
        <AdminCard
          body="Recalculate snapshots after a final score or correction."
          icon={<RotateCw size={20} />}
          title="Leaderboard recalculation"
        />
      </div>

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <Activity size={19} />
          <h2 className="font-black">Sync status</h2>
        </div>
        <div className="space-y-3">
          {data.syncRuns.map((run) => (
            <div
              className="rounded-md border border-black/10 bg-stone-50 p-3"
              key={run.id}
            >
              <div className="flex items-center justify-between">
                <p className="font-black">{run.source}</p>
                <span className="rounded bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase text-emerald-900">
                  {run.status}
                </span>
              </div>
              <p className="mt-1 text-sm font-bold text-stone-600">{run.message}</p>
              <p className="mt-2 text-xs font-bold text-stone-400">
                Requests used: {run.requestsUsed}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AdminCard({
  body,
  icon,
  title,
}: {
  body: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <button
      className="rounded-lg border border-black/10 bg-white p-4 text-left shadow-sm"
      type="button"
    >
      <span className="mb-3 grid size-10 place-items-center rounded-md bg-emerald-950 text-white">
        {icon}
      </span>
      <span className="block font-black">{title}</span>
      <span className="mt-1 block text-sm font-bold leading-6 text-stone-500">
        {body}
      </span>
    </button>
  );
}
