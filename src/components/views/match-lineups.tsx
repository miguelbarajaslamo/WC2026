"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { MatchEvent, Team } from "@/lib/types";

type LineupPlayer = {
  grid: string | null;
  id: string | null;
  name: string;
  number: number | null;
  pos: string | null;
  starter: boolean;
};

type LineupRow = {
  coach: string | null;
  formation: string | null;
  players: LineupPlayer[];
  team_id: string;
};

function normalize(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\./g, "")
    .trim();
}

function lastName(name: string) {
  const parts = normalize(name).split(/\s+/);
  return parts[parts.length - 1] ?? "";
}

// Match an event name to a lineup name by full normalized form, else last name
// (the feed mixes "F. Balogun" and "Folarin Balogun").
function namesMatch(a: string | undefined, b: string) {
  if (!a) {
    return false;
  }
  return normalize(a) === normalize(b) || lastName(a) === lastName(b);
}

type PlayerBadges = { goals: number; red: boolean; subbedOff: boolean; yellow: boolean };

function badgesFor(player: LineupPlayer, events: MatchEvent[]): PlayerBadges {
  let goals = 0;
  let yellow = false;
  let red = false;
  let subbedOff = false;
  for (const event of events) {
    if (
      event.type === "goal" &&
      !(event.detail ?? "").toLowerCase().includes("own") &&
      namesMatch(event.playerName, player.name)
    ) {
      goals += 1;
    } else if (event.type === "yellow_card" && namesMatch(event.playerName, player.name)) {
      yellow = true;
    } else if (event.type === "red_card" && namesMatch(event.playerName, player.name)) {
      red = true;
    } else if (event.type === "substitution" && namesMatch(event.assistName, player.name)) {
      // API substitution: player = on, assist = off.
      subbedOff = true;
    }
  }
  return { goals, red, subbedOff, yellow };
}

type Placed = { left: number; player: LineupPlayer; top: number };

// Position a team's starters within a vertical band; GK at the outer edge,
// attackers toward the halfway line.
function placeTeam(
  starters: LineupPlayer[],
  band: [number, number],
  attackDown: boolean,
): Placed[] {
  const byRow = new Map<number, LineupPlayer[]>();
  for (const player of starters) {
    const row = Number((player.grid ?? "1:1").split(":")[0]) || 1;
    byRow.set(row, [...(byRow.get(row) ?? []), player]);
  }
  const rows = [...byRow.keys()].sort((a, b) => a - b);
  const rowCount = rows.length;

  return starters.map((player) => {
    const row = Number((player.grid ?? "1:1").split(":")[0]) || 1;
    const inRow = [...(byRow.get(row) ?? [])].sort(
      (a, b) =>
        Number((a.grid ?? "1:1").split(":")[1] ?? 1) -
        Number((b.grid ?? "1:1").split(":")[1] ?? 1),
    );
    const rowIndex = rows.indexOf(row);
    const colIndex = inRow.indexOf(player);
    const vFrac = rowCount > 1 ? rowIndex / (rowCount - 1) : 0.5;
    const top = attackDown
      ? band[0] + vFrac * (band[1] - band[0])
      : band[1] - vFrac * (band[1] - band[0]);
    const left = ((colIndex + 1) / (inRow.length + 1)) * 100;
    return { left, player, top };
  });
}

export function MatchLineups({
  away,
  events,
  home,
  isDemo,
  matchId,
}: {
  away: Team;
  events: MatchEvent[];
  home: Team;
  isDemo: boolean;
  matchId: string;
}) {
  const [view, setView] = useState<"away" | "full" | "home">("full");

  const { data: lineups } = useQuery({
    enabled: Boolean(matchId) && !isDemo,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("match_lineups")
        .select("team_id,formation,coach,players")
        .eq("match_id", matchId)
        .returns<LineupRow[]>();
      return data ?? [];
    },
    // Poll while empty so the XI appears when it lands (~1h before kickoff).
    queryKey: ["match-lineups", matchId],
    refetchInterval: 60_000,
  });

  const homeLineup = lineups?.find((row) => row.team_id === home.id);
  const awayLineup = lineups?.find((row) => row.team_id === away.id);

  if (!homeLineup && !awayLineup) {
    return (
      <div className="rounded-lg border border-dashed border-black/20 bg-white p-6 text-center">
        <p className="font-black">Line-ups not in yet</p>
        <p className="mx-auto mt-1 max-w-sm text-sm font-bold text-stone-500">
          Starting XIs are usually confirmed 30–60 minutes before kickoff. This
          page refreshes automatically when they land.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <TabButton active={view === "full"} label="Full" onClick={() => setView("full")} />
        <TabButton
          active={view === "home"}
          label={home.shortName}
          onClick={() => setView("home")}
        />
        <TabButton
          active={view === "away"}
          label={away.shortName}
          onClick={() => setView("away")}
        />
      </div>

      <Pitch
        away={away}
        awayLineup={awayLineup}
        events={events}
        home={home}
        homeLineup={homeLineup}
        view={view}
      />
    </div>
  );
}

