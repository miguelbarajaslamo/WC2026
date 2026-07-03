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

export function isValidPredictionScore(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 30;
}

export function scoreContradictsAdvancement({
  awayScore,
  homeScore,
  result,
}: {
  awayScore: number;
  homeScore: number;
  result: PredictionResult;
}) {
  const scoreWinner = scoreResult(homeScore, awayScore);

  return scoreWinner !== "draw" && scoreWinner !== result;
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
