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
  quiet_hours_enabled: boolean | null;
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
  timezone: string | null;
};

type QuietSettings = {
  enabled: boolean;
  start: number;
  end: number;
  timeZone: string | null;
};

// How far before lock we'd ideally remind, and how far ahead we look so overnight
// reminders can be pre-scheduled for the previous evening's window close.
const LEAD_MS = 2 * 60 * 60 * 1000;
const LOOKAHEAD_MS = 48 * 60 * 60 * 1000;
const CLOSE_BUFFER_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Offset (local − UTC) in ms for a timezone at a given instant.
function tzOffsetMs(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  });
  const parts: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    parts[part.type] = part.value;
  }
  let hour = Number(parts.hour);
  if (hour === 24) {
    hour = 0;
  }
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

// A local wall-clock time in a timezone → the matching UTC instant.
function wallTimeToUtc(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const asUtc = Date.UTC(year, monthIndex, day, hour, minute);
  const offset1 = tzOffsetMs(timeZone, new Date(asUtc));
  let utc = asUtc - offset1;
  const offset2 = tzOffsetMs(timeZone, new Date(utc));
  if (offset2 !== offset1) {
    utc = asUtc - offset2;
  }
  return new Date(utc);
}

// Local calendar parts + hour for an instant in a timezone.
function localParts(timeZone: string, date: Date) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    month: "2-digit",
    timeZone,
    year: "numeric",
  });
  const parts: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    parts[part.type] = part.value;
  }
  let hour = Number(parts.hour);
  if (hour === 24) {
    hour = 0;
  }
  return {
    day: Number(parts.day),
    hour,
    monthIndex: Number(parts.month) - 1,
    year: Number(parts.year),
  };
}

