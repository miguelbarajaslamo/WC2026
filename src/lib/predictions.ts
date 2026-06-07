import type { PredictionResult } from "@/lib/types";

export function scoreResult(homeScore: number, awayScore: number): PredictionResult {
  if (homeScore > awayScore) {
    return "home";
  }

  if (awayScore > homeScore) {
    return "away";
  }

  return "draw";
}

export function predictionResultLabel({
  awayShortName,
  homeShortName,
  result,
}: {
  awayShortName: string;
  homeShortName: string;
  result: PredictionResult;
}) {
  if (result === "home") {
    return homeShortName;
  }

  if (result === "away") {
    return awayShortName;
  }

  return "Draw";
}
