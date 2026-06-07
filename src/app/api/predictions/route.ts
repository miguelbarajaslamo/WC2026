import { NextResponse } from "next/server";
import { isValidPredictionScore, scoreResult } from "@/lib/predictions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PredictionPayload = {
  poolId?: string;
  matchId?: string;
  homeScore?: number;
  awayScore?: number;
};

export async function POST(request: Request) {
  const payload = (await request.json()) as PredictionPayload;

  if (
    !payload.poolId ||
    !payload.matchId ||
    !isValidPredictionScore(payload.homeScore) ||
    !isValidPredictionScore(payload.awayScore)
  ) {
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

  const [{ data: member }, { data: match }] = await Promise.all([
    supabase
      .from("pool_members")
      .select("pool_id")
      .eq("pool_id", payload.poolId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("matches")
      .select("id,prediction_lock_at")
      .eq("id", payload.matchId)
      .maybeSingle(),
  ]);

  if (!member) {
    return NextResponse.json({ error: "You are not a member of this pool" }, { status: 403 });
  }

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  if (new Date(match.prediction_lock_at) <= new Date()) {
    return NextResponse.json({ error: "This match is locked" }, { status: 403 });
  }

  const predictedResult = scoreResult(payload.homeScore, payload.awayScore);

  const { data, error } = await supabase
    .from("predictions")
    .upsert(
      {
        away_score: payload.awayScore,
        home_score: payload.homeScore,
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

  if (error) {
    return NextResponse.json({ error: "Could not save prediction" }, { status: 500 });
  }

  return NextResponse.json({ prediction: data });
}
