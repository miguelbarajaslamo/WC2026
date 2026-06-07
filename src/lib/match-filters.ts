import { parseISO } from "date-fns";
import {
  getUserPrediction,
  getVisibleMatches,
  isMatchLocked,
} from "@/lib/data/selectors";
import type { BootstrapData, Match } from "@/lib/types";

export type PicksFilter = "all" | "locked" | "missing" | "open";
export type FixturesFilter = "all" | "finished" | "missing" | "upcoming";

export function isMissingPick(data: BootstrapData, match: Match) {
  return !isMatchLocked(match) && !getUserPrediction(data, match.id);
}

export function isOpenPick(match: Match) {
  return !isMatchLocked(match);
}

export function filterPicksMatches(data: BootstrapData, filter: PicksFilter) {
  const matches = getVisibleMatches(data);

  if (filter === "missing") {
    return matches.filter((match) => isMissingPick(data, match));
  }

  if (filter === "open") {
    return matches.filter((match) => isOpenPick(match));
  }

  if (filter === "locked") {
    return matches.filter((match) => isMatchLocked(match));
  }

  return matches;
}

export function filterFixturesMatches({
  data,
  filter,
  query,
}: {
  data: BootstrapData;
  filter: FixturesFilter;
  query?: string;
}) {
  const normalizedQuery = (query ?? "").trim().toLowerCase();
  const now = new Date();

  return getVisibleMatches(data).filter((match) => {
    const home = data.teams.find((team) => team.id === match.homeTeamId);
    const away = data.teams.find((team) => team.id === match.awayTeamId);
    const label = [
      home?.name,
      away?.name,
      home?.shortName,
      away?.shortName,
      match.groupName,
      match.stage,
      match.city,
      match.venue,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (normalizedQuery && !label.includes(normalizedQuery)) {
      return false;
    }

    if (filter === "missing") {
      return isMissingPick(data, match);
    }

    if (filter === "upcoming") {
      return match.status === "scheduled" && parseISO(match.kickoffAt) > now;
    }

    if (filter === "finished") {
      return match.status === "finished";
    }

    return true;
  });
}
