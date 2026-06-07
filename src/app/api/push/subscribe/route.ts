import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { subscription } = (await request.json()) as {
    subscription?: PushSubscriptionJSON;
  };

  if (!subscription?.endpoint || !subscription.keys?.auth || !subscription.keys?.p256dh) {
    return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      auth: subscription.keys.auth,
      endpoint: subscription.endpoint,
      last_seen_at: new Date().toISOString(),
      p256dh: subscription.keys.p256dh,
      user_agent: request.headers.get("user-agent"),
      user_id: user.id,
    },
    { onConflict: "user_id,endpoint" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
