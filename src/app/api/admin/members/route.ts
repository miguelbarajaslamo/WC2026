import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function validHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

// Admin edits another member's display name / avatar within their pool.
export async function PATCH(request: Request) {
  const { poolId, userId, displayName, avatarColor, clearPhoto } =
    (await request.json()) as {
      poolId?: string;
      userId?: string;
      displayName?: string;
      avatarColor?: string;
      clearPhoto?: boolean;
    };

  if (!poolId || !userId) {
    return NextResponse.json(
      { error: "poolId and userId are required" },
      { status: 400 },
    );
  }

  const name = displayName?.trim();
  const color = avatarColor?.trim();

  if (name !== undefined && (name.length < 2 || name.length > 40)) {
    return NextResponse.json(
      { error: "Display name must be 2-40 characters." },
      { status: 400 },
    );
  }
  if (color !== undefined && !validHexColor(color)) {
    return NextResponse.json({ error: "Avatar color must be a hex color." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: requesterMember } = await supabase
    .from("pool_members")
    .select("role")
    .eq("pool_id", poolId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (requesterMember?.role !== "admin") {
    return NextResponse.json({ error: "Pool admin access required" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { data: targetMember } = await admin
    .from("pool_members")
    .select("user_id")
    .eq("pool_id", poolId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!targetMember) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (name !== undefined) {
    update.display_name = name;
  }
  if (color !== undefined) {
    update.avatar_color = color;
  }
  if (clearPhoto) {
    update.avatar_url = null;
  }

  const { error } = await admin.from("profiles").update(update).eq("id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { poolId, userId } = (await request.json()) as {
    poolId?: string;
    userId?: string;
  };

  if (!poolId || !userId) {
    return NextResponse.json(
      { error: "poolId and userId are required" },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (user.id === userId) {
    return NextResponse.json(
      { error: "You cannot remove yourself from the pool." },
      { status: 400 },
    );
  }

  const { data: requesterMember } = await supabase
    .from("pool_members")
    .select("role")
    .eq("pool_id", poolId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (requesterMember?.role !== "admin") {
    return NextResponse.json({ error: "Pool admin access required" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { data: targetMember } = await admin
    .from("pool_members")
    .select("role")
    .eq("pool_id", poolId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!targetMember) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const { data: admins } = await admin
    .from("pool_members")
    .select("user_id")
    .eq("pool_id", poolId)
    .eq("role", "admin");

  if (targetMember.role === "admin" && (admins?.length ?? 0) <= 1) {
    return NextResponse.json(
      { error: "Cannot remove the only pool admin." },
      { status: 400 },
    );
  }

  await Promise.all([
    admin.from("predictions").delete().eq("pool_id", poolId).eq("user_id", userId),
    admin.from("bonus_picks").delete().eq("pool_id", poolId).eq("user_id", userId),
    admin.from("score_snapshots").delete().eq("pool_id", poolId).eq("user_id", userId),
    admin
      .from("bonus_score_snapshots")
      .delete()
      .eq("pool_id", poolId)
      .eq("user_id", userId),
  ]);

  const { error } = await admin
    .from("pool_members")
    .delete()
    .eq("pool_id", poolId)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