function Pitch({
  away,
  awayLineup,
  events,
  home,
  homeLineup,
  view,
}: {
  away: Team;
  awayLineup?: LineupRow;
  events: MatchEvent[];
  home: Team;
  homeLineup?: LineupRow;
  view: "away" | "full" | "home";
}) {
  const placed: Array<Placed & { team: Team }> = [];

  const starters = (lineup?: LineupRow) =>
    (lineup?.players ?? []).filter((player) => player.starter);

  if (view === "full") {
    for (const p of placeTeam(starters(homeLineup), [6, 46], true)) {
      placed.push({ ...p, team: home });
    }
    for (const p of placeTeam(starters(awayLineup), [54, 94], false)) {
      placed.push({ ...p, team: away });
    }
  } else {
    const lineup = view === "home" ? homeLineup : awayLineup;
    const team = view === "home" ? home : away;
    for (const p of placeTeam(starters(lineup), [8, 92], false)) {
      placed.push({ ...p, team });
    }
  }

  const formationLabel =
    view === "away"
      ? awayLineup?.formation
      : view === "home"
        ? homeLineup?.formation
        : null;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl border border-emerald-950/30 bg-emerald-800",
        view === "full" ? "aspect-[3/5]" : "aspect-[3/4]",
      )}
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 8%, transparent 8% 16%)",
      }}
    >
      {/* halfway line + centre circle */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-white/25" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25" />

      {view === "full" ? (
        <>
          <FormationTag
            className="left-2 top-2"
            formation={homeLineup?.formation}
            label={home.shortName}
          />
          <FormationTag
            className="bottom-2 right-2"
            formation={awayLineup?.formation}
            label={away.shortName}
          />
        </>
      ) : formationLabel ? (
        <FormationTag className="left-2 top-2" formation={formationLabel} label="" />
      ) : null}

      {placed.map(({ left, player, team, top }) => (
        <PlayerToken
          badges={badgesFor(player, events)}
          key={`${team.id}-${player.id ?? player.name}`}
          left={left}
          player={player}
          top={top}
        />
      ))}
    </div>
  );
}

function FormationTag({
  className,
  formation,
  label,
}: {
  className: string;
  formation?: string | null;
  label: string;
}) {
  if (!formation) {
    return null;
  }
  return (
    <span
      className={cn(
        "absolute rounded bg-black/40 px-2 py-1 text-[10px] font-black text-white",
        className,
      )}
    >
      {label ? `${label} · ` : ""}
      {formation}
    </span>
  );
}

function PlayerToken({
  badges,
  left,
  player,
  top,
}: {
  badges: PlayerBadges;
  left: number;
  player: LineupPlayer;
  top: number;
}) {
  const photo = player.id
    ? `https://media.api-sports.io/football/players/${player.id}.png`
    : null;

  return (
    <div
      className="absolute flex w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      <div className="relative grid size-8 place-items-center overflow-hidden rounded-full bg-stone-700 text-[10px] font-black text-white ring-2 ring-white">
        {player.number ?? ""}
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={player.name}
            className="absolute inset-0 size-full object-cover"
            onError={(event) => {
              event.currentTarget.style.visibility = "hidden";
            }}
            src={photo}
          />
        ) : null}

        {badges.goals > 0 ? (
          <span className="absolute -left-1.5 -top-1.5 grid min-w-[14px] place-items-center rounded-full bg-white px-0.5 text-[8px] leading-none shadow">
            ⚽{badges.goals > 1 ? badges.goals : ""}
          </span>
        ) : null}
        {badges.red ? (
          <span className="absolute -right-1 -top-1.5 h-3 w-2 rounded-[1px] bg-red-500 shadow" />
        ) : badges.yellow ? (
          <span className="absolute -right-1 -top-1.5 h-3 w-2 rounded-[1px] bg-yellow-400 shadow" />
        ) : null}
        {badges.subbedOff ? (
          <span className="absolute -bottom-1 -right-1 grid size-3.5 place-items-center rounded-full bg-red-600 text-[8px] font-black leading-none text-white shadow">
            ↓
          </span>
        ) : null}
      </div>

      <span className="mt-0.5 max-w-full truncate rounded bg-black/35 px-1 text-[9px] font-bold leading-tight text-white">
        {player.number ? `${player.number} ` : ""}
        {player.name}
      </span>
    </div>
  );
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "rounded-lg border border-black/10 px-3 py-2 text-sm font-black shadow-sm",
        active ? "bg-emerald-950 text-white" : "bg-white text-stone-950",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
