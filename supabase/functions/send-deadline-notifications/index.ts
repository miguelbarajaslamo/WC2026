import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type MatchRow = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  prediction_lock_at: string;
  kickoff_at: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
};

type TeamNameRow = {
  id: string;
  short_name: string;
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
  notification_match_locks: boolean | null;
  notification_full_time: boolean | null;
  quiet_hours_enabled: boolean | null;
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
  timezone: string | null;
};

type JobRow = {
  body: string;
  match_id: string;
  notification_type: string;
  scheduled_for: string;
  title: string;
  url: string;
  user_id: string;
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
// Detection windows for the event-based notifications.
const JUST_LOCKED_MS = 10 * 60 * 1000;
const RECENT_FINISH_MS = 4 * 60 * 60 * 1000;

// Summary payload when several of the same type are due for one user at once.
function summaryPayload(type: string, count: number) {
  if (type === "match_lock") {
    return {
      body: `${count} matches are starting — picks are locked.`,
      title: "Picks locked",
      url: "/",
    };
  }
  if (type === "full_time") {
    return { body: `${count} matches just finished.`, title: "Full-time scores", url: "/" };
  }
  return {
    body: `You have ${count} matches locking soon with no saved pick.`,
    title: "Picks locking soon",
    url: "/picks",
  };
}

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

  const matchColumns =
    "id,home_team_id,away_team_id,prediction_lock_at,kickoff_at,status,home_score,away_score";
  const justLockedSince = new Date(now.getTime() - JUST_LOCKED_MS);
  const recentFinishSince = new Date(now.getTime() - RECENT_FINISH_MS);

  const [deadlineRes, lockedRes, finishedRes] = await Promise.all([
    // Upcoming locks (deadline reminders) — up to 48h out so quiet hours can defer.
    supabase
      .from("matches")
      .select(matchColumns)
      .gt("prediction_lock_at", now.toISOString())
      .lte("prediction_lock_at", windowEnd.toISOString())
      .eq("status", "scheduled")
      .returns<MatchRow[]>(),
    // Just locked (within the last 10 min) — picks-closed alert.
    supabase
      .from("matches")
      .select(matchColumns)
      .gt("prediction_lock_at", justLockedSince.toISOString())
      .lte("prediction_lock_at", now.toISOString())
      .in("status", ["scheduled", "live", "halftime"])
      .returns<MatchRow[]>(),
    // Recently finished — full-time score.
    supabase
      .from("matches")
      .select(matchColumns)
      .eq("status", "finished")
      .gt("kickoff_at", recentFinishSince.toISOString())
      .lte("kickoff_at", now.toISOString())
      .not("home_score", "is", null)
      .not("away_score", "is", null)
      .returns<MatchRow[]>(),
  ]);

  const deadlineMatches = deadlineRes.data ?? [];
  const lockedMatches = lockedRes.data ?? [];
  const finishedMatches = finishedRes.data ?? [];

  if (
    deadlineMatches.length === 0 &&
    lockedMatches.length === 0 &&
    finishedMatches.length === 0
  ) {
    return Response.json({ created: 0, sent: 0 });
  }

  const allMatches = [...deadlineMatches, ...lockedMatches, ...finishedMatches];
  const deadlineMatchIds = deadlineMatches.map((match) => match.id);

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
            "id,notification_deadlines,notification_match_locks,notification_full_time,quiet_hours_enabled,quiet_hours_start,quiet_hours_end,timezone",
          )
          .in("id", memberUserIds)
          .returns<ProfileRow[]>()
      : { data: [] };

  const usersWith = (key: keyof ProfileRow) =>
    new Set((profiles ?? []).filter((profile) => profile[key]).map((profile) => profile.id));
  const deadlineEnabledUserIds = usersWith("notification_deadlines");
  const lockUserIds = usersWith("notification_match_locks");
  const fullTimeUserIds = usersWith("notification_full_time");

  const quietByUser = new Map<string, QuietSettings>();
  for (const profile of profiles ?? []) {
    quietByUser.set(profile.id, {
      enabled: profile.quiet_hours_enabled ?? false,
      end: profile.quiet_hours_end ?? 23,
      start: profile.quiet_hours_start ?? 9,
      timeZone: profile.timezone,
    });
  }

  // Team short names for message text.
  const teamIds = [
    ...new Set(allMatches.flatMap((match) => [match.home_team_id, match.away_team_id])),
  ];
  const { data: teams } =
    teamIds.length > 0
      ? await supabase
          .from("teams")
          .select("id,short_name")
          .in("id", teamIds)
          .returns<TeamNameRow[]>()
      : { data: [] };
  const teamName = new Map((teams ?? []).map((team) => [team.id, team.short_name]));
  const nameOf = (id: string) => teamName.get(id) ?? "TBD";
  const matchupOf = (match: MatchRow) =>
    `${nameOf(match.home_team_id)} vs ${nameOf(match.away_team_id)}`;
  const scoreOf = (match: MatchRow) =>
    `${nameOf(match.home_team_id)} ${match.home_score}–${match.away_score} ${nameOf(match.away_team_id)}`;

  const { data: predictions } =
    deadlineMatchIds.length > 0
      ? await supabase
          .from("predictions")
          .select("pool_id,user_id,match_id")
          .in("match_id", deadlineMatchIds)
          .returns<PredictionRow[]>()
      : { data: [] };
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
  const nowIso = now.toISOString();
  const jobs: JobRow[] = [];

  // 1) Missing-pick deadline reminders (per pool membership, quiet-hours aware).
  for (const member of members ?? []) {
    if (!deadlineEnabledUserIds.has(member.user_id)) {
      continue;
    }
    for (const match of deadlineMatches) {
      if (existingPickKeys.has(`${member.pool_id}:${member.user_id}:${match.id}`)) {
        continue;
      }
      jobs.push({
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
      });
    }
  }

  // 2) Match-lock alerts (picks just closed). Event-based — delivered now.
  for (const userId of lockUserIds) {
    for (const match of lockedMatches) {
      jobs.push({
        body: `${matchupOf(match)} — picks are now locked.`,
        match_id: match.id,
        notification_type: "match_lock",
        scheduled_for: nowIso,
        title: "Picks locked",
        url: `/matches/${match.id}`,
        user_id: userId,
      });
    }
  }

  // 3) Full-time scores. Event-based — delivered now.
  for (const userId of fullTimeUserIds) {
    for (const match of finishedMatches) {
      jobs.push({
        body: scoreOf(match),
        match_id: match.id,
        notification_type: "full_time",
        scheduled_for: nowIso,
        title: "Full time",
        url: `/matches/${match.id}`,
        user_id: userId,
      });
    }
  }

  if (jobs.length > 0) {
    await supabase
      .from("notification_jobs")
      .upsert(jobs, { onConflict: "user_id,match_id,notification_type" });
  }

  const { data: dueJobs } = await supabase
    .from("notification_jobs")
    .select("id,user_id,match_id,notification_type,title,body,url")
    .is("sent_at", null)
    .lte("scheduled_for", now.toISOString());

  // Deadline reminders only: a pick may have been saved after the job was
  // scheduled (jobs can be created up to 48h ahead), so drop those.
  const deadlineDueMatchIds = [
    ...new Set(
      (dueJobs ?? [])
        .filter((job) => job.notification_type === "missing_pick_deadline")
        .map((job) => job.match_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: duePredictions } =
    deadlineDueMatchIds.length > 0
      ? await supabase
          .from("predictions")
          .select("user_id,match_id")
          .in("match_id", deadlineDueMatchIds)
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

  // Drop already-picked deadline jobs; group the rest by user + type so several
  // of the same kind due at once become one coalesced notification (but a pick
  // reminder and a full-time score stay separate).
  const staleJobIds: string[] = [];
  const groups = new Map<
    string,
    { jobs: NonNullable<typeof dueJobs>; type: string; userId: string }
  >();
  for (const job of dueJobs ?? []) {
    if (
      job.notification_type === "missing_pick_deadline" &&
      job.match_id &&
      pickedKeys.has(`${job.user_id}:${job.match_id}`)
    ) {
      staleJobIds.push(job.id);
      continue;
    }
    const key = `${job.user_id}|${job.notification_type}`;
    const group = groups.get(key) ?? {
      jobs: [],
      type: job.notification_type,
      userId: job.user_id,
    };
    group.jobs.push(job);
    groups.set(key, group);
  }

  if (staleJobIds.length > 0) {
    await supabase.from("notification_jobs").delete().in("id", staleJobIds);
  }

  let sent = 0;
  for (const group of groups.values()) {
    const jobIds = group.jobs.map((job) => job.id);
    const userSubscriptions = (subscriptions ?? []).filter(
      (subscription) => subscription.user_id === group.userId,
    );

    if (userSubscriptions.length === 0) {
      await supabase
        .from("notification_jobs")
        .update({ error: "No push subscription", sent_at: new Date().toISOString() })
        .in("id", jobIds);
      continue;
    }

    // One of a kind → its own message; several at once → a single summary.
    const payload =
      group.jobs.length === 1
        ? { body: group.jobs[0].body, title: group.jobs[0].title, url: group.jobs[0].url }
        : summaryPayload(group.type, group.jobs.length);
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
