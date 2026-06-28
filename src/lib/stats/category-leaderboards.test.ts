import { describe, expect, it } from "vitest";
import {
  aggregateCategoryLeaderboards,
  aggregateCountryCardPoints,
  winningCountryCardOptionIds,
  type PlayerStatSource,
} from "@/lib/stats/category-leaderboards";
import type { Match, MatchEvent, Team } from "@/lib/types";

const teams: Team[] = [
  { id: "swe", iso2: "se", name: "Sweden", shortName: "SWE" },
  { id: "bra", iso2: "br", name: "Brazil", shortName: "BRA" },
  { id: "ger", iso2: "de", name: "Germany", shortName: "GER" },
];

const matches: Match[] = [
  {
    apiFootballFixtureId: 1,
    awayTeamId: "bra",
    city: "New York",
    homeTeamId: "swe",
    id: "m1",
    kickoffAt: "2026-06-11T19:00:00.000Z",
    lastSyncedAt: "2026-06-11T21:00:00.000Z",
    predictionLockAt: "2026-06-11T18:45:00.000Z",
    providerStatusCode: "FT",
    stage: "Group stage",
    status: "finished",
    venue: "MetLife Stadium",
  },
  {
    apiFootballFixtureId: 2,
    awayTeamId: "ger",
    city: "Miami",
    homeTeamId: "bra",
    id: "m2",
    kickoffAt: "2026-06-12T19:00:00.000Z",
    lastSyncedAt: "2026-06-12T21:00:00.000Z",
    predictionLockAt: "2026-06-12T18:45:00.000Z",
    providerStatusCode: "FT",
    stage: "Group stage",
    status: "finished",
    venue: "Hard Rock Stadium",
  },
];

function event(
  id: string,
  matchId: string,
  teamId: string,
  type: MatchEvent["type"],
  playerName: string,
  assistName?: string,
): MatchEvent {
  return {
    id,
    matchId,
    minute: 10,
    playerName,
    teamId,
    type,
    ...(assistName ? { assistName } : {}),
  };
}

describe("aggregateCategoryLeaderboards", () => {
  it("orders top scorers and assists with shared ranks for ties", () => {
    const boards = aggregateCategoryLeaderboards({
      events: [
        event("g1", "m1", "swe", "goal", "Alexander Isak", "Dejan Kulusevski"),
        event("g2", "m1", "swe", "goal", "Alexander Isak", "Dejan Kulusevski"),
        event("g3", "m2", "bra", "goal", "Vinicius Jr.", "Rodrygo"),
        event("g4", "m2", "bra", "goal", "Vinicius Jr.", "Rodrygo"),
      ],
      matches,
      teams,
    });

    expect(boards.topScorers).toMatchObject([
      { playerName: "Alexander Isak", rank: 1, value: 2 },
      { playerName: "Vinicius Jr.", rank: 1, value: 2 },
    ]);
    expect(boards.topAssists).toMatchObject([
      { playerName: "Dejan Kulusevski", rank: 1, value: 2 },
      { playerName: "Rodrygo", rank: 1, value: 2 },
    ]);
  });

  it("uses player stats for stat-covered matches and events for the rest", () => {
    const playerStats: PlayerStatSource[] = [
      {
        assists: 1,
        goals: 3,
        matchId: "m1",
        playerName: "Alexander Isak",
        redCards: 0,
        teamId: "swe",
        updatedAt: "2026-06-11T21:30:00.000Z",
        yellowCards: 0,
      },
    ];
    const boards = aggregateCategoryLeaderboards({
      events: [
        event("ignored-stat-match-goal", "m1", "swe", "goal", "Alexander Isak"),
        event("live-goal", "m2", "bra", "goal", "Vinicius Jr.", "Rodrygo"),
      ],
      matches,
      playerStats,
      teams,
    });

    expect(boards.topScorers).toMatchObject([
      { playerName: "Alexander Isak", rank: 1, value: 3 },
      { playerName: "Vinicius Jr.", rank: 2, value: 1 },
    ]);
  });
});

describe("country card points", () => {
  it("aggregates yellows as one point and reds as two", () => {
    const rows = aggregateCountryCardPoints({
      events: [
        event("swe-yellow", "m1", "swe", "yellow_card", "Victor Lindelof"),
        event("swe-red", "m1", "swe", "red_card", "Victor Lindelof"),
        event("bra-yellow", "m1", "bra", "yellow_card", "Casemiro"),
      ],
      matches,
      stats: [],
      teams,
    });

    expect(rows).toMatchObject([
      {
        points: 3,
        redCards: 1,
        rank: 1,
        teamId: "swe",
        yellowCards: 1,
      },
      {
        points: 1,
        redCards: 0,
        rank: 2,
        teamId: "bra",
        yellowCards: 1,
      },
    ]);
  });

  it("uses card events over player stats for matches with event cards", () => {
    const rows = aggregateCountryCardPoints({
      events: [
        event("swe-yellow", "m1", "swe", "yellow_card", "Victor Lindelof"),
        event("swe-red", "m1", "swe", "red_card", "Victor Lindelof"),
      ],
      matches,
      stats: [
        {
          assists: 0,
          goals: 0,
          matchId: "m1",
          playerName: "Victor Lindelof",
          redCards: 1,
          teamId: "swe",
          yellowCards: 0,
        },
      ],
      teams,
    });

    expect(rows).toMatchObject([
      {
        points: 3,
        redCards: 1,
        teamId: "swe",
        yellowCards: 1,
      },
    ]);
  });

  it("counts all tied card-points countries as winning options", () => {
    const rows = aggregateCountryCardPoints({
      events: [
        event("swe-red", "m1", "swe", "red_card", "Victor Lindelof"),
        event("ger-red", "m2", "ger", "red_card", "Antonio Rudiger"),
      ],
      matches,
      stats: [],
      teams,
    });

    expect(rows[0]).toMatchObject({ points: 2, rank: 1 });
    expect(rows[1]).toMatchObject({ points: 2, rank: 1 });
    expect(winningCountryCardOptionIds(rows).sort()).toEqual([
      "bonus-cards-ger",
      "bonus-cards-swe",
    ]);
  });
});
