import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BonusPickType } from "@/lib/types";

type BonusPickPayload = {
  optionId?: string;
  poolId?: string;
  slot?: number;
  type?: BonusPickType;
};

export async function POST(request: Request) {
  const payload = (await request.json()) as BonusPickPayload;

  if (!payload.poolId || !payload.type || !payload.optionId) {
    return NextResponse.json({ error: "Invalid bonus pick payload" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("bonus_picks")
    .upsert(
      {
        option_id: payload.optionId,
        pool_id: payload.poolId,
        slot: payload.slot ?? 1,
        type: payload.type,
        updated_at: new Date().toISOString(),
        user_id: user.id,
      },
      { onConflict: "pool_id,user_id,type,slot" },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ bonusPick: data });
}
