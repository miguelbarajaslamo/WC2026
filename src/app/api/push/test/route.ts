import { NextResponse } from "next/server";
import webpush from "web-push";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// web-push relies on Node crypto, so this handler must not run on the edge.
export const runtime = "nodejs";

type SubscriptionRow = {
  auth: string;
  endpoint: string;
  p256dh: string;
};

export async function POST() {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
  const subject = process.env.VAPID_SUBJECT ?? "mailto:notifications@worldcuppicks.app";

  if (!publicKey || !privateKey) {
    return NextResponse.json(
      { error: "Push is not configured: missing VAPID keys on the server." },
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

  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("auth, endpoint, p256dh")
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json(
      { error: "No push subscriptions found. Enable notifications first." },
      { status: 404 },
    );
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const payload = JSON.stringify({
    body: "If you can see this, push notifications are working. 🎉",
    title: "WORLD CUP PICKS — Test",
    url: "/picks",
  });

  const staleEndpoints: string[] = [];
  let sent = 0;

  await Promise.all(
    (subscriptions as SubscriptionRow[]).map(async (row) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { auth: row.auth, p256dh: row.p256dh },
          },
          payload,
        );
        sent += 1;
      } catch (sendError) {
        // 404/410 mean the subscription is gone for good — prune it.
        const statusCode = (sendError as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          staleEndpoints.push(row.endpoint);
        }
      }
    }),
  );

  if (staleEndpoints.length > 0) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .in("endpoint", staleEndpoints);
  }

  if (sent === 0) {
    return NextResponse.json(
      { error: "Could not deliver to any of your devices. Try re-enabling notifications." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, sent });
}
