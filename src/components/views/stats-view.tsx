"use client";

import { Activity, Goal, Handshake, ShieldAlert } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/data-state";
import { useBootstrap } from "@/components/app/use-bootstrap";
import { Flag } from "@/components/ui/flag";
import { formatLocalDateTime } from "@/lib/time";
import type {
  CountryCardCategoryRow,
  PlayerCategoryRow,
} from "@/lib/types";

export function StatsView() {
  const { data, error, isLoading } = useBootstrap();

  if (isLoading || !data) {
    return <LoadingState label="Loading stats" />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg bg-[#022c22] p-4 text-white">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
          Categories
        </p>
        <h2 className="mt-1 text-2xl font-black">Tournament leaders</h2>
        <p className="mt-2 text-sm font-bold text-white/70">
          Top 10 only. Ties share the same rank.
        </p>
      </section>

      <PlayerBoard
        emptyLabel="No goals tracked yet."
        icon={<Goal size={18} />}
        rows={data.categoryLeaderboards.topScorers}
        title="Top scorers"
        valueLabel="goals"
      />

      <PlayerBoard
        emptyLabel="No assists tracked yet."
        icon={<Handshake size={18} />}
        rows={data.categoryLeaderboards.topAssists}
        title="Top assists"
        valueLabel="assists"
      />

      <CountryCardBoard rows={data.categoryLeaderboards.countryCardPoints} />
    </div>
  );
}

function PlayerBoard({
  emptyLabel,
  icon,
  rows,
  title,
  valueLabel,
}: {
  emptyLabel: string;
  icon: React.ReactNode;
  rows: PlayerCategoryRow[];
  title: string;
  valueLabel: string;
}) {
  return (
    <section className="space-y-2">
      <SectionTitle icon={icon} title={title} />
      {rows.length === 0 ? (
        <EmptyState body={emptyLabel} title="Waiting on match data" />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              className="grid grid-cols-[32px_1fr_auto] items-center gap-3 rounded-lg border border-black/10 bg-white p-3 shadow-sm"
              key={`${row.rank}-${row.teamId}-${row.playerName}`}
            >
              <span className="font-mono text-lg font-black tabular-nums">
                {row.rank}
              </span>
              <div className="min-w-0">
                <p className="truncate font-black">{row.playerName}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Flag
                    code={row.iso2}
                    label={row.teamName ?? row.teamShortName ?? "Team"}
                    size="sm"
                  />
                  <span className="truncate text-xs font-bold text-stone-500">
                    {row.teamShortName ?? row.teamName ?? "Team"}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-xl font-black tabular-nums">
                  {row.value}
                </p>
                <p className="text-[10px] font-black uppercase tracking-wide text-stone-500">
                  {valueLabel}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CountryCardBoard({ rows }: { rows: CountryCardCategoryRow[] }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle icon={<ShieldAlert size={18} />} title="Country card points" />
        <span className="rounded bg-stone-200 px-2 py-1 text-[10px] font-black uppercase text-stone-700">
          Y 1 · R 2
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState body="No country card points tracked yet." title="Waiting on cards" />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              className="rounded-lg border border-black/10 bg-white p-3 shadow-sm"
              key={`${row.rank}-${row.teamId}`}
            >
              <div className="grid grid-cols-[32px_1fr_auto] items-center gap-3">
                <span className="font-mono text-lg font-black tabular-nums">
                  {row.rank}
                </span>
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <Flag code={row.iso2} label={row.teamName} size="md" />
                    <p className="truncate font-black">{row.teamName}</p>
                  </div>
                  <p className="mt-1 truncate text-xs font-bold text-stone-500">
                    {row.yellowCards} yellow · {row.redCards} red
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xl font-black tabular-nums">
                    {row.points}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-wide text-stone-500">
                    pts
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 border-t border-black/10 pt-3 text-xs font-bold text-stone-500">
                <Activity size={14} />
                <span className="truncate">
                  {row.updatedAt
                    ? `Fresh ${formatLocalDateTime(row.updatedAt)}`
                    : "Freshness pending"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SectionTitle({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 text-stone-950">
      <span className="grid size-8 place-items-center rounded-md bg-emerald-950 text-white">
        {icon}
      </span>
      <h2 className="text-sm font-black uppercase tracking-wide text-stone-500">
        {title}
      </h2>
    </div>
  );
}
