import { isAfter, parseISO } from "date-fns";
import type {
  BootstrapData,
  Match,
  MatchEvent,
  Prediction,
  Profile,
  Team,
} from "@/lib/types";

// Per-payload indexes. Keyed by the array instance from the bootstrap payload,
// so they invalidate naturally when a refetch replaces the data and get
// garbage-collected with it. Views call these selectors per row, so without
// the indexes every match row pays a linear scan over all predictions/teams.

const teamIndexCache = new WeakMap<Team[], Map<string, Team>>();
const profileIndexCache = new WeakMap<Profile[], Map<string, Profile>>();
const predictionIndexCache = new WeakMap<Prediction[], Map<string, Prediction>>();
const matchPredictionsCache = new WeakMap<Prediction[], Map<string, Prediction[]>>();
const eventsByMatchCache = new WeakMap<MatchEvent[], Map<string, MatchEvent[]>>();
const sortedMatchesCache = new WeakMap<Match[], Match[]>();

function teamIndex(teams: Team[]) {
  let index = teamIndexCache.get(teams);
  if (!index) {
    index = new Map(teams.map((team) => [team.id, team]));
    teamIndexCache.set(teams, index);
  }
  return index;
}

function profileIndex(profiles: Profile[]) {
  let index = profileIndexCache.get(profiles);
  if (!index) {
    index = new Map(profiles.map((profile) => [profile.id, profile]));
    profileIndexCache.set(profiles, index);
  }
  return index;
}

export function getTeam(data: BootstrapData, id: string): Team {
  const team = teamIndex(data.teams).get(id);

  if (!team) {
    throw new Error(`Unknown team: ${id}`);
  }

  return team;
}

export function getProfile(data: BootstrapData, id: string): Profile {
  const profile = profileIndex(data.profiles).get(id);

  if (!profile) {
    throw new Error(`Unknown profile: ${id}`);
  }

  return profile;
}

export function getMatch(data: BootstrapData, id: string): Match | undefined {
  return data.matches.find((match) => match.id === id);
}

export function getMatchEvents(data: BootstrapData, matchId: string): MatchEvent[] {
  let byMatch = eventsByMatchCache.get(data.events);
  if (!byMatch) {
    byMatch = new Map();
    for (const event of data.events) {
      const list = byMatch.get(event.matchId);
      if (list) {
        list.push(event);
      } else {
        byMatch.set(event.matchId, [event]);
      }
    }
    for (const list of byMatch.values()) {
      list.sort((left, right) => left.minute - right.minute);
    }
    eventsByMatchCache.set(data.events, byMatch);
  }
  return byMatch.get(matchId) ?? [];
}

function predictionIndex(predictions: Prediction[]) {
  let index = predictionIndexCache.get(predictions);
  if (!index) {
    index = new Map(
      predictions.map((prediction) => [
        `${prediction.matchId}:${prediction.userId}`,
        prediction,
      ]),
    );
    predictionIndexCache.set(predictions, index);
  }
  return index;
}

export function getUserPrediction(
  data: BootstrapData,
  matchId: string,
  userId = data.currentUserId,
): Prediction | undefined {
  return predictionIndex(data.predictions).get(`${matchId}:${userId}`);
}

export function getMatchPredictions(data: BootstrapData, matchId: string) {
  let byMatch = matchPredictionsCache.get(data.predictions);
  if (!byMatch) {
    byMatch = new Map();
    for (const prediction of data.predictions) {
      const list = byMatch.get(prediction.matchId);
      if (list) {
        list.push(prediction);
      } else {
        byMatch.set(prediction.matchId, [prediction]);
      }
    }
    matchPredictionsCache.set(data.predictions, byMatch);
  }
  return byMatch.get(matchId) ?? [];
}

export function isMatchLocked(match: Match) {
  return !isAfter(parseISO(match.predictionLockAt), new Date());
}

export function getVisibleMatches(data: BootstrapData) {
  let sorted = sortedMatchesCache.get(data.matches);
  if (!sorted) {
    const kickoffTimes = new Map(
      data.matches.map((match) => [match.id, parseISO(match.kickoffAt).getTime()]),
    );
    sorted = [...data.matches].sort(
      (left, right) =>
        (kickoffTimes.get(left.id) ?? 0) - (kickoffTimes.get(right.id) ?? 0),
    );
    sortedMatchesCache.set(data.matches, sorted);
  }
  return sorted;
}

export function getMissingUnlockedMatches(data: BootstrapData) {
  return getVisibleMatches(data).filter((match) => {
    const userPrediction = getUserPrediction(data, match.id);
    return !userPrediction && !isMatchLocked(match);
  });
}

// Unpicked, unlocked matches kicking off within the next `days` days — used for
// the "missing picks soon" warning so it only flags imminent matches.
export function getMissingPicksWithinDays(data: BootstrapData, days: number) {
  const cutoff = Date.now() + days * 24 * 60 * 60 * 1000;
  return getMissingUnlockedMatches(data).filter(
    (match) => parseISO(match.kickoffAt).getTime() <= cutoff,
  );
}
