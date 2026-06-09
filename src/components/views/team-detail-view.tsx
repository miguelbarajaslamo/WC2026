"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Flag } from "@/components/ui/flag";
import { FormSquares } from "@/components/app/form-squares";
import { MatchRow } from "@/components/app/match-row";
import { StatLegend } from "@/components/app/stat-legend";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/data-state";
import { useBootstrap } from "@/components/app/use-bootstrap";
import { cn } from "@/lib/cn";
import { getVisibleMatches } from "@/lib/data/selectors";
import type { BootstrapData } from "@/lib/types";

const GROUP_RECORD_LEGEND: Array<[string, string]> = [
  ["Played", "Matches played"],
  ["W", "Won"],
  ["D", "Drawn"],
  ["L", "Lost"],
  ["GF", "Goals for"],
  ["GA", "Goals against"],
  ["GD", "Goal difference"],
  ["Pts", "Points"],
];

const SQUAD_LEGEND: Array<[string, string]> = [
  ["Pos", "Position (GK/DEF/MID/ATT)"],
  ["P", "Games played"],
  ["G", "Goals"],
  ["A", "Assists"],
  ["SV", "Saves"],
  ["Y", "Yellow cards"],
  ["R", "Red cards"],
];

export function TeamDetailView({ teamId }: { teamId: string }) {
  const { data, error, isLoading } = useBootstrap();

  if (isLoading || !data) {
    return <LoadingState label="Loading team" />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  const team = data.teams.find((item) => item.id === teamId);

  if (!team) {
    return <EmptyState body="This team is not in the tournament data." title="Team not found" />;
  }

  const fixtures = getVisibleMatches(data).filter(
    (match) => match.homeTeamId === team.id || match.awayTeamId === team.id,
  );
  const standings = Object.values(data.standings)
    .flat()
    .find((row) => row.teamId === team.id);

  return (
    <div className="space-y-4">
      <section className="rounded-lg bg-[#022c22] p-4 text-white">
        <Flag code={team.iso2} label={team.name} size="lg" />
        <h2 className="mt-3 text-3xl font-black">{team.shortName}</h2>
        <p className="text-sm font-bold text-white/70">
          {team.name} · {team.groupName}
        </p>
        <div className="mt-3">
          <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-emerald-200">
            Recent form
          </p>
          <FormSquares form={team.recentForm} size="lg" />
        </div>
      </section>

      {standings ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wide text-stone-500">
              Group record
            </h2>
            <StatLegend items={GROUP_RECORD_LEGEND} />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Metric label="Played" value={standings.played} />
            <Metric label="W" value={standings.won} />
            <Metric label="D" value={standings.drawn} />
            <Metric label="L" value={standings.lost} />
            <Metric label="GF" value={standings.goalsFor} />
            <Metric label="GA" value={standings.goalsAgainst} />
            <Metric label="GD" value={standings.goalsFor - standings.goalsAgainst} />
            <Metric label="Pts" value={standings.points} />
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-wide text-stone-500">
          Matches
        </h2>
        {fixtures.map((match) => (
          <MatchRow data={data} key={match.id} match={match} />
        ))}
      </section>

      <TeamSquad data={data} teamId={team.id} />
    </div>
  );
}

const POSITION_GROUPS: Array<{ key: string; label: string; short: string }> = [
  { key: "Goalkeeper", label: "Goalkeepers", short: "GK" },
  { key: "Defender", label: "Defenders", short: "DEF" },
  { key: "Midfielder", label: "Midfielders", short: "MID" },
  { key: "Attacker", label: "Attackers", short: "ATT" },
];

const POSITION_SHORT: Record<string, string> = Object.fromEntries(
  POSITION_GROUPS.map((group) => [group.key, group.short]),
);

type SquadRow = {
  playerId: string;
  name: string;
  position: string; // raw, for grouping
  positionShort: string; // GK/DEF/MID/ATT, for display
  shirtNumber?: number;
  // Active stats — World Cup, or pre-WC when the toggle is on.
  p: number; // games played
  g: number;
  a: number;
  sv: number;
  y: number;
  r: number;
};

type SquadColumn = {
  key: string;
  label: string;
  numeric: boolean;
  get: (row: SquadRow) => number | string | undefined;
};

const SQUAD_COLUMNS: SquadColumn[] = [
  { key: "shirtNumber", label: "#", numeric: true, get: (r) => r.shirtNumber },
  { key: "name", label: "Player", numeric: false, get: (r) => r.name },
  { key: "position", label: "Pos", numeric: false, get: (r) => r.positionShort },
  { key: "p", label: "P", numeric: true, get: (r) => r.p },
  { key: "g", label: "G", numeric: true, get: (r) => r.g },
  { key: "a", label: "A", numeric: true, get: (r) => r.a },
  { key: "sv", label: "SV", numeric: true, get: (r) => r.sv },
  { key: "y", label: "Y", numeric: true, get: (r) => r.y },
  { key: "r", label: "R", numeric: true, get: (r) => r.r },
];

const STAT_COLUMNS = SQUAD_COLUMNS.slice(3);

function compareRows(a: SquadRow, b: SquadRow, column: SquadColumn) {
  const av = column.get(a);
  const bv = column.get(b);
  if (column.numeric) {
    const an = av == null ? Number.POSITIVE_INFINITY : Number(av);
    const bn = bv == null ? Number.POSITIVE_INFINITY : Number(bv);
    return an - bn;
  }
  return String(av).localeCompare(String(bv));
}

type SquadSort = { key: string; dir: "asc" | "desc" } | null;

function TeamSquad({ data, teamId }: { data: BootstrapData; teamId: string }) {
  // sort === null means the default position-grouped view.
  const [sort, setSort] = useState<SquadSort>(null);
  const [showPreWc, setShowPreWc] = useState(false);

  const squad = useMemo<SquadRow[]>(() => {
    // WC games played, counted from this team's per-match player stats.
    const wcGames = new Map<string, number>();
    for (const stat of data.matchPlayerStats) {
      if (stat.teamId !== teamId) continue;
      const key = stat.playerId ?? stat.playerName;
      wcGames.set(key, (wcGames.get(key) ?? 0) + 1);
    }

    return data.squadMembers
      .filter((member) => member.teamId === teamId && member.active)
      .map((member) => {
        const player = data.players.find((item) => item.id === member.playerId);
        const snap = data.playerStatSnapshots.find(
          (item) =>
            (item.playerId && item.playerId === member.playerId) ||
            (item.teamId === teamId && item.playerName === player?.name),
        );
        const pre = member.preWcStats;
        const rawPosition = member.position ?? player?.position ?? "—";
        const active = showPreWc
          ? {
              p: pre?.games ?? 0,
              g: pre?.goals ?? 0,
              a: pre?.assists ?? 0,
              sv: pre?.saves ?? 0,
              y: pre?.yellow ?? 0,
              r: pre?.red ?? 0,
            }
          : {
              p:
                wcGames.get(member.playerId) ??
                wcGames.get(player?.name ?? "") ??
                0,
              g: snap?.goals ?? 0,
              a: snap?.assists ?? 0,
              sv: snap?.saves ?? 0,
              y: snap?.yellowCards ?? 0,
              r: snap?.redCards ?? 0,
            };
        return {
          playerId: member.playerId,
          name: player?.name ?? "Unknown",
          position: rawPosition,
          positionShort: POSITION_SHORT[rawPosition] ?? rawPosition,
          shirtNumber: member.shirtNumber,
          ...active,
        };
      });
  }, [data, teamId, showPreWc]);

  // Either a flat sorted list, or position groups each with a header.
  const sections = useMemo(() => {
    if (sort) {
      const column =
        SQUAD_COLUMNS.find((item) => item.key === sort.key) ?? SQUAD_COLUMNS[0];
      const rows = [...squad].sort((a, b) => {
        const cmp = compareRows(a, b, column);
        return sort.dir === "asc" ? cmp : -cmp;
      });
      return [{ label: null as string | null, rows }];
    }

    const byShirt = (a: SquadRow, b: SquadRow) =>
      (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999);
    return POSITION_GROUPS.map((group) => ({
      label: group.label,
      rows: squad.filter((row) => row.position === group.key).sort(byShirt),
    })).filter((section) => section.rows.length > 0);
  }, [squad, sort]);

  // Click cycles: group base → sort (default dir) → reversed → group base.
  function cycleSort(column: SquadColumn) {
    const def: "asc" | "desc" = column.numeric ? "desc" : "asc";
    setSort((prev) => {
      if (!prev || prev.key !== column.key) {
        return { key: column.key, dir: def };
      }
      if (prev.dir === def) {
        return { key: column.key, dir: def === "desc" ? "asc" : "desc" };
      }
      return null;
    });
  }

  if (squad.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-wide text-stone-500">
          Squad
        </h2>
        <EmptyState
          body="Squad data has not been synced for this team yet."
          title="No squad yet"
        />
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-black uppercase tracking-wide text-stone-500">
            Squad
          </h2>
          <StatLegend items={SQUAD_LEGEND} />
        </div>
        <button
          aria-pressed={showPreWc}
          className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black",
            showPreWc
              ? "border-emerald-700 bg-emerald-50 text-emerald-900"
              : "border-black/10 bg-white text-stone-500",
          )}
          onClick={() => {
            setShowPreWc((value) => !value);
            setSort(null);
          }}
          type="button"
        >
          <span
            className={cn(
              "relative h-4 w-7 rounded-full transition-colors",
              showPreWc ? "bg-emerald-600" : "bg-stone-300",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 size-3 rounded-full bg-white transition-all",
                showPreWc ? "left-3.5" : "left-0.5",
              )}
            />
          </span>
          Pre-WC stats
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/10 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left">
              {SQUAD_COLUMNS.map((column) => {
                const active = sort?.key === column.key;
                return (
                  <th
                    className={cn(
                      "whitespace-nowrap p-2 font-black",
                      column.numeric && "text-center",
                    )}
                    key={column.key}
                  >
                    <button
                      className={cn(
                        "inline-flex items-center gap-1 text-[11px] uppercase tracking-wide",
                        active ? "text-stone-950" : "text-stone-400",
                      )}
                      onClick={() => cycleSort(column)}
                      type="button"
                    >
                      {column.label}
                      {active ? (
                        sort?.dir === "asc" ? (
                          <ChevronUp size={12} />
                        ) : (
                          <ChevronDown size={12} />
                        )
                      ) : null}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <Fragment key={section.label ?? "sorted"}>
                {section.label ? (
                  <tr className="bg-stone-100">
                    <td
                      className="px-2 py-1.5 text-[10px] font-black uppercase tracking-wide text-stone-500"
                      colSpan={SQUAD_COLUMNS.length}
                    >
                      {section.label}
                    </td>
                  </tr>
                ) : null}
                {section.rows.map((row) => (
                  <tr
                    className="border-b border-black/5 last:border-0 hover:bg-stone-50"
                    key={row.playerId}
                  >
                    <td className="p-2 text-center font-mono font-bold text-stone-500">
                      {row.shirtNumber ?? "—"}
                    </td>
                    <td className="p-2 font-bold">
                      <Link
                        className="hover:text-emerald-800 hover:underline"
                        href={`/players/${row.playerId}`}
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap p-2 text-stone-500">
                      {row.positionShort}
                    </td>
                    {STAT_COLUMNS.map((column) => (
                      <td className="p-2 text-center font-mono" key={column.key}>
                        {column.get(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-3 text-center">
      <p className="font-mono text-xl font-black">{value}</p>
      <p className="text-[10px] font-black uppercase tracking-wide text-stone-500">
        {label}
      </p>
    </div>
  );
}
