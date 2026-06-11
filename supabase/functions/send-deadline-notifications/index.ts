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

type MatchFollowRow = {
  match_id: string;
  user_id: string;
};

type MatchEventRow = {
  id: string;
  match_id: string;
  elapsed_minutes: number | null;
  team_id: string | null;
  player_name: string | null;
  event_type: string;
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
const LOCK_SOON_MS = 15 * 60 * 1000;
const RECENT_FINISH_MS = 4 * 60 * 60 * 1000;

// Summary payload when several of the same type are due for one user at once.
function summaryPayload(type: string, count: number) {
  if (type === "match_lock") {
    return {
      body: `${count} matches lock soon — last chance to change.`,
      title: "Picks lock soon",
      url: "/picks",
    };
  }
  if (type === "full_time") {
    return { body: `${count} matches just finished.`, title: "Full-time scores", url: "/" };
  }
  if (type === "chat_mention") {
    return {
      body: `You were mentioned ${count} times in the pool chat.`,
      title: "New mentions",
      url: "/chat",
    };
  }
  if (type === "follow_kickoff") {
    return { body: `${count} followed matches kicked off.`, title: "Kickoff", url: "/" };
  }
  if (type === "follow_halftime") {
    return { body: `Half-time in ${count} followed matches.`, title: "Half-time", url: "/" };
  }
  if (type === "follow_fulltime") {
    return { body: `${count} followed matches finished.`, title: "Full-time", url: "/" };
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
  const lockSoonUntil = new Date(now.getTime() + LOCK_SOON_MS);
  const recentFinishSince = new Date(now.getTime() - RECENT_FINISH_MS);

  const [deadlineRes, lockedRes, finishedRes, followsRes] = await Promise.all([
    // Upcoming locks (deadline reminders) — up to 48h out so quiet hours can defer.
    supabase
      .from("matches")
      .select(matchColumns)
      .gt("prediction_lock_at", now.toISOString())
      .lte("prediction_lock_at", windowEnd.toISOString())
      .eq("status", "scheduled")
      .returns<MatchRow[]>(),
    // Locking soon (within the next 15 min) — last-chance reminder.
    supabase
      .from("matches")
      .select(matchColumns)
      .gt("prediction_lock_at", now.toISOString())
      .lte("prediction_lock_at", lockSoonUntil.toISOString())
      .eq("status", "scheduled")
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
    // Match follows (kickoff/goals/cards/half-time/full-time subscribers).
    supabase.from("match_follows").select("user_id,match_id").returns<MatchFollowRow[]>(),
  ]);

  const deadlineMatches = deadlineRes.data ?? [];
  const lockingSoonMatches = lockedRes.data ?? [];
  const finishedMatches = finishedRes.data ?? [];
  const follows = followsRes.data ?? [];

  // Followed matches that are in play (or just finished) drive live alerts.
  const followedMatchIds = [...new Set(follows.map((follow) => follow.match_id))];
  let followedActiveMatches: MatchRow[] = [];
  let freshFollowEvents: MatchEventRow[] = [];
  if (followedMatchIds.length > 0) {
    const { data: activeMatches } = await supabase
      .from("matches")
      .select(matchColumns)
      .in("id", followedMatchIds)
      .or(
        `status.in.(live,halftime),and(status.eq.finished,kickoff_at.gte.${recentFinishSince.toISOString()})`,
      )
      .returns<MatchRow[]>();
    followedActiveMatches = activeMatches ?? [];

    // Only events synced in the last 15 min: late followers (and the feature's
    // own rollout) shouldn't trigger a backlog of pushes.
    const activeIds = followedActiveMatches.map((match) => match.id);
    if (activeIds.length > 0) {
      const eventsSince = new Date(now.getTime() - 15 * 60 * 1000);
      const { data: events } = await supabase
        .from("match_events")
        .select("id,match_id,elapsed_minutes,team_id,player_name,event_type")
        .in("match_id", activeIds)
        .gte("created_at", eventsSince.toISOString())
        .returns<MatchEventRow[]>();
      freshFollowEvents = events ?? [];
    }
  }

  if (
    deadlineMatches.length === 0 &&
    lockingSoonMatches.length === 0 &&
    finishedMatches.length === 0 &&
    followedActiveMatches.length === 0
  ) {
    return Response.json({ created: 0, sent: 0 });
  }

  const allMatches = [
    ...deadlineMatches,
    ...lockingSoonMatches,
    ...finishedMatches,
    ...followedActiveMatches,
  ];
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
    `${nameOf(match.home_team_id)} ${match.home_score ?? 0}–${match.away_score ?? 0} ${nameOf(match.away_team_id)}`;

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

  // 2) Locking-soon reminders (~15 min before picks close). Delivered now.
  for (const userId of lockUserIds) {
    for (const match of lockingSoonMatches) {
      jobs.push({
        body: `${matchupOf(match)} locks soon — last chance to change your pick.`,
        match_id: match.id,
        notification_type: "match_lock",
        scheduled_for: nowIso,
        title: "Picks lock soon",
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

  // 4) Followed matches: kickoff, half-time, full-time, goals, cards.
  // Explicit opt-in per match, so quiet hours don't apply. The unique
  // (user, match, type) constraint dedups across cron runs.
  const followedActiveById = new Map(
    followedActiveMatches.map((match) => [match.id, match]),
  );
  const eventsByMatch = new Map<string, MatchEventRow[]>();
  for (const event of freshFollowEvents) {
    const list = eventsByMatch.get(event.match_id) ?? [];
    list.push(event);
    eventsByMatch.set(event.match_id, list);
  }
  const justKickedOffSince = now.getTime() - 10 * 60 * 1000;

  for (const follow of follows) {
    const match = followedActiveById.get(follow.match_id);
    if (!match) {
      continue;
    }
    const matchup = matchupOf(match);
    const url = `/matches/${match.id}`;
    const base = {
      match_id: match.id,
      scheduled_for: nowIso,
      url,
      user_id: follow.user_id,
    };

    if (
      match.status === "live" &&
      new Date(match.kickoff_at).getTime() >= justKickedOffSince
    ) {
      jobs.push({
        ...base,
        body: `${matchup} has kicked off.`,
        notification_type: "follow_kickoff",
        title: "Kickoff",
      });
    }

    if (match.status === "halftime") {
      jobs.push({
        ...base,
        body: `Half-time: ${scoreOf(match)}.`,
        notification_type: "follow_halftime",
        title: "Half-time",
      });
    }

    // Skip when the full-time preference already covers this user.
    if (match.status === "finished" && !fullTimeUserIds.has(follow.user_id)) {
      jobs.push({
        ...base,
        body: `Full-time: ${scoreOf(match)}.`,
        notification_type: "follow_fulltime",
        title: "Full-time",
      });
    }

    for (const event of eventsByMatch.get(match.id) ?? []) {
      const player = event.player_name?.trim();
      if (!player) {
        continue;
      }
      const minute = event.elapsed_minutes ? `${event.elapsed_minutes}' ` : "";
      const team = event.team_id ? ` (${nameOf(event.team_id)})` : "";
      let body: string | null = null;
      if (event.event_type === "goal") {
        body = `⚽ ${minute}${player}${team} — ${scoreOf(match)}`;
      } else if (event.event_type === "yellow_card") {
        body = `🟨 ${minute}${player}${team}`;
      } else if (event.event_type === "red_card") {
        body = `🟥 ${minute}${player}${team}`;
      }
      if (!body) {
        continue;
      }
      jobs.push({
        ...base,
        body,
        notification_type: `follow_event:${event.id}`,
        title: matchup,
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
