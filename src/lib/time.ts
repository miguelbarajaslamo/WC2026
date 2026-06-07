import {
  differenceInSeconds,
  format,
  formatDistanceToNowStrict,
  parseISO,
} from "date-fns";
import type { BootstrapData, Match } from "@/lib/types";

export function getLocalTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function formatLocalTime(value: string) {
  return format(parseISO(value), "HH:mm");
}

export function formatLocalDateTime(value: string) {
  return format(parseISO(value), "EEE d MMM · HH:mm");
}

export function formatMatchDateTime(value: string) {
  return formatLocalDateTime(value);
}

export function formatMatchTiming({
  kickoffAt,
  lockAt,
}: {
  kickoffAt: string;
  lockAt?: string;
}) {
  const kickoff = formatMatchDateTime(kickoffAt);

  if (!lockAt) {
    return kickoff;
  }

  return `${kickoff} · Locks ${formatLocalTime(lockAt)}`;
}

export function formatShortCountdown(value: string, now = new Date()) {
  const target = parseISO(value);
  const seconds = differenceInSeconds(target, now);

  if (seconds <= 0) {
    return "now";
  }

  return formatDistanceToNowStrict(target, { addSuffix: false });
}

export function getNextLockMatch(data: BootstrapData, now = new Date()) {
  return data.matches
    .filter((match) => parseISO(match.predictionLockAt) > now)
    .sort(
      (left, right) =>
        parseISO(left.predictionLockAt).getTime() -
        parseISO(right.predictionLockAt).getTime(),
    )[0];
}

export function getKickoffCountdown(match: Match) {
  if (match.status !== "scheduled") {
    return "";
  }

  return formatShortCountdown(match.kickoffAt);
}
