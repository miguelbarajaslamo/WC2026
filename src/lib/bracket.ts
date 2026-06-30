import { sortedLiveStandings } from "@/lib/standings";
import {
  allocatedThirdPlaceGroup,
  type ThirdPlaceSlot,
} from "@/lib/third-place-allocation";
import { determineResult, matchFinishedResult } from "@/lib/scoring/scoring";
import type { BootstrapData, Match, PredictionResult, StandingRow, Team } from "@/lib/types";

// Official 2026 World Cup knockout structure (matches 73–104). Source: FIFA
// bracket as published (en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage).
// The eight third-place slots use FIFA's third-place allocation table. While
// group play is live, this projects "as it stands" from current live tables.

export type BracketRound = "R32" | "R16" | "QF" | "SF" | "Final";

type Slot =
  | { group: string; kind: "winner" }
  | { group: string; kind: "runner" }
  | { groups: string[]; kind: "third"; slot: ThirdPlaceSlot }
  | { kind: "match"; matchNo: number };

type BracketMatch = {
  away: Slot;
  home: Slot;
  matchNo: number;
  round: BracketRound;
};

const w = (group: string): Slot => ({ group, kind: "winner" });
const r = (group: string): Slot => ({ group, kind: "runner" });
const t = (groups: string[], slot: ThirdPlaceSlot): Slot => ({
  groups,
  kind: "third",
  slot,
});
const m = (matchNo: number): Slot => ({ kind: "match", matchNo });

export const BRACKET: BracketMatch[] = [
  { away: r("B"), home: r("A"), matchNo: 73, round: "R32" },
  { away: t(["A", "B", "C", "D", "F"], "E"), home: w("E"), matchNo: 74, round: "R32" },
  { away: r("C"), home: w("F"), matchNo: 75, round: "R32" },
  { away: r("F"), home: w("C"), matchNo: 76, round: "R32" },
  { away: t(["C", "D", "F", "G", "H"], "I"), home: w("I"), matchNo: 77, round: "R32" },
  { away: r("I"), home: r("E"), matchNo: 78, round: "R32" },
  { away: t(["C", "E", "F", "H", "I"], "A"), home: w("A"), matchNo: 79, round: "R32" },
  { away: t(["E", "H", "I", "J", "K"], "L"), home: w("L"), matchNo: 80, round: "R32" },
  { away: t(["B", "E", "F", "I", "J"], "D"), home: w("D"), matchNo: 81, round: "R32" },
  { away: t(["A", "E", "H", "I", "J"], "G"), home: w("G"), matchNo: 82, round: "R32" },
  { away: r("L"), home: r("K"), matchNo: 83, round: "R32" },
  { away: r("J"), home: w("H"), matchNo: 84, round: "R32" },
  { away: t(["E", "F", "G", "I", "J"], "B"), home: w("B"), matchNo: 85, round: "R32" },
  { away: r("H"), home: w("J"), matchNo: 86, round: "R32" },
  { away: t(["D", "E", "I", "J", "L"], "K"), home: w("K"), matchNo: 87, round: "R32" },
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

const ROUND_MATCH_ORDER: Record<BracketRound, number[]> = {
  Final: [104],
  QF: [97, 98, 99, 100],
  R16: [89, 90, 93, 94, 91, 92, 95, 96],
  R32: [74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87],
  SF: [101, 102],
};

const BRACKET_BY_MATCH_NO = new Map(
  BRACKET.map((match) => [match.matchNo, match]),
);

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
  teamId?: string;
};

