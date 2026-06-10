import { parseISO } from "date-fns";
import {
  getUserPrediction,
  getVisibleMatches,
  isMatchLocked,
} from "@/lib/data/selectors";
import type { BootstrapData, Match } from "@/lib/types";

export type PicksFilter = "all" | "locked" | "missing" | "open";
export type FixturesFilter = "finished" | "missing" | "upcoming";

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

function matchesFixturesFilter(
  data: BootstrapData,
  match: Match,
  filter: FixturesFilter,
  now: Date,
) {
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
}

export function filterFixturesMatches({
  data,
  filters,
  query,
}: {
  data: BootstrapData;
  // Empty = no filter (show all). Multiple = union (matches any).
  filters: FixturesFilter[];
  query?: string;
}) {
  const normalizedQuery = (query ?? "").trim().toLowerCase();
  const now = new Date();
  const teamById = new Map(data.teams.map((team) => [team.id, team]));

  return getVisibleMatches(data).filter((match) => {
    const home = teamById.get(match.homeTeamId);
    const away = teamById.get(match.awayTeamId);
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

    if (filters.length === 0) {
      return true;
    }

    return filters.some((filter) => matchesFixturesFilter(data, match, filter, now));
  });
}
