import type {
  CategoryLeaderboards,
  CountryCardCategoryRow,
  Match,
  MatchEvent,
  PlayerCategoryRow,
  Team,
  UserStreakCategoryRow,
} from "@/lib/types";

export type PlayerStatSource = {
  assists: number;
  cleanSheets?: number;
  goals: number;
  matchId?: string;
  minutes?: number;
  playerId?: string;
  playerName: string;
  position?: string;
  rating?: number;
  redCards: number;
  saves?: number;
  teamId: string;
  updatedAt?: string;
  yellowCards: number;
};

function newerDate(left?: string, right?: string) {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  return new Date(left).getTime() > new Date(right).getTime() ? left : right;
}

function rankByValue<T extends { value: number }>(rows: T[], limit = 10) {
  let previousValue: number | undefined;
  let previousRank = 0;

  function tieLabel(row: T) {
    if ("playerName" in row && typeof row.playerName === "string") {
      return row.playerName;
    }

    if ("teamName" in row && typeof row.teamName === "string") {
      return row.teamName;
    }

    return JSON.stringify(row);
  }

  return rows
    .sort((left, right) => {
      if (right.value !== left.value) {
        return right.value - left.value;
      }

      return tieLabel(left).localeCompare(tieLabel(right));
    })
    .slice(0, limit)
    .map((row, index) => {
      const rank =
        previousValue !== undefined && row.value === previousValue
          ? previousRank
          : index + 1;

      previousValue = row.value;
      previousRank = rank;

      return { ...row, rank };
    });
}

function teamMap(teams: Team[]) {
  return new Map(teams.map((team) => [team.id, team]));
}

function matchFreshnessMap(matches: Match[]) {
  return new Map(
    matches.map((match) => [
      match.id,
      match.lastSyncedAt ?? match.kickoffAt,
    ]),
  );
}

function aggregatePlayerRows({
  eventKey,
  events,
  matches,
  statKey,
  stats,
  teams,
}: {
  eventKey: "assistName" | "playerName";
  events: MatchEvent[];
  matches: Match[];
  statKey: "assists" | "goals";
  stats: PlayerStatSource[];
  teams: Team[];
}): PlayerCategoryRow[] {
  const teamsById = teamMap(teams);
  const freshnessByMatch = matchFreshnessMap(matches);
  const statMatchIds = new Set(stats.map((stat) => stat.matchId).filter(Boolean));
  const grouped = new Map<string, PlayerCategoryRow>();

  function addValue({
    playerId,
    playerName,
    teamId,
    updatedAt,
    value,
  }: {
    playerId?: string;
    playerName: string;
    teamId: string;
    updatedAt?: string;
    value: number;
  }) {
    if (value <= 0) {
      return;
    }

    const key = `${teamId}:${playerName}`;
    const team = teamsById.get(teamId);
    const current = grouped.get(key);

    if (!current) {
      grouped.set(key, {
        iso2: team?.iso2,
        playerId,
        playerName,
        rank: 0,
        teamId,
        teamName: team?.name,
        teamShortName: team?.shortName,
        updatedAt,
        value,
      });
      return;
    }

    current.value += value;
    // Stats carry the stable player id; events don't — keep the first we see.
    if (!current.playerId && playerId) {
      current.playerId = playerId;
    }
    current.updatedAt = newerDate(current.updatedAt, updatedAt);
  }

  stats.forEach((stat) => {
    addValue({
      playerId: stat.playerId,
      playerName: stat.playerName,
      teamId: stat.teamId,
      updatedAt: stat.updatedAt,
      value: stat[statKey],
    });
  });

  events
    .filter(
      (event) =>
        event.type === "goal" &&
        (!event.matchId || !statMatchIds.has(event.matchId)),
    )
    .forEach((event) => {
      const playerName = event[eventKey];

      if (!playerName) {
        return;
      }

      addValue({
        playerName,
        teamId: event.teamId,
        updatedAt: freshnessByMatch.get(event.matchId),
        value: 1,
      });
    });

  return rankByValue([...grouped.values()]);
}

export function aggregateCountryCardPoints({
  events,
  matches,
  stats,
  teams,
}: {
  events: MatchEvent[];
  matches: Match[];
  stats: PlayerStatSource[];
  teams: Team[];
}): CountryCardCategoryRow[] {
  const teamsById = teamMap(teams);
  const freshnessByMatch = matchFreshnessMap(matches);
  const statMatchIds = new Set(stats.map((stat) => stat.matchId).filter(Boolean));
  const grouped = new Map<string, CountryCardCategoryRow & { value: number }>();

  function ensureRow(teamId: string, updatedAt?: string) {
    const team = teamsById.get(teamId);
    const current = grouped.get(teamId);

    if (current) {
      current.updatedAt = newerDate(current.updatedAt, updatedAt);
      return current;
    }

    const row = {
      iso2: team?.iso2,
      points: 0,
      rank: 0,
      redCards: 0,
      teamId,
      teamName: team?.name ?? "Unknown",
      teamShortName: team?.shortName ?? teamId,
      updatedAt,
      value: 0,
      yellowCards: 0,
    };
    grouped.set(teamId, row);
    return row;
  }

  stats.forEach((stat) => {
    const row = ensureRow(stat.teamId, stat.updatedAt);
    row.yellowCards += stat.yellowCards;
    row.redCards += stat.redCards;
    row.points += stat.yellowCards + stat.redCards * 2;
    row.value = row.points;
  });

  events
    .filter(
      (event) =>
        (event.type === "yellow_card" || event.type === "red_card") &&
        (!event.matchId || !statMatchIds.has(event.matchId)),
    )
    .forEach((event) => {
      const row = ensureRow(event.teamId, freshnessByMatch.get(event.matchId));

      if (event.type === "yellow_card") {
        row.yellowCards += 1;
        row.points += 1;
      } else {
        row.redCards += 1;
        row.points += 2;
      }

      row.value = row.points;
    });

  return rankByValue([...grouped.values()].filter((row) => row.points > 0)).map(
    (row) => ({
      iso2: row.iso2,
      points: row.points,
      rank: row.rank,
      redCards: row.redCards,
      teamId: row.teamId,
      teamName: row.teamName,
      teamShortName: row.teamShortName,
      updatedAt: row.updatedAt,
      yellowCards: row.yellowCards,
    }),
  );
}

export function aggregateCategoryLeaderboards({
  events,
  matches,
  playerStats = [],
  teams,
  userStreaks = [],
}: {
  events: MatchEvent[];
  matches: Match[];
  playerStats?: PlayerStatSource[];
  teams: Team[];
  userStreaks?: UserStreakCategoryRow[];
}): CategoryLeaderboards {
  return {
    countryCardPoints: aggregateCountryCardPoints({
      events,
      matches,
      stats: playerStats,
      teams,
    }),
    topAssists: aggregatePlayerRows({
      eventKey: "assistName",
      events,
      matches,
      statKey: "assists",
      stats: playerStats,
      teams,
    }),
    topScorers: aggregatePlayerRows({
      eventKey: "playerName",
      events,
      matches,
      statKey: "goals",
      stats: playerStats,
      teams,
    }),
    userStreaks,
  };
}

export function winningCountryCardOptionIds(rows: CountryCardCategoryRow[]) {
  const topPoints = rows[0]?.points ?? 0;

  if (topPoints === 0) {
    return [];
  }

  return rows
    .filter((row) => row.points === topPoints)
    .map((row) => `bonus-cards-${row.teamId}`);
}
