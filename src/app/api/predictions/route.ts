import { NextResponse } from "next/server";
import { isValidPredictionScore, scoreResult } from "@/lib/predictions";
import { isKnockoutStage, matchUsesScorePrediction } from "@/lib/stages";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PredictionResult } from "@/lib/types";

type PredictionPayload = {
  poolId?: string;
  matchId?: string;
  homeScore?: number;
  awayScore?: number;
  result?: PredictionResult;
};

const RESULTS: PredictionResult[] = ["home", "draw", "away"];

export async function POST(request: Request) {
  const payload = (await request.json()) as PredictionPayload;

  if (!payload.poolId || !payload.matchId) {
    return NextResponse.json({ error: "Invalid prediction payload" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [{ data: member }, { data: match }, { data: pool }] = await Promise.all([
    supabase
      .from("pool_members")
      .select("pool_id")
      .eq("pool_id", payload.poolId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("matches")
      .select("id,prediction_lock_at,stage")
      .eq("id", payload.matchId)
      .maybeSingle(),
    supabase
      .from("pools")
      .select("score_prediction_stages")
      .eq("id", payload.poolId)
      .maybeSingle(),
  ]);

  if (!member) {
    return NextResponse.json({ error: "You are not a member of this pool" }, { status: 403 });
  }

  if (!match || !pool) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  if (new Date(match.prediction_lock_at) <= new Date()) {
    return NextResponse.json({ error: "This match is locked" }, { status: 403 });
  }

  const knockout = isKnockoutStage(match.stage);
  const useScore =
    !knockout &&
    matchUsesScorePrediction(pool.score_prediction_stages ?? [], match.stage);

  let predictedResult: PredictionResult;
  let homeScore: number;
  let awayScore: number;

  if (useScore) {
    if (
      !isValidPredictionScore(payload.homeScore) ||
      !isValidPredictionScore(payload.awayScore)
    ) {
      return NextResponse.json({ error: "Invalid prediction payload" }, { status: 400 });
    }
    homeScore = payload.homeScore;
    awayScore = payload.awayScore;
    predictedResult = scoreResult(homeScore, awayScore);
  } else {
    // 1X2: a result-only pick. Scores are stored as 0-0 and ignored by scoring.
    if (!payload.result || !RESULTS.includes(payload.result)) {
      return NextResponse.json({ error: "Invalid prediction payload" }, { status: 400 });
    }
    if (knockout && payload.result === "draw") {
      return NextResponse.json(
        { error: "Knockout picks must choose who advances" },
        { status: 400 },
      );
    }
    predictedResult = payload.result;
    homeScore = 0;
    awayScore = 0;
  }

  // The request is fully authorized above with the user's session. Use the
  // service-role client for the write so inserts and conflict updates behave
  // identically and cannot diverge because of RLS/upsert edge cases.
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("predictions")
    .upsert(
      {
        away_score: awayScore,
        home_score: homeScore,
        match_id: payload.matchId,
        pool_id: payload.poolId,
        predicted_result: predictedResult,
        updated_at: new Date().toISOString(),
        user_id: user.id,
      },
      { onConflict: "pool_id,match_id,user_id" },
    )
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Could not save prediction" },
      { status: 500 },
    );
  }

  return NextResponse.json({ prediction: data });
}
