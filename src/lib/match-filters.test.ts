import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { filterFixturesMatches, filterPicksMatches } from "@/lib/match-filters";
import type { BootstrapData, Match } from "@/lib/types";

const baseMatch = {
  apiFootballFixtureId: 1,
  awayTeamId: "bra",
  city: "New York",
  homeTeamId: "swe",
  kickoffAt: "2026-06-11T19:00:00.000Z",
  predictionLockAt: "2026-06-11T18:45:00.000Z",
  providerStatusCode: "NS",
  stage: "Group stage",
  status: "scheduled",
  venue: "MetLife Stadium",
} satisfies Omit<Match, "id">;

function match(id: string, kickoffAt: string, predictionLockAt: string, status: Match["status"]) {
  return {
    ...baseMatch,
    apiFootballFixtureId: Number(id.replace(/\D/g, "")) || 1,
    id,
    kickoffAt,
    predictionLockAt,
    status,
  };
}

const data = {
  currentUserId: "u1",
  matches: [
    match("late-open", "2026-06-12T20:00:00.000Z", "2026-06-12T19:45:00.000Z", "scheduled"),
    match("early-open", "2026-06-11T20:00:00.000Z", "2026-06-11T19:45:00.000Z", "scheduled"),
    match("finished", "2026-06-10T20:00:00.000Z", "2026-06-10T19:45:00.000Z", "finished"),
  ],
  predictions: [
    {
      awayScore: 1,
      homeScore: 2,
      id: "p1",
      matchId: "late-open",
      poolId: "pool",
      predictedResult: "home",
      updatedAt: "2026-06-01T12:00:00.000Z",
      userId: "u1",
    },
  ],
  teams: [
    { id: "swe", name: "Sweden", shortName: "SWE" },
    { id: "bra", name: "Brazil", shortName: "BRA" },
  ],
} as BootstrapData;

describe("match filters", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps picks sorted by kickoff", () => {
    expect(filterPicksMatches(data, "all").map((item) => item.id)).toEqual([
      "finished",
      "early-open",
      "late-open",
    ]);
  });

  it("filters missing picks to unlocked matches without a current-user prediction", () => {
    expect(filterPicksMatches(data, "missing").map((item) => item.id)).toEqual([
      "early-open",
    ]);
  });

  it("filters fixtures by upcoming and finished state", () => {
    expect(filterFixturesMatches({ data, filter: "upcoming" }).map((item) => item.id)).toEqual([
      "early-open",
      "late-open",
    ]);
    expect(filterFixturesMatches({ data, filter: "finished" }).map((item) => item.id)).toEqual([
      "finished",
    ]);
  });
});
