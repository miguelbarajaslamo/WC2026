import { describe, expect, it } from "vitest";
import { calculateBonusScore } from "@/lib/scoring/bonus";

describe("calculateBonusScore", () => {
  it("awards configured points when the option wins", () => {
    expect(
      calculateBonusScore({
        pick: { optionId: "winner", type: "champion" },
        winningOptionIds: ["winner"],
      }),
    ).toEqual({ points: 10, reason: "correct" });
  });

  it("awards zero when the option misses", () => {
    expect(
      calculateBonusScore({
        pick: { optionId: "miss", type: "top_scorer" },
        winningOptionIds: ["winner"],
      }),
    ).toEqual({ points: 0, reason: "incorrect" });
  });
});
