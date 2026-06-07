import { describe, expect, it } from "vitest";
import {
  calculatePotScores,
  calculateTraditionalScore,
  determineResult,
} from "@/lib/scoring/scoring";
import type { Prediction } from "@/lib/types";

const basePrediction = {
  id: "prediction-1",
  poolId: "pool",
  matchId: "match",
  userId: "user",
  lockedAt: "2026-06-11T18:45:00Z",
  updatedAt: "2026-06-10T18:45:00Z",
} satisfies Omit<
  Prediction,
  "awayScore" | "homeScore" | "predictedResult"
>;

describe("determineResult", () => {
  it("returns home, away, or draw", () => {
    expect(determineResult({ homeScore: 2, awayScore: 1 })).toBe("home");
    expect(determineResult({ homeScore: 0, awayScore: 1 })).toBe("away");
    expect(determineResult({ homeScore: 1, awayScore: 1 })).toBe("draw");
  });
});

describe("calculateTraditionalScore", () => {
  it("awards exact score", () => {
    expect(
      calculateTraditionalScore(
        { ...basePrediction, predictedResult: "home", homeScore: 2, awayScore: 1 },
        { homeScore: 2, awayScore: 1 },
      ),
    ).toEqual({ points: 5, reason: "exact_score" });
  });

  it("awards correct result and goal difference", () => {
    expect(
      calculateTraditionalScore(
        { ...basePrediction, predictedResult: "home", homeScore: 3, awayScore: 1 },
        { homeScore: 2, awayScore: 0 },
      ),
    ).toEqual({ points: 4, reason: "correct_result_goal_difference" });
  });

  it("awards correct result only", () => {
    expect(
      calculateTraditionalScore(
        { ...basePrediction, predictedResult: "home", homeScore: 4, awayScore: 1 },
        { homeScore: 2, awayScore: 0 },
      ),
    ).toEqual({ points: 3, reason: "correct_result" });
  });

  it("awards zero for incorrect result or unfinished match", () => {
    expect(
      calculateTraditionalScore(
        { ...basePrediction, predictedResult: "away", homeScore: 0, awayScore: 2 },
        { homeScore: 2, awayScore: 0 },
      ).points,
    ).toBe(0);
    expect(
      calculateTraditionalScore(
        { ...basePrediction, predictedResult: "home", homeScore: 2, awayScore: 1 },
        null,
      ),
    ).toEqual({ points: 0, reason: "not_finished" });
  });
});

describe("calculatePotScores", () => {
  it("splits the result pot among correct result winners", () => {
    const result = calculatePotScores({
      activePlayerCount: 10,
      finalScore: { homeScore: 1, awayScore: 0 },
      predictions: [
        { ...basePrediction, id: "a", predictedResult: "home", homeScore: 1, awayScore: 0 },
        { ...basePrediction, id: "b", predictedResult: "home", homeScore: 2, awayScore: 0 },
        { ...basePrediction, id: "c", predictedResult: "away", homeScore: 0, awayScore: 1 },
      ],
    });

    expect(result.pointsByPredictionId.a).toBe(7);
    expect(result.pointsByPredictionId.b).toBe(5);
    expect(result.pointsByPredictionId.c).toBe(0);
    expect(result.resultWinners).toBe(2);
    expect(result.exactWinners).toEqual(["a"]);
  });

  it("does not create points when nobody picked the result", () => {
    const result = calculatePotScores({
      activePlayerCount: 10,
      finalScore: { homeScore: 1, awayScore: 1 },
      predictions: [
        { ...basePrediction, id: "a", predictedResult: "home", homeScore: 1, awayScore: 0 },
        { ...basePrediction, id: "b", predictedResult: "away", homeScore: 0, awayScore: 1 },
      ],
    });

    expect(result.pointsByPredictionId.a).toBe(0);
    expect(result.pointsByPredictionId.b).toBe(0);
  });
});
