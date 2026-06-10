// Quiet-hours check for event pushes sent from API routes (Node side).
// Mirrors the semantics of the edge function: notifications are allowed
// between quiet_hours_start and quiet_hours_end (local hours, [start, end)),
// and quiet outside that window.

export type QuietHoursSettings = {
  enabled: boolean;
  start: number;
  end: number;
  timeZone: string | null;
};

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

function wallTimeToUtc(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  timeZone: string,
): Date {
  const asUtc = Date.UTC(year, monthIndex, day, hour, 0);
  const offset1 = tzOffsetMs(timeZone, new Date(asUtc));
  let utc = asUtc - offset1;
  const offset2 = tzOffsetMs(timeZone, new Date(utc));
  if (offset2 !== offset1) {
    utc = asUtc - offset2;
  }
  return new Date(utc);
}

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

// null → deliver now; a Date → defer until then (next window open).
export function nextAllowedTime(
  settings: QuietHoursSettings,
  now: Date,
): Date | null {
  if (!settings.enabled || !settings.timeZone || settings.start >= settings.end) {
    return null;
  }

  const local = localParts(settings.timeZone, now);
  if (local.hour >= settings.start && local.hour < settings.end) {
    return null;
  }

  // Before today's window → today at start; after it → tomorrow at start.
  if (local.hour < settings.start) {
    return wallTimeToUtc(
      local.year,
      local.monthIndex,
      local.day,
      settings.start,
      settings.timeZone,
    );
  }

  const tomorrowLocal = localParts(
    settings.timeZone,
    new Date(now.getTime() + 24 * 60 * 60 * 1000),
  );
  return wallTimeToUtc(
    tomorrowLocal.year,
    tomorrowLocal.monthIndex,
    tomorrowLocal.day,
    settings.start,
    settings.timeZone,
  );
}
