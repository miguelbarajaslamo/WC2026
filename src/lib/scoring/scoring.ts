import type { Match, Prediction, PredictionResult } from "@/lib/types";

export type FinishedScore = {
  homeScore: number;
  awayScore: number;
};

export type TraditionalScoreBreakdown = {
  points: number;
  reason: "exact_score" | "correct_result" | "incorrect" | "not_finished";
};

export type PotScoreBreakdown = {
  pointsByPredictionId: Record<string, number>;
  resultWinners: number;
  exactWinners: string[];
  resultPot: number;
};

export const traditionalRules = {
  correctResult: 3,
  exactScoreBonus: 3,
};

export const potRules = {
  exactScoreBonus: 2,
};

export function determineResult(score: FinishedScore): PredictionResult {
  if (score.homeScore > score.awayScore) {
    return "home";
  }

  if (score.awayScore > score.homeScore) {
    return "away";
  }

  return "draw";
}

export function matchFinishedScore(match: Match): FinishedScore | null {
  if (
    match.status !== "finished" ||
    match.homeScore === undefined ||
    match.awayScore === undefined
  ) {
    return null;
  }

  return {
    awayScore: match.awayScore,
    homeScore: match.homeScore,
  };
}

export function calculateTraditionalScore(
  prediction: Pick<Prediction, "awayScore" | "homeScore" | "predictedResult">,
  finalScore: FinishedScore | null,
  // 1X2 (result-only) matches never award the exact-score bonus.
  scorePrediction = true,
): TraditionalScoreBreakdown {
  if (!finalScore) {
    return { points: 0, reason: "not_finished" };
  }

  const finalResult = determineResult(finalScore);

  if (prediction.predictedResult !== finalResult) {
    return { points: 0, reason: "incorrect" };
  }

  if (
    scorePrediction &&
    prediction.homeScore === finalScore.homeScore &&
    prediction.awayScore === finalScore.awayScore
  ) {
    return {
      points: traditionalRules.correctResult + traditionalRules.exactScoreBonus,
      reason: "exact_score",
    };
  }

  return {
    points: traditionalRules.correctResult,
    reason: "correct_result",
  };
}

export function calculatePotScores({
  activePlayerCount,
  finalScore,
  predictions,
  scorePrediction = true,
}: {
  activePlayerCount: number;
  finalScore: FinishedScore | null;
  predictions: Array<
    Pick<Prediction, "awayScore" | "homeScore" | "id" | "predictedResult">
  >;
  // 1X2 (result-only) matches never award the exact-score bonus.
  scorePrediction?: boolean;
}): PotScoreBreakdown {
  const pointsByPredictionId = Object.fromEntries(
    predictions.map((prediction) => [prediction.id, 0]),
  );

  if (!finalScore || predictions.length === 0 || activePlayerCount === 0) {
    return {
      exactWinners: [],
      pointsByPredictionId,
      resultPot: activePlayerCount,
      resultWinners: 0,
    };
  }

  const finalResult = determineResult(finalScore);
  const resultWinners = predictions.filter(
    (prediction) => prediction.predictedResult === finalResult,
  );
  const exactWinners = scorePrediction
    ? predictions
        .filter(
          (prediction) =>
            prediction.homeScore === finalScore.homeScore &&
            prediction.awayScore === finalScore.awayScore,
        )
        .map((prediction) => prediction.id)
    : [];

  const resultShare =
    resultWinners.length > 0 ? activePlayerCount / resultWinners.length : 0;

  resultWinners.forEach((prediction) => {
    pointsByPredictionId[prediction.id] += resultShare;
  });

  exactWinners.forEach((id) => {
    pointsByPredictionId[id] += potRules.exactScoreBonus;
  });

  return {
    exactWinners,
    pointsByPredictionId,
    resultPot: activePlayerCount,
    resultWinners: resultWinners.length,
  };
}
