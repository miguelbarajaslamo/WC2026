import type { BonusPick, BonusPickType } from "@/lib/types";

export const bonusRules: Record<BonusPickType, number> = {
  champion: 10,
  finalist: 5,
  most_assists: 6,
  most_cards_country: 6,
  top_scorer: 8,
};

export function calculateBonusScore({
  pick,
  winningOptionIds,
}: {
  pick: Pick<BonusPick, "optionId" | "type">;
  winningOptionIds: string[];
}) {
  if (!winningOptionIds.includes(pick.optionId)) {
    return {
      points: 0,
      reason: "incorrect",
    };
  }

  return {
    points: bonusRules[pick.type],
    reason: "correct",
  };
}
