import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { endpoint } = (await request.json()) as { endpoint?: string };

  if (!endpoint) {
    return NextResponse.json({ error: "Endpoint is required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
