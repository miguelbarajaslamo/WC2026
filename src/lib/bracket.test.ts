import { describe, expect, it } from "vitest";
import { projectBracket } from "@/lib/bracket";
import { allocatedThirdPlaceGroup } from "@/lib/third-place-allocation";
import type { BootstrapData, Match, Team } from "@/lib/types";

const baseMatch = {
  apiFootballFixtureId: 1,
  city: "City",
  kickoffAt: "2026-06-11T19:00:00.000Z",
  predictionLockAt: "2026-06-11T18:45:00.000Z",
  providerStatusCode: "FT",
  stage: "Group stage",
  status: "finished",
  venue: "Venue",
} satisfies Partial<Match>;

function makeMatch({
  awayScore,
  awayTeamId,
  group,
  homeScore,
  homeTeamId,
  id,
}: {
  awayScore: number;
  awayTeamId: string;
  group: string;
  homeScore: number;
  homeTeamId: string;
  id: string;
}): Match {
  return {
    ...baseMatch,
    apiFootballFixtureId: Number(id.replace(/\D/g, "")) || 1,
    awayScore,
    awayTeamId,
    groupName: `Group ${group}`,
    homeScore,
    homeTeamId,
    id,
  } as Match;
}

function makeData(): BootstrapData {
  const teams: Team[] = [];
  const matches: Match[] = [];

  for (const group of "ABCDEFGHIJKL") {
    for (let index = 1; index <= 4; index += 1) {
      teams.push({
        groupName: `Group ${group}`,
        id: `${group}${index}`,
        iso2: "SE",
        name: `${group}${index}`,
        shortName: `${group}${index}`,
      });
    }

    if ("ABCD".includes(group)) {
      matches.push(
        makeMatch({
          awayScore: 0,
          awayTeamId: `${group}4`,
          group,
          homeScore: 3,
          homeTeamId: `${group}1`,
          id: `${group}-1`,
        }),
        makeMatch({
          awayScore: 0,
          awayTeamId: `${group}3`,
          group,
          homeScore: 1,
          homeTeamId: `${group}2`,
          id: `${group}-2`,
        }),
      );
    } else {
      matches.push(
        makeMatch({
          awayScore: 0,
          awayTeamId: `${group}4`,
          group,
          homeScore: 2,
          homeTeamId: `${group}1`,
          id: `${group}-1`,
        }),
        makeMatch({
          awayScore: 0,
          awayTeamId: `${group}3`,
          group,
          homeScore: 0,
          homeTeamId: `${group}2`,
          id: `${group}-2`,
        }),
      );
    }
  }

  return {
    matches,
    standings: {},
    teams,
  } as BootstrapData;
}

function knockoutMatch({
  awayPenaltyScore,
  awayScore,
  awayTeamId,
  homePenaltyScore,
  homeScore,
  homeTeamId,
  id,
  kickoffAt,
  winner,
}: {
  awayPenaltyScore?: number;
  awayScore: number;
  awayTeamId: string;
  homePenaltyScore?: number;
  homeScore: number;
  homeTeamId: string;
  id: string;
  kickoffAt: string;
  winner: Match["winner"];
}): Match {
  return {
    ...baseMatch,
    apiFootballFixtureId: Number(id),
    awayPenaltyScore,
    awayScore,
    awayTeamId,
    groupName: undefined,
    homePenaltyScore,
    homeScore,
    homeTeamId,
    id,
    kickoffAt,
    providerStatusCode: "PEN",
    stage: "Round of 32",
    status: "finished",
    winner,
  } as Match;
}

describe("third-place allocation", () => {
  it("maps advancing third-place groups to the 2026 Round of 32 slots", () => {
    const groups = ["E", "F", "G", "H", "I", "J", "K", "L"];

    expect(allocatedThirdPlaceGroup(groups, "A")).toBe("E");
    expect(allocatedThirdPlaceGroup(groups, "B")).toBe("J");
    expect(allocatedThirdPlaceGroup(groups, "D")).toBe("I");
    expect(allocatedThirdPlaceGroup(groups, "E")).toBe("F");
  });

  it("projects bracket teams from current live standings", () => {
    const rounds = projectBracket(makeData());
    const roundOf32 = rounds.find((round) => round.round === "R32");

    expect(roundOf32?.matches.find((match) => match.matchNo === 79)?.away).toMatchObject({
      kind: "team",
      label: "E3",
    });
    expect(roundOf32?.matches.find((match) => match.matchNo === 85)?.away).toMatchObject({
      kind: "team",
      label: "J3",
    });
    expect(roundOf32?.matches.find((match) => match.matchNo === 74)?.home).toMatchObject({
      kind: "team",
      label: "E1",
    });
  });

  it("advances actual knockout winners into later rounds", () => {
    const data = makeData();
    data.matches.push(
      knockoutMatch({
        awayPenaltyScore: 5,
        awayScore: 1,
        awayTeamId: "B2",
        homePenaltyScore: 4,
        homeScore: 1,
        homeTeamId: "A2",
        id: "7300",
        kickoffAt: "2026-06-28T19:00:00.000Z",
        winner: "away",
      }),
    );

    const rounds = projectBracket(data);
    const roundOf32 = rounds.find((round) => round.round === "R32");
    const roundOf16 = rounds.find((round) => round.round === "R16");

    expect(roundOf32?.matches.find((match) => match.matchNo === 73)).toMatchObject({
      score: "1(4)-1(5)",
      winner: "away",
    });
    expect(roundOf16?.matches.find((match) => match.matchNo === 90)?.home).toMatchObject({
      kind: "team",
      label: "B2",
    });
  });
});
