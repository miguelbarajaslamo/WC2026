import { NextResponse } from "next/server";
import { STAGE_CATEGORIES } from "@/lib/stages";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Payload = {
  poolId?: string;
  stages?: string[];
};

const VALID = new Set(STAGE_CATEGORIES.map((category) => category.key));

export async function POST(request: Request) {
  const { poolId, stages } = (await request.json()) as Payload;

  if (!poolId || !Array.isArray(stages)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const cleaned = [...new Set(stages.filter((stage) => VALID.has(stage)))];

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("pool_members")
    .select("role")
    .eq("pool_id", poolId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (member?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("pools")
    .update({ score_prediction_stages: cleaned })
    .eq("id", poolId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, stages: cleaned });
}