export type BracketRoundView = {
  matches: Array<{
    away: ResolvedSlot;
    home: ResolvedSlot;
    matchNo: number;
    providerStatusCode?: string;
    score?: string;
    status?: Match["status"];
    winner?: Exclude<PredictionResult, "draw">;
  }>;
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

function groupLetter(groupName: string) {
  return groupName.match(/\bGroup\s+([A-L])\b/)?.[1] ?? null;
}

function rankThirdPlaceGroups(standings: Record<string, StandingRow[]>) {
  return Object.entries(standings)
    .map(([groupName, rows]) => ({
      group: groupLetter(groupName),
      row: rows[2],
    }))
    .filter(
      (entry): entry is { group: string; row: StandingRow } =>
        Boolean(entry.group && entry.row),
    )
    .sort((left, right) => {
      const leftGoalDiff = left.row.goalsFor - left.row.goalsAgainst;
      const rightGoalDiff = right.row.goalsFor - right.row.goalsAgainst;

      return (
        right.row.points - left.row.points ||
        rightGoalDiff - leftGoalDiff ||
        right.row.goalsFor - left.row.goalsFor ||
        left.group.localeCompare(right.group)
      );
    })
    .slice(0, 8)
    .map((entry) => entry.group);
}

function matchWinner(match: Match | undefined): Exclude<PredictionResult, "draw"> | null {
  if (!match) {
    return null;
  }

  const finishedResult = matchFinishedResult(match);
  if (finishedResult === "home" || finishedResult === "away") {
    return finishedResult;
  }

  if (
    match.status !== "finished" &&
    match.homeScore !== undefined &&
    match.awayScore !== undefined
  ) {
    const liveResult = determineResult({
      awayScore: match.awayScore,
      homeScore: match.homeScore,
    });
    return liveResult === "home" || liveResult === "away" ? liveResult : null;
  }

  return null;
}

function stageStart(stage: string): number | null {
  const value = stage.toLowerCase();

  if (value.includes("round of 32") || value.includes("1/16")) {
    return 73;
  }
  if (value.includes("round of 16") || value.includes("1/8")) {
    return 89;
  }
  if (value.includes("quarter") || value.includes("1/4")) {
    return 97;
  }
  if (value.includes("semi") || value.includes("1/2")) {
    return 101;
  }
  if (value === "final" || value.includes("final")) {
    return 104;
  }

  return null;
}

function roundStart(round: BracketRound): number {
  if (round === "R32") {
    return 73;
  }
  if (round === "R16") {
    return 89;
  }
  if (round === "QF") {
    return 97;
  }
  if (round === "SF") {
    return 101;
  }
  return 104;
}

function matchHasTeam(match: Match, teamId: string) {
  return match.homeTeamId === teamId || match.awayTeamId === teamId;
}

function matchHasBothTeams(match: Match, homeTeamId: string, awayTeamId: string) {
  return (
    (match.homeTeamId === homeTeamId && match.awayTeamId === awayTeamId) ||
    (match.homeTeamId === awayTeamId && match.awayTeamId === homeTeamId)
  );
}

function candidateMatchesForRound(matches: Match[], round: BracketRound) {
  const start = roundStart(round);
  return matches.filter((match) => stageStart(match.stage) === start);
}

function findActualMatchForSlots({
  candidates,
  resolvedAway,
  resolvedHome,
  usedMatchIds,
}: {
  candidates: Match[];
  resolvedAway: ResolvedSlot;
  resolvedHome: ResolvedSlot;
  usedMatchIds: Set<string>;
}) {
  const available = candidates.filter((match) => !usedMatchIds.has(match.id));
  const homeTeamId = resolvedHome.teamId;
  const awayTeamId = resolvedAway.teamId;

  if (homeTeamId && awayTeamId) {
    return available.find((match) =>
      matchHasBothTeams(match, homeTeamId, awayTeamId),
    );
  }

  if (homeTeamId) {
    return available.find((match) => matchHasTeam(match, homeTeamId));
  }

  if (awayTeamId) {
    return available.find((match) => matchHasTeam(match, awayTeamId));
  }

  return undefined;
}

function bracketScore(match: Match | undefined) {
  if (
    !match ||
    match.homeScore === undefined ||
    match.awayScore === undefined
  ) {
    return undefined;
  }

  if (
    match.homePenaltyScore !== undefined &&
    match.awayPenaltyScore !== undefined
  ) {
    return `${match.homeScore}(${match.homePenaltyScore})-${match.awayScore}(${match.awayPenaltyScore})`;
  }

  return `${match.homeScore}-${match.awayScore}`;
}

// Project the bracket against current live standings. Winners/runners-up
// resolve as soon as teams are present in a group table; third-place slots
// resolve once we can rank eight projected third-place teams.
export function projectBracket(data: BootstrapData): BracketRoundView[] {
  const teamById = new Map<string, Team>(data.teams.map((team) => [team.id, team]));
  const matchesByNumber = new Map<number, Match>();
  const sortedByGroup = new Map<string, StandingRow[]>();
  const projectedStandings = sortedLiveStandings(data);
  for (const [group, rows] of Object.entries(projectedStandings)) {
    sortedByGroup.set(group, sortGroup(rows));
  }

  const projectedThirdPlaceGroups = rankThirdPlaceGroups(projectedStandings);

  const teamSlot = (group: string, index: number, fallback: string): ResolvedSlot => {
    const row = sortedByGroup.get(`Group ${group}`)?.[index];
    const team = row ? teamById.get(row.teamId) : undefined;
    if (!team) {
      return { kind: "placeholder", label: fallback };
    }
    return { iso2: team.iso2, kind: "team", label: team.shortName, teamId: team.id };
  };

  const actualTeamSlot = (teamId: string | undefined, fallback: string): ResolvedSlot => {
    const team = teamId ? teamById.get(teamId) : undefined;
    if (!team) {
      return { kind: "placeholder", label: fallback };
    }
    return { iso2: team.iso2, kind: "team", label: team.shortName, teamId: team.id };
  };

  const resolve = (slot: Slot): ResolvedSlot => {
    if (slot.kind === "winner") {
      return teamSlot(slot.group, 0, `1${slot.group}`);
    }
    if (slot.kind === "runner") {
      return teamSlot(slot.group, 1, `2${slot.group}`);
    }
    if (slot.kind === "third") {
      const allocatedGroup =
        projectedThirdPlaceGroups.length === 8
          ? allocatedThirdPlaceGroup(projectedThirdPlaceGroups, slot.slot)
          : null;
      if (allocatedGroup) {
        return teamSlot(allocatedGroup, 2, `3${allocatedGroup}`);
      }
      return { kind: "placeholder", label: `3rd ${slot.groups.join("/")}` };
    }
    const sourceMatch = matchesByNumber.get(slot.matchNo);
    const winner = matchWinner(sourceMatch);
    if (winner === "home") {
      return actualTeamSlot(sourceMatch?.homeTeamId, `Winner M${slot.matchNo}`);
    }
    if (winner === "away") {
      return actualTeamSlot(sourceMatch?.awayTeamId, `Winner M${slot.matchNo}`);
    }
    return { kind: "placeholder", label: `Winner M${slot.matchNo}` };
  };

  const usedMatchIds = new Set<string>();
  for (const round of ROUND_ORDER) {
    const candidates = candidateMatchesForRound(data.matches, round);
    for (const matchNo of ROUND_MATCH_ORDER[round]) {
      const bracketMatch = BRACKET_BY_MATCH_NO.get(matchNo);
      if (!bracketMatch) {
        continue;
      }
      const resolvedHome = resolve(bracketMatch.home);
      const resolvedAway = resolve(bracketMatch.away);
      const actualMatch = findActualMatchForSlots({
        candidates,
        resolvedAway,
        resolvedHome,
        usedMatchIds,
      });

      if (actualMatch) {
        matchesByNumber.set(matchNo, actualMatch);
        usedMatchIds.add(actualMatch.id);
      }
    }
  }

  return ROUND_ORDER.map((round) => ({
    matches: ROUND_MATCH_ORDER[round].flatMap((matchNo) => {
      const match = BRACKET_BY_MATCH_NO.get(matchNo);
      if (!match) {
        return [];
      }
      const actualMatch = matchesByNumber.get(match.matchNo);
      const winner = matchWinner(actualMatch) ?? undefined;
      const score = bracketScore(actualMatch);
      const resolvedHome = resolve(match.home);
      const resolvedAway = resolve(match.away);
      const useActualTeams =
        Boolean(actualMatch) &&
        (match.round === "R32" || actualMatch?.status !== "scheduled");

      return {
        away: useActualTeams
          ? actualTeamSlot(actualMatch?.awayTeamId, resolvedAway.label)
          : resolvedAway,
        home: useActualTeams
          ? actualTeamSlot(actualMatch?.homeTeamId, resolvedHome.label)
          : resolvedHome,
        matchNo: match.matchNo,
        providerStatusCode: actualMatch?.providerStatusCode,
        score,
        status: actualMatch?.status,
        winner,
      };
    }),
    round,
    title: ROUND_LABEL[round],
  }));
}
