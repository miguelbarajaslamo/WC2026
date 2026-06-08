"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Flag } from "@/components/ui/flag";
import { MatchRow } from "@/components/app/match-row";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/data-state";
import { useBootstrap } from "@/components/app/use-bootstrap";
import { cn } from "@/lib/cn";
import { getVisibleMatches } from "@/lib/data/selectors";
import type { BootstrapData } from "@/lib/types";

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
      </section>

      {standings ? (
        <section className="grid grid-cols-4 gap-2">
          <Metric label="Played" value={standings.played} />
          <Metric label="W" value={standings.won} />
          <Metric label="D" value={standings.drawn} />
          <Metric label="L" value={standings.lost} />
          <Metric label="GF" value={standings.goalsFor} />
          <Metric label="GA" value={standings.goalsAgainst} />
          <Metric label="GD" value={standings.goalsFor - standings.goalsAgainst} />
          <Metric label="Pts" value={standings.points} />
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

type SquadRow = {
  playerId: string;
  name: string;
  position: string;
  shirtNumber?: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  saves: number;
};

type SquadColumn = {
  key: keyof SquadRow;
  label: string;
  numeric: boolean;
  grow?: boolean;
};

const SQUAD_COLUMNS: SquadColumn[] = [
  { key: "shirtNumber", label: "#", numeric: true },
  { key: "name", label: "Player", numeric: false, grow: true },
  { key: "position", label: "Pos", numeric: false },
  { key: "goals", label: "G", numeric: true },
  { key: "assists", label: "A", numeric: true },
  { key: "yellowCards", label: "Y", numeric: true },
  { key: "redCards", label: "R", numeric: true },
  { key: "saves", label: "Sv", numeric: true },
];

function TeamSquad({ data, teamId }: { data: BootstrapData; teamId: string }) {
  const [sortKey, setSortKey] = useState<keyof SquadRow>("shirtNumber");
  const [sortAsc, setSortAsc] = useState(true);

  const squad = useMemo<SquadRow[]>(() => {
    return data.squadMembers
      .filter((member) => member.teamId === teamId && member.active)
      .map((member) => {
        const player = data.players.find((item) => item.id === member.playerId);
        const stat = data.playerStatSnapshots.find(
          (item) =>
            (item.playerId && item.playerId === member.playerId) ||
            (item.teamId === teamId && item.playerName === player?.name),
        );
        return {
          playerId: member.playerId,
          name: player?.name ?? "Unknown",
          position: member.position ?? player?.position ?? "—",
          shirtNumber: member.shirtNumber,
          goals: stat?.goals ?? 0,
          assists: stat?.assists ?? 0,
          yellowCards: stat?.yellowCards ?? 0,
          redCards: stat?.redCards ?? 0,
          saves: stat?.saves ?? 0,
        };
      });
  }, [data, teamId]);

  const sorted = useMemo(() => {
    const numeric = SQUAD_COLUMNS.find((column) => column.key === sortKey)?.numeric;
    const rows = [...squad];
    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp: number;
      if (numeric) {
        // Undefined (e.g. missing shirt number) sorts last when ascending.
        const an = av == null ? Number.POSITIVE_INFINITY : Number(av);
        const bn = bv == null ? Number.POSITIVE_INFINITY : Number(bv);
        cmp = an - bn;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      return sortAsc ? cmp : -cmp;
    });
    return rows;
  }, [squad, sortKey, sortAsc]);

  function toggleSort(key: keyof SquadRow, numeric: boolean) {
    if (key === sortKey) {
      setSortAsc((asc) => !asc);
    } else {
      setSortKey(key);
      // Stats default high→low; names/numbers default low→high.
      setSortAsc(!numeric || key === "shirtNumber");
    }
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
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-black uppercase tracking-wide text-stone-500">
          Squad
        </h2>
        <span className="text-xs font-bold text-stone-400">
          {squad.length} players · tap a column to sort
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/10 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left">
              {SQUAD_COLUMNS.map((column) => (
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
                      sortKey === column.key ? "text-stone-950" : "text-stone-400",
                    )}
                    onClick={() => toggleSort(column.key, column.numeric)}
                    type="button"
                  >
                    {column.label}
                    {sortKey === column.key ? (
                      sortAsc ? (
                        <ChevronUp size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      )
                    ) : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
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
                  {row.position}
                </td>
                <td className="p-2 text-center font-mono">{row.goals}</td>
                <td className="p-2 text-center font-mono">{row.assists}</td>
                <td className="p-2 text-center font-mono">{row.yellowCards}</td>
                <td className="p-2 text-center font-mono">{row.redCards}</td>
                <td className="p-2 text-center font-mono">{row.saves}</td>
              </tr>
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
