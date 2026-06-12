import { describe, expect, it } from "vitest";
import { normalizeWorldCupGroupName, sortedLiveStandings } from "@/lib/standings";
import type { BootstrapData, Match } from "@/lib/types";

const baseMatch = {
  apiFootballFixtureId: 1,
  city: "City",
  kickoffAt: "2026-06-11T19:00:00.000Z",
  predictionLockAt: "2026-06-11T18:45:00.000Z",
  providerStatusCode: "NS",
  stage: "Group stage",
  venue: "Venue",
} satisfies Partial<Match>;

function match({
  awayScore,
  awayTeamId,
  groupName,
  homeScore,
  homeTeamId,
  id,
  status,
}: Pick<Match, "awayTeamId" | "homeTeamId" | "id" | "status"> &
  Partial<Pick<Match, "awayScore" | "groupName" | "homeScore">>): Match {
  return {
    ...baseMatch,
    awayScore,
    awayTeamId,
    groupName,
    homeScore,
    homeTeamId,
    id,
    status,
  } as Match;
}

const data = {
  currentUserId: "u1",
  matches: [
    match({
      awayScore: 1,
      awayTeamId: "bra",
      groupName: "Group F",
      homeScore: 2,
      homeTeamId: "swe",
      id: "swe-bra",
      status: "live",
    }),
    match({
      awayScore: 0,
      awayTeamId: "can",
      groupName: "Group A",
      homeScore: 0,
      homeTeamId: "mex",
      id: "mex-can",
      status: "halftime",
    }),
  ],
  standings: {
    "World Cup": [
      {
        drawn: 0,
        goalsAgainst: 0,
        goalsFor: 0,
        lost: 0,
        played: 0,
        points: 0,
        qualification: "possible",
        teamId: "swe",
        won: 0,
      },
    ],
  },
  teams: [
    { groupName: "Group F", id: "swe", name: "Sweden", shortName: "SWE" },
    { groupName: "Group F", id: "bra", name: "Brazil", shortName: "BRA" },
    { groupName: "Group A", id: "mex", name: "Mexico", shortName: "MEX" },
    { groupName: "Group A", id: "can", name: "Canada", shortName: "CAN" },
  ],
} as unknown as BootstrapData;

describe("sortedLiveStandings", () => {
  it("does not treat Group Stage as Group S", () => {
    expect(normalizeWorldCupGroupName("Group Stage - 1")).toBeNull();
    expect(normalizeWorldCupGroupName("Group S")).toBeNull();
    expect(normalizeWorldCupGroupName("Group L")).toBe("Group L");
  });

  it("uses team groups instead of bad provider grouping", () => {
    expect(Object.keys(sortedLiveStandings(data)).sort()).toEqual([
      "Group A",
      "Group F",
    ]);
  });

  it("includes live and half-time scores as if they finish now", () => {
    const standings = sortedLiveStandings(data);

    expect(standings["Group F"][0]).toMatchObject({
      goalsAgainst: 1,
      goalsFor: 2,
      played: 1,
      points: 3,
      teamId: "swe",
      won: 1,
    });
    expect(standings["Group A"]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ drawn: 1, played: 1, points: 1, teamId: "mex" }),
        expect.objectContaining({ drawn: 1, played: 1, points: 1, teamId: "can" }),
      ]),
    );
  });
});
