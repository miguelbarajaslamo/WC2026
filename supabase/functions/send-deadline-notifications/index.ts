import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type MatchRow = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  prediction_lock_at: string;
};

type PoolMemberRow = {
  pool_id: string;
  user_id: string;
};

type PredictionRow = {
  match_id: string;
  pool_id: string;
  user_id: string;
};

type PushSubscriptionRow = {
  auth: string;
  endpoint: string;
  id: string;
  p256dh: string;
  user_id: string;
};

type ProfileRow = {
  id: string;
  notification_deadlines: boolean;
};

Deno.serve(async (request) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const authorization = request.headers.get("Authorization") ?? "";

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return Response.json(
      { error: "Missing Supabase or VAPID Edge Function secrets" },
      { status: 500 },
    );
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const { data: matches } = await supabase
    .from("matches")
    .select("id,home_team_id,away_team_id,prediction_lock_at")
    .gt("prediction_lock_at", now.toISOString())
    .lte("prediction_lock_at", windowEnd.toISOString())
    .eq("status", "scheduled")
    .returns<MatchRow[]>();

  if (!matches || matches.length === 0) {
    return Response.json({ created: 0, sent: 0 });
  }

  const matchIds = matches.map((match) => match.id);
  const { data: members } = await supabase
    .from("pool_members")
    .select("pool_id,user_id")
    .returns<PoolMemberRow[]>();
  const memberUserIds = [...new Set((members ?? []).map((member) => member.user_id))];
  const { data: profiles } =
    memberUserIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id,notification_deadlines")
          .in("id", memberUserIds)
          .returns<ProfileRow[]>()
      : { data: [] };
  const deadlineEnabledUserIds = new Set(
    (profiles ?? [])
      .filter((profile) => profile.notification_deadlines)
      .map((profile) => profile.id),
  );
  const { data: predictions } = await supabase
    .from("predictions")
    .select("pool_id,user_id,match_id")
    .in("match_id", matchIds)
    .returns<PredictionRow[]>();

  const existingPickKeys = new Set(
    (predictions ?? []).map(
      (prediction) =>
        `${prediction.pool_id}:${prediction.user_id}:${prediction.match_id}`,
    ),
  );

  const jobs = (members ?? [])
    .filter((member) => deadlineEnabledUserIds.has(member.user_id))
    .flatMap((member) =>
    matches
      .filter(
        (match) =>
          !existingPickKeys.has(`${member.pool_id}:${member.user_id}:${match.id}`),
      )
      .map((match) => ({
        body: "You have a match locking soon with no saved pick.",
        match_id: match.id,
        notification_type: "missing_pick_deadline",
        scheduled_for: now.toISOString(),
        title: "Pick deadline soon",
        url: `/matches/${match.id}`,
        user_id: member.user_id,
      })),
  );

  if (jobs.length > 0) {
    await supabase
      .from("notification_jobs")
      .upsert(jobs, { onConflict: "user_id,match_id,notification_type" });
  }

  const { data: dueJobs } = await supabase
    .from("notification_jobs")
    .select("id,user_id,title,body,url")
    .is("sent_at", null)
    .lte("scheduled_for", now.toISOString());

  const userIds = [...new Set((dueJobs ?? []).map((job) => job.user_id))];
  const { data: subscriptions } =
    userIds.length > 0
      ? await supabase
          .from("push_subscriptions")
          .select("id,user_id,endpoint,p256dh,auth")
          .in("user_id", userIds)
          .returns<PushSubscriptionRow[]>()
      : { data: [] };

  let sent = 0;
  for (const job of dueJobs ?? []) {
    const userSubscriptions = (subscriptions ?? []).filter(
      (subscription) => subscription.user_id === job.user_id,
    );

    if (userSubscriptions.length === 0) {
      await supabase
        .from("notification_jobs")
        .update({
          error: "No push subscription",
          sent_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      continue;
    }

    const errors: string[] = [];
    for (const subscription of userSubscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              auth: subscription.auth,
              p256dh: subscription.p256dh,
            },
          },
          JSON.stringify({
            body: job.body,
            title: job.title,
            url: job.url,
          }),
        );
        sent += 1;
      } catch (error) {
        const statusCode =
          typeof error === "object" && error && "statusCode" in error
            ? Number((error as { statusCode?: number }).statusCode)
            : 0;
        errors.push(error instanceof Error ? error.message : String(error));

        if (statusCode === 404 || statusCode === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", subscription.id);
        }
      }
    }

    await supabase
      .from("notification_jobs")
      .update({
        error: errors.length > 0 ? errors.join("; ").slice(0, 500) : null,
        sent_at: new Date().toISOString(),
      })
      .eq("id", job.id);
  }

  return Response.json({ created: jobs.length, sent });
});
