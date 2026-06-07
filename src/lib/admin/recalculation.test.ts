import { describe, expect, it } from "vitest";
import { buildBonusScoreRows, buildMatchScoreRows } from "@/lib/admin/recalculation";
import type { BonusPick, Match, Prediction } from "@/lib/types";

const finishedMatch = {
  apiFootballFixtureId: 1,
  awayScore: 1,
  awayTeamId: "bra",
  city: "New York",
  homeScore: 2,
  homeTeamId: "swe",
  id: "match-1",
  kickoffAt: "2026-06-11T19:00:00.000Z",
  predictionLockAt: "2026-06-11T18:45:00.000Z",
  providerStatusCode: "FT",
  stage: "Group stage",
  status: "finished",
  venue: "MetLife Stadium",
  winner: "home",
} satisfies Match;

function prediction(
  id: string,
  homeScore: number,
  awayScore: number,
  predictedResult: Prediction["predictedResult"],
): Prediction {
  return {
    awayScore,
    homeScore,
    id,
    matchId: "match-1",
    poolId: "pool",
    predictedResult,
    updatedAt: "2026-06-10T12:00:00.000Z",
    userId: id,
  };
}

function bonusPick(
  userId: string,
  optionId: string,
  type: BonusPick["type"],
  slot = 1,
): BonusPick {
  return {
    id: `${userId}-${type}-${slot}`,
    optionId,
    poolId: "pool",
    slot,
    type,
    updatedAt: "2026-06-10T12:00:00.000Z",
    userId,
  };
}

describe("admin recalculation helpers", () => {
  it("builds traditional score rows with correct-result and exact-score points", () => {
    const rows = buildMatchScoreRows({
      activePlayerCount: 3,
      match: finishedMatch,
      poolId: "pool",
      predictions: [
        prediction("exact", 2, 1, "home"),
        prediction("result", 3, 1, "home"),
        prediction("miss", 1, 2, "away"),
      ],
      scoringMode: "traditional",
    });

    expect(rows).toMatchObject([
      { points: 6, reason: "exact_score", user_id: "exact" },
      { points: 3, reason: "correct_result", user_id: "result" },
      { points: 0, reason: "incorrect", user_id: "miss" },
    ]);
  });

  it("builds bonus score rows for tied winning options", () => {
    const rows = buildBonusScoreRows({
      picks: [
        bonusPick("u1", "bonus-cards-swe", "most_cards_country"),
        bonusPick("u2", "bonus-cards-ger", "most_cards_country"),
        bonusPick("u3", "bonus-cards-bra", "most_cards_country"),
      ],
      poolId: "pool",
      winners: [
        { optionId: "bonus-cards-swe", slot: 1, type: "most_cards_country" },
        { optionId: "bonus-cards-ger", slot: 1, type: "most_cards_country" },
      ],
    });

    expect(rows).toMatchObject([
      { points: 6, reason: "correct", user_id: "u1" },
      { points: 6, reason: "correct", user_id: "u2" },
      { points: 0, reason: "incorrect", user_id: "u3" },
    ]);
  });
});
