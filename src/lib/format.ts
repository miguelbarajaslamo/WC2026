import {
  differenceInMinutes,
  format,
  formatDistanceToNowStrict,
  parseISO,
} from "date-fns";
import type { Match, MatchEvent, Prediction, Team } from "@/lib/types";

export function formatKickoff(value: string) {
  return format(parseISO(value), "HH:mm");
}

export function formatMatchDate(value: string) {
  return format(parseISO(value), "EEE d MMM");
}

export function formatLockTime(value: string) {
  const lockDate = parseISO(value);
  const minutes = differenceInMinutes(lockDate, new Date());

  if (minutes <= 0) {
    return "Locked";
  }

  return `Locks in ${formatDistanceToNowStrict(lockDate)}`;
}

export function formatMinute(match: Match) {
  if (match.status === "halftime") {
    return "HT";
  }

  if (match.status === "finished") {
    return "FT";
  }

  if (match.status === "live" && match.elapsedMinutes) {
    return `${match.elapsedMinutes}'`;
  }

  return formatKickoff(match.kickoffAt);
}

export function predictionLabel(prediction?: Prediction) {
  if (!prediction) {
    return "Missing";
  }

  return `${prediction.homeScore}-${prediction.awayScore}`;
}

export function scorersSummary(events: MatchEvent[], teams: Team[]) {
  const goals = events.filter((event) => event.type === "goal");

  if (goals.length === 0) {
    return "No goals yet";
  }

  return goals
    .slice(0, 3)
    .map((goal) => {
      const team = teams.find((item) => item.id === goal.teamId);
      return `${goal.minute}' ${goal.playerName}${team ? ` (${team.shortName})` : ""}`;
    })
    .join("  ");
}

export function scoreText(match: Match) {
  if (match.homeScore === undefined || match.awayScore === undefined) {
    return "vs";
  }

  return `${match.homeScore}-${match.awayScore}`;
}
