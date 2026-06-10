import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function validHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function isValidTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export async function PATCH(request: Request) {
  const {
    avatarColor,
    displayName,
    notificationDeadlines,
    notificationMatchLocks,
    notificationFullTime,
    quietHoursEnabled,
    quietHoursStart,
    quietHoursEnd,
    timezone,
  } = (await request.json()) as {
    avatarColor?: string;
    displayName?: string;
    notificationDeadlines?: boolean;
    notificationMatchLocks?: boolean;
    notificationFullTime?: boolean;
    quietHoursEnabled?: boolean;
    quietHoursStart?: number;
    quietHoursEnd?: number;
    timezone?: string;
  };
  const name = displayName?.trim();
  const color = avatarColor?.trim();

  if (name !== undefined && (name.length < 2 || name.length > 40)) {
    return NextResponse.json(
      { error: "Display name must be 2-40 characters." },
      { status: 400 },
    );
  }

  if (color !== undefined && !validHexColor(color)) {
    return NextResponse.json(
      { error: "Avatar color must be a hex color." },
      { status: 400 },
    );
  }

  if (
    quietHoursStart !== undefined ||
    quietHoursEnd !== undefined
  ) {
    const start = quietHoursStart ?? 9;
    const end = quietHoursEnd ?? 23;
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      start > 23 ||
      end < 1 ||
      end > 24 ||
      start >= end
    ) {
      return NextResponse.json(
        { error: "Quiet hours must be a valid range (start before end)." },
        { status: 400 },
      );
    }
  }

  if (timezone !== undefined && !isValidTimezone(timezone)) {
    return NextResponse.json({ error: "Invalid timezone." }, { status: 400 });
  }

  const update: {
    avatar_color?: string;
    display_name?: string;
    notification_deadlines?: boolean;
    notification_match_locks?: boolean;
    notification_full_time?: boolean;
    quiet_hours_enabled?: boolean;
    quiet_hours_start?: number;
    quiet_hours_end?: number;
    timezone?: string;
    updated_at: string;
  } = {
    updated_at: new Date().toISOString(),
  };

  if (name !== undefined) {
    update.display_name = name;
  }

  if (color !== undefined) {
    update.avatar_color = color;
  }

  if (notificationDeadlines !== undefined) {
    update.notification_deadlines = notificationDeadlines;
  }

  if (notificationMatchLocks !== undefined) {
    update.notification_match_locks = notificationMatchLocks;
  }

  if (notificationFullTime !== undefined) {
    update.notification_full_time = notificationFullTime;
  }

  if (quietHoursEnabled !== undefined) {
    update.quiet_hours_enabled = quietHoursEnabled;
  }

  if (quietHoursStart !== undefined) {
    update.quiet_hours_start = quietHoursStart;
  }

  if (quietHoursEnd !== undefined) {
    update.quiet_hours_end = quietHoursEnd;
  }

  if (timezone !== undefined) {
    update.timezone = timezone;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
