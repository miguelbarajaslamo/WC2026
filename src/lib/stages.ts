// Stage categories used to decide which rounds use full score prediction
// versus result-only (1X2). A pool stores the category keys that are score
// prediction; everything else is 1X2.

import type { Match } from "@/lib/types";

export const STAGE_CATEGORIES: Array<{ key: string; label: string }> = [
  { key: "group", label: "Group Stage" },
  { key: "r32", label: "Round of 32" },
  { key: "r16", label: "Round of 16" },
  { key: "qf", label: "Quarter-finals" },
  { key: "sf", label: "Semi-finals" },
  { key: "final", label: "Final / 3rd place" },
];

export function stageCategory(stage: string): string {
  const s = stage.toLowerCase();
  if (s.includes("group")) return "group";
  if (s.includes("round of 32") || s.includes("1/16")) return "r32";
  if (s.includes("round of 16") || s.includes("1/8")) return "r16";
  if (s.includes("quarter") || s.includes("1/4")) return "qf";
  if (s.includes("semi") || s.includes("1/2")) return "sf";
  if (s.includes("final") || s.includes("3rd place") || s.includes("third place")) {
    return "final";
  }
  return "group";
}

export function isGroupStage(stage: string) {
  return stageCategory(stage) === "group";
}

export function isKnockoutStage(stage: string) {
  return !isGroupStage(stage);
}

export function groupStageComplete(matches: Match[]) {
  const groupMatches = matches.filter((match) => isGroupStage(match.stage));

  return (
    groupMatches.length > 0 &&
    groupMatches.every((match) =>
      ["cancelled", "finished", "postponed"].includes(match.status),
    )
  );
}

// True when this match's stage uses full score prediction for the pool.
export function matchUsesScorePrediction(
  scorePredictionStages: string[] | undefined,
  stage: string,
): boolean {
  return (scorePredictionStages ?? []).includes(stageCategory(stage));
}
