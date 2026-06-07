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

  it("awards most-cards country bonus points", () => {
    expect(
      calculateBonusScore({
        pick: { optionId: "bonus-cards-swe", type: "most_cards_country" },
        winningOptionIds: ["bonus-cards-swe"],
      }),
    ).toEqual({ points: 6, reason: "correct" });
  });

  it("scores all five official tournament specials", () => {
    expect(
      calculateBonusScore({
        pick: { optionId: "champion-swe", type: "champion" },
        winningOptionIds: ["champion-swe"],
      }).points,
    ).toBe(10);
    expect(
      calculateBonusScore({
        pick: { optionId: "finalist-bra", type: "finalist" },
        winningOptionIds: ["finalist-bra"],
      }).points,
    ).toBe(5);
    expect(
      calculateBonusScore({
        pick: { optionId: "player-isak", type: "top_scorer" },
        winningOptionIds: ["player-isak"],
      }).points,
    ).toBe(8);
    expect(
      calculateBonusScore({
        pick: { optionId: "player-kulu", type: "most_assists" },
        winningOptionIds: ["player-kulu"],
      }).points,
    ).toBe(6);
    expect(
      calculateBonusScore({
        pick: { optionId: "bonus-cards-col", type: "most_cards_country" },
        winningOptionIds: ["bonus-cards-col"],
      }).points,
    ).toBe(6);
  });

  it("counts tied country-card winners as correct", () => {
    expect(
      calculateBonusScore({
        pick: { optionId: "bonus-cards-swe", type: "most_cards_country" },
        winningOptionIds: ["bonus-cards-swe", "bonus-cards-ger"],
      }),
    ).toEqual({ points: 6, reason: "correct" });
  });
});
