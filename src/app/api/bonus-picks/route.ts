import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supportedBonusPickTypes, type BonusPickType } from "@/lib/types";

type BonusPickPayload = {
  optionId?: string;
  poolId?: string;
  slot?: number;
  type?: BonusPickType;
};

function isBonusPickType(value: unknown): value is BonusPickType {
  return (
    typeof value === "string" &&
    (supportedBonusPickTypes as readonly string[]).includes(value)
  );
}

export async function POST(request: Request) {
  const payload = (await request.json()) as BonusPickPayload;
  const slot = payload.slot ?? 1;

  if (
    !payload.poolId ||
    !isBonusPickType(payload.type) ||
    !payload.optionId ||
    !Number.isInteger(slot) ||
    slot < 1 ||
    slot > 2
  ) {
    return NextResponse.json({ error: "Invalid bonus pick payload" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [{ data: member }, { data: pool }, { data: option }] = await Promise.all([
    supabase
      .from("pool_members")
      .select("pool_id")
      .eq("pool_id", payload.poolId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("pools")
      .select("id,bonus_lock_at")
      .eq("id", payload.poolId)
      .maybeSingle(),
    supabase
      .from("bonus_pick_options")
      .select("id,type,active")
      .eq("id", payload.optionId)
      .eq("type", payload.type)
      .eq("active", true)
      .maybeSingle(),
  ]);

  if (!member) {
    return NextResponse.json({ error: "You are not a member of this pool" }, { status: 403 });
  }

  if (!pool) {
    return NextResponse.json({ error: "Pool not found" }, { status: 404 });
  }

  if (!option) {
    return NextResponse.json({ error: "Bonus pick option not found" }, { status: 404 });
  }

  let bonusLockAt = pool.bonus_lock_at ? new Date(pool.bonus_lock_at) : undefined;

  if (!bonusLockAt) {
    const { data: firstMatch } = await supabase
      .from("matches")
      .select("prediction_lock_at")
      .order("kickoff_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    // Lock specials at the first match's pick lock (15 min before kickoff).
    bonusLockAt = firstMatch?.prediction_lock_at
      ? new Date(firstMatch.prediction_lock_at)
      : undefined;
  }

  if (bonusLockAt && bonusLockAt <= new Date()) {
    return NextResponse.json({ error: "Tournament specials are locked" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("bonus_picks")
    .upsert(
      {
        option_id: payload.optionId,
        pool_id: payload.poolId,
        slot,
        type: payload.type,
        updated_at: new Date().toISOString(),
        user_id: user.id,
      },
      { onConflict: "pool_id,user_id,type,slot" },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Could not save bonus pick" }, { status: 500 });
  }

  return NextResponse.json({ bonusPick: data });
}
