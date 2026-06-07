import { isAfter, parseISO } from "date-fns";
import type {
  BootstrapData,
  Match,
  MatchEvent,
  Prediction,
  Profile,
  Team,
} from "@/lib/types";

export function getTeam(data: BootstrapData, id: string): Team {
  const team = data.teams.find((item) => item.id === id);

  if (!team) {
    throw new Error(`Unknown team: ${id}`);
  }

  return team;
}

export function getProfile(data: BootstrapData, id: string): Profile {
  const profile = data.profiles.find((item) => item.id === id);

  if (!profile) {
    throw new Error(`Unknown profile: ${id}`);
  }

  return profile;
}

export function getMatch(data: BootstrapData, id: string): Match | undefined {
  return data.matches.find((match) => match.id === id);
}

export function getMatchEvents(data: BootstrapData, matchId: string): MatchEvent[] {
  return data.events
    .filter((event) => event.matchId === matchId)
    .sort((left, right) => left.minute - right.minute);
}

export function getUserPrediction(
  data: BootstrapData,
  matchId: string,
  userId = data.currentUserId,
): Prediction | undefined {
  return data.predictions.find(
    (prediction) => prediction.matchId === matchId && prediction.userId === userId,
  );
}

export function getMatchPredictions(data: BootstrapData, matchId: string) {
  return data.predictions.filter((prediction) => prediction.matchId === matchId);
}

export function isMatchLocked(match: Match) {
  return !isAfter(parseISO(match.predictionLockAt), new Date());
}

export function getVisibleMatches(data: BootstrapData) {
  return [...data.matches].sort(
    (left, right) =>
      parseISO(left.kickoffAt).getTime() - parseISO(right.kickoffAt).getTime(),
  );
}

export function getMissingUnlockedMatches(data: BootstrapData) {
  return getVisibleMatches(data).filter((match) => {
    const userPrediction = getUserPrediction(data, match.id);
    return !userPrediction && !isMatchLocked(match);
  });
}
