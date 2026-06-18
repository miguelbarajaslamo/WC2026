"use client";

import {
  Activity,
  ChevronDown,
  Flame,
  Goal,
  Handshake,
  ShieldAlert,
  Trophy,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/data-state";
import { useBootstrap } from "@/components/app/use-bootstrap";
import { Flag } from "@/components/ui/flag";
import { cn } from "@/lib/cn";
import { getSpecialsProgress } from "@/lib/specials";
import {
  buildSpecialPickers,
  type SpecialPickers,
  specialPlayerKey,
  specialTeamKey,
} from "@/lib/tips";
import { formatLocalDateTime } from "@/lib/time";
import type {
  BonusPickType,
  CountryCardCategoryRow,
  PlayerCategoryRow,
  UserStreakCategoryRow,
} from "@/lib/types";

export function StatsView() {
  const { data, error, isLoading } = useBootstrap();
  // Who picked each player/country as a special — revealed only after lock.
  const pickers = useMemo(() => (data ? buildSpecialPickers(data) : new Map()), [data]);
  const [openKey, setOpenKey] = useState<string | null>(null);

  if (isLoading || !data) {
    return <LoadingState label="Loading stats" />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  const specialsLocked = getSpecialsProgress(data).locked;
  const shared = { openKey, pickers, revealPickers: specialsLocked, setOpenKey };

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
        specialType="top_scorer"
        title="Top scorers"
        valueLabel="goals"
        {...shared}
      />

      <PlayerBoard
        emptyLabel="No assists tracked yet."
        icon={<Handshake size={18} />}
        rows={data.categoryLeaderboards.topAssists}
        specialType="most_assists"
        title="Top assists"
        valueLabel="assists"
        {...shared}
      />

      <CountryCardBoard
        rows={data.categoryLeaderboards.countryCardPoints}
        {...shared}
      />

      <StreakBoard rows={data.categoryLeaderboards.userStreaks} />
    </div>
  );
}

type SharedPickerProps = {
  openKey: string | null;
  pickers: SpecialPickers;
  revealPickers: boolean;
  setOpenKey: (key: string | null) => void;
};

// Subtle "picked by N" pill that expands inline to the members who chose this
// player/country as their special for the category.
function PickedBy({
  members,
  onToggle,
  open,
}: {
  members: string[];
  onToggle: () => void;
  open: boolean;
}) {
  return (
    <div className="border-t border-black/5 px-3 py-2">
      <button
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black",
          open ? "bg-emerald-950 text-white" : "bg-stone-100 text-stone-600",
        )}
        onClick={onToggle}
        type="button"
      >
        <Users size={12} />
        Picked by {members.length}
        <ChevronDown
          className={cn("transition-transform", open && "rotate-180")}
          size={12}
        />
      </button>
      {open ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {members.map((member) => (
            <span
              className="rounded-full bg-stone-100 px-2 py-1 text-xs font-bold text-stone-700"
              key={member}
            >
              {member}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PlayerBoard({
  emptyLabel,
  icon,
  openKey,
  pickers,
  revealPickers,
  rows,
  setOpenKey,
  specialType,
  title,
  valueLabel,
}: SharedPickerProps & {
  emptyLabel: string;
  icon: React.ReactNode;
  rows: PlayerCategoryRow[];
  specialType: BonusPickType;
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
          {rows.map((row) => {
            const rowKey = `${specialType}:${row.teamId}:${row.playerName}`;
            const members =
              revealPickers && row.playerId
                ? pickers.get(specialPlayerKey(specialType, row.playerId))
                : undefined;
            const open = openKey === rowKey;
            return (
              <div
                className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm"
                key={rowKey}
              >
                <div className="grid grid-cols-[32px_1fr_auto] items-center gap-3 p-3">
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
                {members && members.length > 0 ? (
                  <PickedBy
                    members={members}
                    onToggle={() => setOpenKey(open ? null : rowKey)}
                    open={open}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function CountryCardBoard({
  openKey,
  pickers,
  revealPickers,
  rows,
  setOpenKey,
}: SharedPickerProps & {
  rows: CountryCardCategoryRow[];
}) {
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
          {rows.map((row) => {
            const rowKey = `most_cards_country:${row.teamId}`;
            const members = revealPickers
              ? pickers.get(specialTeamKey("most_cards_country", row.teamId))
              : undefined;
            const open = openKey === rowKey;
            return (
              <div
                className="rounded-lg border border-black/10 bg-white shadow-sm"
                key={rowKey}
              >
                <div className="grid grid-cols-[32px_1fr_auto] items-center gap-3 p-3">
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

                <div className="flex items-center gap-2 border-t border-black/10 px-3 py-3 text-xs font-bold text-stone-500">
                  <Activity size={14} />
                  <span className="truncate">
                    {row.updatedAt
                      ? `Fresh ${formatLocalDateTime(row.updatedAt)}`
                      : "Freshness pending"}
                  </span>
                </div>

                {members && members.length > 0 ? (
                  <PickedBy
                    members={members}
                    onToggle={() => setOpenKey(open ? null : rowKey)}
                    open={open}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StreakBoard({ rows }: { rows: UserStreakCategoryRow[] }) {
  const longestEverValue = Math.max(0, ...rows.map((row) => row.longestStreak));
  const longestEverRows = rows.filter(
    (row) => row.longestStreak === longestEverValue && longestEverValue > 0,
  );
  const longestEverNames =
    longestEverRows.length > 0
      ? longestEverRows.map((row) => row.displayName).join(", ")
      : "No leader";

  return (
    <section className="space-y-2">
      <SectionTitle icon={<Flame size={18} />} title="Pick streaks" />

      {rows.length === 0 ? (
        <EmptyState body="No finished match picks tracked yet." title="Waiting on scores" />
      ) : (
        <>
          <div className="rounded-lg border border-black/10 bg-[#022c22] p-4 text-white shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-white text-emerald-950">
                <Trophy size={19} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
                  Longest ever
                </p>
                <p className="text-lg font-black leading-tight">{longestEverNames}</p>
              </div>
              <p className="ml-auto font-mono text-3xl font-black tabular-nums">
                {longestEverValue}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {rows.map((row) => (
              <div
                className="grid grid-cols-[32px_1fr_auto_auto] items-center gap-3 rounded-lg border border-black/10 bg-white p-3 shadow-sm"
                key={row.userId}
              >
                <span className="font-mono text-lg font-black tabular-nums">
                  {row.rank}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-black">{row.displayName}</p>
                  <p className="text-xs font-bold text-stone-500">Correct pick streaks</p>
                </div>
                <StreakMetric label="Current" value={row.currentStreak} />
                <StreakMetric label="Best" value={row.longestStreak} />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function StreakMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right">
      <p className="font-mono text-xl font-black tabular-nums">{value}</p>
      <p className="text-[10px] font-black uppercase tracking-wide text-stone-500">
        {label}
      </p>
    </div>
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
