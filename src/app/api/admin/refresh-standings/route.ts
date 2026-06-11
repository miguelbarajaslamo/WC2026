import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Pool-admin triggered standings refresh: runs the sync edge function in
// reference mode, which re-fetches the full fixture list and the official
// group standings from API-Football.
export async function POST(request: Request) {
  const { poolId } = (await request.json()) as { poolId?: string };

  if (!poolId) {
    return NextResponse.json({ error: "poolId is required" }, { status: 400 });
  }

  const cronSecret = process.env.CRON_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!cronSecret || !supabaseUrl) {
    return NextResponse.json(
      { error: "Sync is not configured on the server (missing CRON_SECRET)." },
      { status: 503 },
    );
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
    return NextResponse.json({ error: "Pool admin access required" }, { status: 403 });
  }

  // Functions host derives from the project URL: x.supabase.co → x.functions.supabase.co.
  const functionsUrl = `${supabaseUrl.replace(".supabase.co", ".functions.supabase.co")}/sync-world-cup?mode=reference`;

  try {
    const response = await fetch(functionsUrl, {
      body: JSON.stringify({ source: "admin-refresh-standings" }),
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };

    if (!response.ok) {
      return NextResponse.json(
        { error: body.error ?? "Standings sync failed." },
        { status: 502 },
      );
    }

    return NextResponse.json({ message: body.message ?? "Standings synced.", ok: true });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the sync function." },
      { status: 502 },
    );
  }
}
