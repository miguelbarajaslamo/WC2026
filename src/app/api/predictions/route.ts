import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PredictionResult } from "@/lib/types";

type PredictionPayload = {
  poolId?: string;
  matchId?: string;
  predictedResult?: PredictionResult;
  homeScore?: number;
  awayScore?: number;
};

export async function POST(request: Request) {
  const payload = (await request.json()) as PredictionPayload;

  if (
    !payload.poolId ||
    !payload.matchId ||
    !payload.predictedResult ||
    payload.homeScore === undefined ||
    payload.awayScore === undefined
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

  const { data, error } = await supabase
    .from("predictions")
    .upsert(
      {
        away_score: payload.awayScore,
        home_score: payload.homeScore,
        match_id: payload.matchId,
        pool_id: payload.poolId,
        predicted_result: payload.predictedResult,
        updated_at: new Date().toISOString(),
        user_id: user.id,
      },
      { onConflict: "pool_id,match_id,user_id" },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ prediction: data });
}
