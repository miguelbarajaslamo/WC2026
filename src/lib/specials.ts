import { formatShortCountdown } from "@/lib/time";
import type { BonusPickType, BootstrapData } from "@/lib/types";

export const specialSlots: Array<{
  label: string;
  slot: number;
  type: BonusPickType;
}> = [
  { label: "Champion", slot: 1, type: "champion" },
  { label: "Finalist 1", slot: 1, type: "finalist" },
  { label: "Finalist 2", slot: 2, type: "finalist" },
  { label: "Top scorer", slot: 1, type: "top_scorer" },
  { label: "Most assists", slot: 1, type: "most_assists" },
  { label: "Most cards country", slot: 1, type: "most_cards_country" },
];

export const specialLabels: Record<BonusPickType, string> = {
  champion: "Champion",
  finalist: "Finalist",
  most_assists: "Most assists",
  most_cards_country: "Most cards country",
  top_scorer: "Top scorer",
};

export const specialPoints: Record<BonusPickType, number> = {
  champion: 10,
  finalist: 5,
  most_assists: 6,
  most_cards_country: 6,
  top_scorer: 8,
};

export function getBonusLockAt(data: BootstrapData) {
  if (data.pool.bonusLockAt) {
    return data.pool.bonusLockAt;
  }

  return [...data.matches].sort(
    (left, right) =>
      new Date(left.kickoffAt).getTime() - new Date(right.kickoffAt).getTime(),
  )[0]?.kickoffAt;
}

export function getSpecialsProgress(data: BootstrapData, now = new Date()) {
  const lockAt = getBonusLockAt(data);
  const locked = lockAt ? new Date(lockAt) <= now : false;
  const completed = specialSlots.filter((slot) =>
    data.bonusPicks.some(
      (pick) =>
        pick.userId === data.currentUserId &&
        pick.type === slot.type &&
        pick.slot === slot.slot,
    ),
  ).length;

  return {
    completed,
    isComplete: completed === specialSlots.length,
    lockAt,
    lockCountdown: lockAt ? formatShortCountdown(lockAt, now) : "",
    locked,
    total: specialSlots.length,
  };
}
