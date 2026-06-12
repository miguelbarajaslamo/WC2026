import type { BootstrapData, StandingRow } from "@/lib/types";

const VALID_GROUPS = new Set(
  Array.from({ length: 12 }, (_, index) => `Group ${String.fromCharCode(65 + index)}`),
);

type Tally = StandingRow & {
  teamName: string;
};

export function normalizeWorldCupGroupName(value?: string | null) {
  const match = value?.match(/\bGroup\s+([A-L])\b/i);

  if (!match) {
    return null;
  }

  const groupName = `Group ${match[1].toUpperCase()}`;
  return VALID_GROUPS.has(groupName) ? groupName : null;
}

function emptyTally({
  groupRow,
  teamId,
  teamName,
}: {
  groupRow?: StandingRow;
  teamId: string;
  teamName: string;
}): Tally {
  return {
    drawn: 0,
    goalsAgainst: 0,
    goalsFor: 0,
    lost: 0,
    played: 0,
    points: 0,
    qualification: groupRow?.qualification ?? "possible",
    teamId,
    teamName,
    won: 0,
  };
}

function sortRows(rows: Tally[]): StandingRow[] {
  return rows
    .sort((left, right) => {
      const goalDiffLeft = left.goalsFor - left.goalsAgainst;
      const goalDiffRight = right.goalsFor - right.goalsAgainst;

      return (
        right.points - left.points ||
        goalDiffRight - goalDiffLeft ||
        right.goalsFor - left.goalsFor ||
        left.teamName.localeCompare(right.teamName)
      );
    })
    .map((row) => ({
      drawn: row.drawn,
      goalsAgainst: row.goalsAgainst,
      goalsFor: row.goalsFor,
      lost: row.lost,
      played: row.played,
      points: row.points,
      qualification: row.qualification,
      teamId: row.teamId,
      won: row.won,
    }));
}

function existingStandingLookup(data: BootstrapData) {
  const lookup = new Map<string, { groupName: string; row: StandingRow }>();

  Object.entries(data.standings).forEach(([groupName, rows]) => {
    const normalizedGroupName = normalizeWorldCupGroupName(groupName);

    if (!normalizedGroupName) {
      return;
    }

    rows.forEach((row) => {
      lookup.set(row.teamId, { groupName: normalizedGroupName, row });
    });
  });

  return lookup;
}

function groupByTeam(data: BootstrapData) {
  const existing = existingStandingLookup(data);
  const groups = new Map<string, string>();

  data.teams.forEach((team) => {
    const groupName =
      normalizeWorldCupGroupName(team.groupName) ?? existing.get(team.id)?.groupName;

    if (groupName) {
      groups.set(team.id, groupName);
    }
  });

  data.matches.forEach((match) => {
    const groupName = normalizeWorldCupGroupName(match.groupName);

    if (!groupName) {
      return;
    }

    if (!groups.has(match.homeTeamId)) {
      groups.set(match.homeTeamId, groupName);
    }

    if (!groups.has(match.awayTeamId)) {
      groups.set(match.awayTeamId, groupName);
    }
  });

  return groups;
}

export function buildLiveStandings(data: BootstrapData) {
  const existing = existingStandingLookup(data);
  const groups = groupByTeam(data);
  const tallies = new Map<string, Tally>();

  data.teams.forEach((team) => {
    const groupName = groups.get(team.id);

    if (!groupName) {
      return;
    }

    tallies.set(
      team.id,
      emptyTally({
        groupRow: existing.get(team.id)?.row,
        teamId: team.id,
        teamName: team.name,
      }),
    );
  });

  data.matches.forEach((match) => {
    const groupName =
      normalizeWorldCupGroupName(match.groupName) ??
      groups.get(match.homeTeamId) ??
      groups.get(match.awayTeamId);

    if (!groupName) {
      return;
    }

    groups.set(match.homeTeamId, groupName);
    groups.set(match.awayTeamId, groupName);

    const homeTeam = data.teams.find((team) => team.id === match.homeTeamId);
    const awayTeam = data.teams.find((team) => team.id === match.awayTeamId);

    if (!homeTeam || !awayTeam) {
      return;
    }

    if (!tallies.has(match.homeTeamId)) {
      tallies.set(
        match.homeTeamId,
        emptyTally({
          groupRow: existing.get(match.homeTeamId)?.row,
          teamId: match.homeTeamId,
          teamName: homeTeam.name,
        }),
      );
    }

    if (!tallies.has(match.awayTeamId)) {
      tallies.set(
        match.awayTeamId,
        emptyTally({
          groupRow: existing.get(match.awayTeamId)?.row,
          teamId: match.awayTeamId,
          teamName: awayTeam.name,
        }),
      );
    }

    if (
      !["finished", "halftime", "live"].includes(match.status) ||
      match.homeScore === undefined ||
      match.awayScore === undefined
    ) {
      return;
    }

    const home = tallies.get(match.homeTeamId);
    const away = tallies.get(match.awayTeamId);

    if (!home || !away) {
      return;
    }

    home.played += 1;
    away.played += 1;
    home.goalsFor += match.homeScore;
    home.goalsAgainst += match.awayScore;
    away.goalsFor += match.awayScore;
    away.goalsAgainst += match.homeScore;

    if (match.homeScore > match.awayScore) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
    } else if (match.homeScore < match.awayScore) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }
  });

  return [...tallies.entries()].reduce<Record<string, StandingRow[]>>(
    (standings, [teamId, tally]) => {
      const groupName = groups.get(teamId);

      if (!groupName) {
        return standings;
      }

      standings[groupName] = standings[groupName] ?? [];
      standings[groupName].push(tally);
      return standings;
    },
    {},
  );
}

export function sortedLiveStandings(data: BootstrapData) {
  const standings = buildLiveStandings(data);

  return Object.fromEntries(
    Object.entries(standings).map(([groupName, rows]) => [
      groupName,
      sortRows(rows as Tally[]),
    ]),
  );
}
