import { describe, expect, it } from "vitest";
import { scoreText, teamScoreText } from "@/lib/format";
import type { Match } from "@/lib/types";

const baseMatch = {
  apiFootballFixtureId: 1,
  awayTeamId: "away",
  city: "City",
  homeTeamId: "home",
  id: "match",
  kickoffAt: "2026-06-11T19:00:00.000Z",
  predictionLockAt: "2026-06-11T18:45:00.000Z",
  providerStatusCode: "PEN",
  stage: "Round of 32",
  status: "finished",
  venue: "Venue",
} satisfies Partial<Match>;

describe("score formatting", () => {
  it("shows penalty shootout scores after the regular score", () => {
    const match = {
      ...baseMatch,
      awayPenaltyScore: 5,
      awayScore: 1,
      homePenaltyScore: 4,
      homeScore: 1,
    } as Match;

    expect(scoreText(match)).toBe("1(4)-1(5)");
    expect(teamScoreText(match.homeScore, match.homePenaltyScore)).toBe("1 (4)");
  });

  it("keeps normal score formatting when there was no shootout", () => {
    expect(
      scoreText({
        ...baseMatch,
        awayScore: 0,
        homeScore: 2,
        providerStatusCode: "FT",
      } as Match),
    ).toBe("2-0");
  });
});
