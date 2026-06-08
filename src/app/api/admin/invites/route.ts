import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const codeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateInviteCode(length = 7) {
  const bytes = randomBytes(length);
  let code = "";

  for (let index = 0; index < length; index += 1) {
    code += codeAlphabet[bytes[index] % codeAlphabet.length];
  }

  return code;
}

async function requirePoolAdmin(poolId: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated", status: 401 as const };
  }

  const { data: member } = await supabase
    .from("pool_members")
    .select("role")
    .eq("pool_id", poolId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (member?.role !== "admin") {
    return { error: "Pool admin access required", status: 403 as const };
  }

  return { user };
}

export async function GET(request: Request) {
  const poolId = new URL(request.url).searchParams.get("poolId");

  if (!poolId) {
    return NextResponse.json({ error: "poolId is required" }, { status: 400 });
  }

  const access = await requirePoolAdmin(poolId);

  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("invites")
    .select("id,code,expires_at,max_uses,use_count,revoked_at,created_at")
    .eq("pool_id", poolId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invites: data ?? [] });
}

export async function POST(request: Request) {
  const { poolId } = (await request.json()) as { poolId?: string };

  if (!poolId) {
    return NextResponse.json({ error: "poolId is required" }, { status: 400 });
  }

  const access = await requirePoolAdmin(poolId);

  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const admin = createSupabaseAdminClient();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateInviteCode();
    const { data, error } = await admin
      .from("invites")
      .insert({
        code,
        created_by: access.user.id,
        pool_id: poolId,
      })
      .select("id,code,expires_at,max_uses,use_count,revoked_at,created_at")
      .single();

    if (!error && data) {
      return NextResponse.json({ invite: data });
    }

    if (error?.code !== "23505") {
      return NextResponse.json(
        { error: error?.message ?? "Could not create invite" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(
    { error: "Could not generate an invite code" },
    { status: 500 },
  );
}

export async function PATCH(request: Request) {
  const { inviteId, poolId, revoked } = (await request.json()) as {
    inviteId?: string;
    poolId?: string;
    revoked?: boolean;
  };

  if (!poolId || !inviteId) {
    return NextResponse.json(
      { error: "poolId and inviteId are required" },
      { status: 400 },
    );
  }

  const access = await requirePoolAdmin(poolId);

  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("invites")
    .update({ revoked_at: revoked === false ? null : new Date().toISOString() })
    .eq("id", inviteId)
    .eq("pool_id", poolId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
