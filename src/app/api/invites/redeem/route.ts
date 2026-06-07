import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { code } = (await request.json()) as { code?: string };

  if (!code) {
    return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: invite, error: inviteError } = await admin
    .from("invites")
    .select("id,pool_id,expires_at,max_uses,use_count,revoked_at")
    .eq("code", code)
    .single();

  if (inviteError || !invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if (invite.revoked_at) {
    return NextResponse.json({ error: "Invite has been revoked" }, { status: 410 });
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
  }

  if (invite.max_uses && invite.use_count >= invite.max_uses) {
    const { data: existingMember } = await admin
      .from("pool_members")
      .select("pool_id")
      .eq("pool_id", invite.pool_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingMember) {
      return NextResponse.json({ ok: true, poolId: invite.pool_id, alreadyMember: true });
    }

    return NextResponse.json({ error: "Invite has already been used" }, { status: 410 });
  }

  const { data: existingMember } = await admin
    .from("pool_members")
    .select("pool_id")
    .eq("pool_id", invite.pool_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingMember) {
    return NextResponse.json({ ok: true, poolId: invite.pool_id, alreadyMember: true });
  }

  const { error: memberError } = await admin.from("pool_members").upsert(
    {
      pool_id: invite.pool_id,
      role: "player",
      user_id: user.id,
    },
    { onConflict: "pool_id,user_id" },
  );

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  await admin
    .from("invites")
    .update({ use_count: invite.use_count + 1 })
    .eq("id", invite.id);

  return NextResponse.json({ ok: true, poolId: invite.pool_id });
}
