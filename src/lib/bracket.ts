import type { BootstrapData, StandingRow, Team } from "@/lib/types";

// Official 2026 World Cup knockout structure (matches 73–104). Source: FIFA
// bracket as published (en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage).
// The eight third-place slots list their candidate groups; the exact team is
// only fixed once the group stage ends (per FIFA's combination table), so we
// show the candidate set until then.

export type BracketRound = "R32" | "R16" | "QF" | "SF" | "Final";

type Slot =
  | { group: string; kind: "winner" }
  | { group: string; kind: "runner" }
  | { groups: string[]; kind: "third" }
  | { kind: "match"; matchNo: number };

type BracketMatch = {
  away: Slot;
  home: Slot;
  matchNo: number;
  round: BracketRound;
};

const w = (group: string): Slot => ({ group, kind: "winner" });
const r = (group: string): Slot => ({ group, kind: "runner" });
const t = (groups: string[]): Slot => ({ groups, kind: "third" });
const m = (matchNo: number): Slot => ({ kind: "match", matchNo });

export const BRACKET: BracketMatch[] = [
  { away: r("B"), home: r("A"), matchNo: 73, round: "R32" },
  { away: t(["A", "B", "C", "D", "F"]), home: w("E"), matchNo: 74, round: "R32" },
  { away: r("C"), home: w("F"), matchNo: 75, round: "R32" },
  { away: r("F"), home: w("C"), matchNo: 76, round: "R32" },
  { away: t(["C", "D", "F", "G", "H"]), home: w("I"), matchNo: 77, round: "R32" },
  { away: r("I"), home: r("E"), matchNo: 78, round: "R32" },
  { away: t(["C", "E", "F", "H", "I"]), home: w("A"), matchNo: 79, round: "R32" },
  { away: t(["E", "H", "I", "J", "K"]), home: w("L"), matchNo: 80, round: "R32" },
  { away: t(["B", "E", "F", "I", "J"]), home: w("D"), matchNo: 81, round: "R32" },
  { away: t(["A", "E", "H", "I", "J"]), home: w("G"), matchNo: 82, round: "R32" },
  { away: r("L"), home: r("K"), matchNo: 83, round: "R32" },
  { away: r("J"), home: w("H"), matchNo: 84, round: "R32" },
  { away: t(["E", "F", "G", "I", "J"]), home: w("B"), matchNo: 85, round: "R32" },
  { away: r("H"), home: w("J"), matchNo: 86, round: "R32" },
  { away: t(["D", "E", "I", "J", "L"]), home: w("K"), matchNo: 87, round: "R32" },
  { away: r("G"), home: r("D"), matchNo: 88, round: "R32" },

  { away: m(77), home: m(74), matchNo: 89, round: "R16" },
  { away: m(75), home: m(73), matchNo: 90, round: "R16" },
  { away: m(78), home: m(76), matchNo: 91, round: "R16" },
  { away: m(80), home: m(79), matchNo: 92, round: "R16" },
  { away: m(84), home: m(83), matchNo: 93, round: "R16" },
  { away: m(82), home: m(81), matchNo: 94, round: "R16" },
  { away: m(88), home: m(86), matchNo: 95, round: "R16" },
  { away: m(87), home: m(85), matchNo: 96, round: "R16" },

  { away: m(90), home: m(89), matchNo: 97, round: "QF" },
  { away: m(94), home: m(93), matchNo: 98, round: "QF" },
  { away: m(92), home: m(91), matchNo: 99, round: "QF" },
  { away: m(96), home: m(95), matchNo: 100, round: "QF" },

  { away: m(98), home: m(97), matchNo: 101, round: "SF" },
  { away: m(100), home: m(99), matchNo: 102, round: "SF" },

  { away: m(102), home: m(101), matchNo: 104, round: "Final" },
];

export const ROUND_ORDER: BracketRound[] = ["R32", "R16", "QF", "SF", "Final"];

export const ROUND_LABEL: Record<BracketRound, string> = {
  Final: "Final",
  QF: "Quarter-finals",
  R16: "Round of 16",
  R32: "Round of 32",
  SF: "Semi-finals",
};

export type ResolvedSlot = {
  iso2?: string;
  // "team" once we can name it; "placeholder" while it's a position/winner ref.
  kind: "placeholder" | "team";
  label: string;
};

export type BracketRoundView = {
  matches: Array<{ away: ResolvedSlot; home: ResolvedSlot; matchNo: number }>;
  round: BracketRound;
  title: string;
};

function sortGroup(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
      b.goalsFor - a.goalsFor,
  );
}

// Project the bracket against the current standings. Group winners/runners-up
// resolve to the current 1st/2nd once every team has played at least once;
// before that (and always for third-place and later-round slots) we show the
// position/candidate/"winner of" placeholder, like a standard bracket.
export function projectBracket(data: BootstrapData): BracketRoundView[] {
  const teamById = new Map<string, Team>(data.teams.map((team) => [team.id, team]));
  const sortedByGroup = new Map<string, StandingRow[]>();
  for (const [group, rows] of Object.entries(data.standings)) {
    sortedByGroup.set(group, sortGroup(rows));
  }

  const allRows = Object.values(data.standings).flat();
  const everyTeamPlayedOnce =
    allRows.length >= 24 && allRows.every((row) => row.played >= 1);

  const teamSlot = (group: string, index: number, fallback: string): ResolvedSlot => {
    if (!everyTeamPlayedOnce) {
      return { kind: "placeholder", label: fallback };
    }
    const row = sortedByGroup.get(`Group ${group}`)?.[index];
    const team = row ? teamById.get(row.teamId) : undefined;
    if (!team) {
      return { kind: "placeholder", label: fallback };
    }
    return { iso2: team.iso2, kind: "team", label: team.shortName };
  };

  const resolve = (slot: Slot): ResolvedSlot => {
    if (slot.kind === "winner") {
      return teamSlot(slot.group, 0, `1${slot.group}`);
    }
    if (slot.kind === "runner") {
      return teamSlot(slot.group, 1, `2${slot.group}`);
    }
    if (slot.kind === "third") {
      return { kind: "placeholder", label: `3rd ${slot.groups.join("/")}` };
    }
    return { kind: "placeholder", label: `Winner M${slot.matchNo}` };
  };

  return ROUND_ORDER.map((round) => ({
    matches: BRACKET.filter((match) => match.round === round).map((match) => ({
      away: resolve(match.away),
      home: resolve(match.home),
      matchNo: match.matchNo,
    })),
    round,
    title: ROUND_LABEL[round],
  }));
}