// When to actually deliver a reminder for a match locking at lockAt.
function computeScheduledFor(
  lockAt: Date,
  settings: QuietSettings,
  now: Date,
): Date {
  const ideal = new Date(lockAt.getTime() - LEAD_MS);
  const clampPast = (date: Date) => (date.getTime() < now.getTime() ? now : date);

  // No quiet hours (or an invalid/degenerate window): remind at the ideal time.
  if (
    !settings.enabled ||
    !settings.timeZone ||
    settings.start >= settings.end
  ) {
    return clampPast(ideal);
  }

  const { start, end, timeZone } = settings;
  const idealLocal = localParts(timeZone, ideal);

  // Already inside the window — deliver at the ideal time.
  if (idealLocal.hour >= start && idealLocal.hour < end) {
    return clampPast(ideal);
  }

  // Otherwise deliver just before the most recent window close at/before ideal.
  let close = new Date(
    wallTimeToUtc(
      idealLocal.year,
      idealLocal.monthIndex,
      idealLocal.day,
      end,
      0,
      timeZone,
    ).getTime() - CLOSE_BUFFER_MS,
  );

  // If that close is after ideal, ideal must be before the window opened today;
  // fall back to the previous local day's close.
  if (close.getTime() > ideal.getTime()) {
    const prevLocal = localParts(timeZone, new Date(ideal.getTime() - DAY_MS));
    close = new Date(
      wallTimeToUtc(
        prevLocal.year,
        prevLocal.monthIndex,
        prevLocal.day,
        end,
        0,
        timeZone,
      ).getTime() - CLOSE_BUFFER_MS,
    );
  }

  // Never schedule in the past, and always strictly before the lock.
  let result = clampPast(close);
  if (result.getTime() >= lockAt.getTime()) {
    result = new Date(lockAt.getTime() - 60 * 1000);
  }
  return result;
}

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
  const windowEnd = new Date(now.getTime() + LOOKAHEAD_MS);

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
          .select(
            "id,notification_deadlines,quiet_hours_enabled,quiet_hours_start,quiet_hours_end,timezone",
          )
          .in("id", memberUserIds)
          .returns<ProfileRow[]>()
      : { data: [] };
  const deadlineEnabledUserIds = new Set(
    (profiles ?? [])
      .filter((profile) => profile.notification_deadlines)
      .map((profile) => profile.id),
  );
  const quietByUser = new Map<string, QuietSettings>();
  for (const profile of profiles ?? []) {
    quietByUser.set(profile.id, {
      enabled: profile.quiet_hours_enabled ?? false,
      end: profile.quiet_hours_end ?? 23,
      start: profile.quiet_hours_start ?? 9,
      timeZone: profile.timezone,
    });
  }
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

  const defaultQuiet: QuietSettings = {
    enabled: false,
    end: 23,
    start: 9,
    timeZone: null,
  };

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
        scheduled_for: computeScheduledFor(
          new Date(match.prediction_lock_at),
          quietByUser.get(member.user_id) ?? defaultQuiet,
          now,
        ).toISOString(),
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
    .select("id,user_id,match_id,title,body,url")
    .is("sent_at", null)
    .lte("scheduled_for", now.toISOString());

  // A pick may have been made after a job was scheduled (jobs can be created up
  // to 48h ahead). Drop jobs whose user now has a prediction for that match so
  // we never nag someone who already picked.
  const dueMatchIds = [
    ...new Set(
      (dueJobs ?? [])
        .map((job) => job.match_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: duePredictions } =
    dueMatchIds.length > 0
      ? await supabase
          .from("predictions")
          .select("user_id,match_id")
          .in("match_id", dueMatchIds)
          .returns<Pick<PredictionRow, "match_id" | "user_id">[]>()
      : { data: [] };
  const pickedKeys = new Set(
    (duePredictions ?? []).map(
      (prediction) => `${prediction.user_id}:${prediction.match_id}`,
    ),
  );

  const userIds = [...new Set((dueJobs ?? []).map((job) => job.user_id))];
  const { data: subscriptions } =
    userIds.length > 0
      ? await supabase
          .from("push_subscriptions")
          .select("id,user_id,endpoint,p256dh,auth")
          .in("user_id", userIds)
          .returns<PushSubscriptionRow[]>()
      : { data: [] };

  // Drop jobs the user has already picked for; group the rest by user so that
  // several matches locking at once become a single coalesced notification.
  const staleJobIds: string[] = [];
  const jobsByUser = new Map<string, NonNullable<typeof dueJobs>>();
  for (const job of dueJobs ?? []) {
    if (job.match_id && pickedKeys.has(`${job.user_id}:${job.match_id}`)) {
      staleJobIds.push(job.id);
      continue;
    }
    const list = jobsByUser.get(job.user_id) ?? [];
    list.push(job);
    jobsByUser.set(job.user_id, list);
  }

  if (staleJobIds.length > 0) {
    await supabase.from("notification_jobs").delete().in("id", staleJobIds);
  }

  let sent = 0;
  for (const [userId, userJobs] of jobsByUser) {
    const jobIds = userJobs.map((job) => job.id);
    const userSubscriptions = (subscriptions ?? []).filter(
      (subscription) => subscription.user_id === userId,
    );

    if (userSubscriptions.length === 0) {
      await supabase
        .from("notification_jobs")
        .update({ error: "No push subscription", sent_at: new Date().toISOString() })
        .in("id", jobIds);
      continue;
    }

    // One match → its own message; several due at once → a single summary.
    const payload =
      userJobs.length === 1
        ? { body: userJobs[0].body, title: userJobs[0].title, url: userJobs[0].url }
        : {
            body: `You have ${userJobs.length} matches locking soon with no saved pick.`,
            title: "Picks locking soon",
            url: "/picks",
          };
    const payloadJson = JSON.stringify(payload);

    const errors: string[] = [];
    for (const subscription of userSubscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { auth: subscription.auth, p256dh: subscription.p256dh },
          },
          payloadJson,
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
      .in("id", jobIds);
  }

  return Response.json({ created: jobs.length, sent });
});
