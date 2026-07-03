import { describe, expect, it } from "vitest";
import {
  isValidPredictionScore,
  scoreContradictsAdvancement,
  scoreResult,
} from "@/lib/predictions";

describe("prediction helpers", () => {
  it("derives 1X2 from the submitted score", () => {
    expect(scoreResult(2, 1)).toBe("home");
    expect(scoreResult(1, 1)).toBe("draw");
    expect(scoreResult(0, 3)).toBe("away");
  });

  it("only accepts integer scores between 0 and 30", () => {
    expect(isValidPredictionScore(0)).toBe(true);
    expect(isValidPredictionScore(30)).toBe(true);
    expect(isValidPredictionScore(-1)).toBe(false);
    expect(isValidPredictionScore(31)).toBe(false);
    expect(isValidPredictionScore(1.5)).toBe(false);
    expect(isValidPredictionScore("2")).toBe(false);
  });

  it("allows a team to advance after a tied score", () => {
    expect(
      scoreContradictsAdvancement({
        awayScore: 2,
        homeScore: 2,
        result: "home",
      }),
    ).toBe(false);
  });

  it("blocks a score that has the opposite team winning before penalties", () => {
    expect(
      scoreContradictsAdvancement({
        awayScore: 3,
        homeScore: 2,
        result: "home",
      }),
    ).toBe(true);
  });
});
