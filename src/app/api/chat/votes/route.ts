import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type VoteMessageRow = {
  id: string;
  pool_id: string;
  vote_closed_at: string | null;
  vote_options: string[] | null;
  vote_question: string | null;
};

async function loadVoteMessage(messageId: string) {
  const admin = createSupabaseAdminClient();
  const { data: message } = await admin
    .from("pool_messages")
    .select("id,pool_id,vote_question,vote_options,vote_closed_at")
    .eq("id", messageId)
    .maybeSingle<VoteMessageRow>();

  if (!message || !message.vote_question || !message.vote_options) {
    return null;
  }

  return message;
}

export async function POST(request: Request) {
  const { messageId, optionIndex } = (await request.json()) as {
    messageId?: string;
    optionIndex?: number;
  };

  if (!messageId || typeof optionIndex !== "number") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const message = await loadVoteMessage(messageId);

  if (!message) {
    return NextResponse.json({ error: "Vote not found" }, { status: 404 });
  }

  if (message.vote_closed_at) {
    return NextResponse.json({ error: "This vote is closed." }, { status: 409 });
  }

  if (optionIndex < 0 || optionIndex >= (message.vote_options?.length ?? 0)) {
    return NextResponse.json({ error: "Invalid option" }, { status: 400 });
  }

  const { data: member } = await supabase
    .from("pool_members")
    .select("user_id")
    .eq("pool_id", message.pool_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "Not a pool member" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("pool_vote_responses").upsert(
    {
      message_id: messageId,
      option_index: optionIndex,
      user_id: user.id,
    },
    { onConflict: "message_id,user_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const { messageId } = (await request.json()) as { messageId?: string };

  if (!messageId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const message = await loadVoteMessage(messageId);

  if (!message) {
    return NextResponse.json({ error: "Vote not found" }, { status: 404 });
  }

  const { data: member } = await supabase
    .from("pool_members")
    .select("role")
    .eq("pool_id", message.pool_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (member?.role !== "admin") {
    return NextResponse.json(
      { error: "Only the pool owner can close a vote." },
      { status: 403 },
    );
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("pool_messages")
    .update({ vote_closed_at: new Date().toISOString() })
    .eq("id", messageId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
