import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/api/ensure-profile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Readable invite code, no ambiguous characters (0/O, 1/I).
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateInviteCode(length = 7) {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

export async function POST(request: Request) {
  try {
    return await createPool(request);
  } catch (error) {
    console.error("[pools] failed to create pool", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not create pool",
      },
      { status: 500 },
    );
  }
}

async function createPool(request: Request) {
  const { name, prizeNote } = (await request.json()) as {
    name?: string;
    prizeNote?: string;
  };

  const poolName = name?.trim();

  if (!poolName) {
    return NextResponse.json({ error: "Pool name is required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();

  await ensureProfile(admin, user);

  const { data: pool, error: poolError } = await admin
    .from("pools")
    .insert({
      created_by: user.id,
      name: poolName,
      prize_note: prizeNote?.trim() || null,
    })
    .select("id")
    .single();

  if (poolError || !pool) {
    return NextResponse.json(
      { error: poolError?.message ?? "Could not create pool" },
      { status: 500 },
    );
  }

  const { error: memberError } = await admin.from("pool_members").insert({
    pool_id: pool.id,
    user_id: user.id,
    role: "admin",
  });

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  // Mint an invite, retrying on the rare code collision.
  let inviteCode = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateInviteCode();
    const { error: inviteError } = await admin.from("invites").insert({
      pool_id: pool.id,
      code: candidate,
      created_by: user.id,
    });

    if (!inviteError) {
      inviteCode = candidate;
      break;
    }

    // 23505 = unique_violation; anything else is a real failure.
    if (inviteError.code !== "23505") {
      return NextResponse.json({ error: inviteError.message }, { status: 500 });
    }
  }

  if (!inviteCode) {
    return NextResponse.json(
      { error: "Could not generate an invite code" },
      { status: 500 },
    );
  }

  return NextResponse.json({ poolId: pool.id, inviteCode });
}

export async function PATCH(request: Request) {
  const { entryFee, name, poolId, swishNumber } = (await request.json()) as {
    entryFee?: number;
    name?: string;
    poolId?: string;
    swishNumber?: string;
  };

  if (!poolId) {
    return NextResponse.json({ error: "Missing pool" }, { status: 400 });
  }

  const update: {
    entry_fee?: number;
    name?: string;
    swish_number?: string | null;
  } = {};

  if (name !== undefined) {
    const poolName = name.trim();
    if (poolName.length < 2 || poolName.length > 60) {
      return NextResponse.json(
        { error: "Pool name must be 2-60 characters." },
        { status: 400 },
      );
    }
    update.name = poolName;
  }

  if (entryFee !== undefined) {
    if (!Number.isInteger(entryFee) || entryFee < 0 || entryFee > 1_000_000) {
      return NextResponse.json(
        { error: "Entry fee must be a whole number of kronor." },
        { status: 400 },
      );
    }
    update.entry_fee = entryFee;
  }

  if (swishNumber !== undefined) {
    const trimmed = swishNumber.trim();
    if (trimmed.length > 40) {
      return NextResponse.json({ error: "Swish number is too long." }, { status: 400 });
    }
    update.swish_number = trimmed || null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

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
    return NextResponse.json(
      { error: "Only the pool owner can change pool settings." },
      { status: 403 },
    );
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("pools").update(update).eq("id", poolId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
