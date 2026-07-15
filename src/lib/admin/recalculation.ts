import { calculateBonusScore } from "@/lib/scoring/bonus";
import {
  calculatePotScores,
  calculateTraditionalScore,
  matchFinishedResult,
  matchFinishedScore,
} from "@/lib/scoring/scoring";
import type {
  BonusPick,
  Match,
  Prediction,
  ScoringMode,
} from "@/lib/types";

export type ScoreSnapshotUpsert = {
  match_id: string;
  points: number;
  pool_id: string;
  reason: string;
  scoring_mode: ScoringMode;
  user_id: string;
};

export type BonusWinner = {
  optionId: string;
  slot: number;
  type: BonusPick["type"];
};

export type BonusScoreSnapshotUpsert = {
  points: number;
  pool_id: string;
  reason: string;
  slot: number;
  type: BonusPick["type"];
  user_id: string;
};

export function buildMatchScoreRows({
  activePlayerCount,
  match,
  poolId,
  predictions,
  scoringMode,
  scorePrediction = true,
}: {
  activePlayerCount: number;
  match: Match;
  poolId: string;
  predictions: Prediction[];
  scoringMode: ScoringMode;
  scorePrediction?: boolean;
}): ScoreSnapshotUpsert[] {
  const finalScore = matchFinishedScore(match);
  const finalResult = matchFinishedResult(match);

  if (scoringMode === "pot") {
    const potScores = calculatePotScores({
      activePlayerCount,
      finalScore,
      finalResult,
      predictions,
      scorePrediction,
    });

    return predictions.map((prediction) => ({
      match_id: match.id,
      points: potScores.pointsByPredictionId[prediction.id] ?? 0,
      pool_id: poolId,
      reason: potScores.exactWinners.includes(prediction.id)
        ? "exact_score"
        : potScores.pointsByPredictionId[prediction.id] > 0
          ? "pot_correct_result"
          : "incorrect",
      scoring_mode: scoringMode,
      user_id: prediction.userId,
    }));
  }

  return predictions.map((prediction) => {
    const score = calculateTraditionalScore(
      prediction,
      finalScore,
      scorePrediction,
      finalResult,
    );

    return {
      match_id: match.id,
      points: score.points,
      pool_id: poolId,
      reason: score.reason,
      scoring_mode: scoringMode,
      user_id: prediction.userId,
    };
  });
}

export function buildBonusScoreRows({
  picks,
  poolId,
  winners,
}: {
  picks: BonusPick[];
  poolId: string;
  winners: BonusWinner[];
}): BonusScoreSnapshotUpsert[] {
  return picks.flatMap((pick) => {
    // Finalists are an unordered pair: a Spain pick saved as "Finalist 2" must
    // score when Spain reaches the final, regardless of which slot the winner
    // row (or the pick) used. Other types are single-slot, so slots match.
    const matchingWinners = winners.filter(
      (item) =>
        item.type === pick.type &&
        (pick.type === "finalist" || item.slot === pick.slot),
    );

    if (matchingWinners.length === 0) {
      return [];
    }

    const score = calculateBonusScore({
      pick,
      winningOptionIds: matchingWinners.map((winner) => winner.optionId),
    });

    return [
      {
        points: score.points,
        pool_id: poolId,
        reason: score.reason,
        slot: pick.slot,
        type: pick.type,
        user_id: pick.userId,
      },
    ];
  });
}
