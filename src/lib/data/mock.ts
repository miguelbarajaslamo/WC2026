import { addHours, addMinutes, formatISO, startOfDay } from "date-fns";
import type {
  BootstrapData,
  BonusPick,
  BonusPickOption,
  BonusScoreSnapshot,
  LeaderboardRow,
  Match,
  MatchEvent,
  MatchPlayerStat,
  Pool,
  Prediction,
  Player,
  Profile,
  StandingRow,
  Team,
  TeamSquadMember,
  TournamentPlayerStatSnapshot,
} from "@/lib/types";
import { aggregateCategoryLeaderboards } from "@/lib/stats/category-leaderboards";

const pool: Pool = {
  id: "pool-barajas",
  name: "WORLD CUP PICKS",
  prizeNote: "Winner takes bragging rights and the agreed prize pot.",
  scoringMode: "traditional",
  lockMinutesBeforeKickoff: 15,
};

const profiles: Profile[] = [
  { id: "user-miguel", displayName: "Miguel", avatarColor: "#006a4e", notificationDeadlines: true, notificationLiveScores: false },
  { id: "user-lina", displayName: "Lina", avatarColor: "#d5a021", notificationDeadlines: true, notificationLiveScores: false },
  { id: "user-anna", displayName: "Anna", avatarColor: "#c1121f", notificationDeadlines: true, notificationLiveScores: false },
  { id: "user-oscar", displayName: "Oscar", avatarColor: "#1746a2", notificationDeadlines: true, notificationLiveScores: false },
  { id: "user-dad", displayName: "Dad", avatarColor: "#111827", notificationDeadlines: true, notificationLiveScores: false },
];

const teams: Team[] = [
  { id: "swe", name: "Sweden", shortName: "SWE", iso2: "se", groupName: "Group F" },
  { id: "bra", name: "Brazil", shortName: "BRA", iso2: "br", groupName: "Group F" },
  { id: "col", name: "Colombia", shortName: "COL", iso2: "co", groupName: "Group F" },
  { id: "jpn", name: "Japan", shortName: "JPN", iso2: "jp", groupName: "Group F" },
  { id: "mex", name: "Mexico", shortName: "MEX", iso2: "mx", groupName: "Group A" },
  { id: "can", name: "Canada", shortName: "CAN", iso2: "ca", groupName: "Group A" },
  { id: "nor", name: "Norway", shortName: "NOR", iso2: "no", groupName: "Group A" },
  { id: "usa", name: "United States", shortName: "USA", iso2: "us", groupName: "Group A" },
  { id: "eng", name: "England", shortName: "ENG", iso2: "gb-eng", groupName: "Group B" },
  { id: "fra", name: "France", shortName: "FRA", iso2: "fr", groupName: "Group B" },
  { id: "sen", name: "Senegal", shortName: "SEN", iso2: "sn", groupName: "Group B" },
  { id: "ger", name: "Germany", shortName: "GER", iso2: "de", groupName: "Group B" },
];

const players: Player[] = [
  { id: "player-isak", name: "Alexander Isak", nationality: "Sweden", position: "Attacker" },
  { id: "player-kulusevski", name: "Dejan Kulusevski", nationality: "Sweden", position: "Midfielder" },
  { id: "player-vini", name: "Vinicius Jr.", nationality: "Brazil", position: "Attacker" },
  { id: "player-rodrygo", name: "Rodrygo", nationality: "Brazil", position: "Attacker" },
  { id: "player-mbappe", name: "Kylian Mbappe", nationality: "France", position: "Attacker" },
  { id: "player-griezmann", name: "Antoine Griezmann", nationality: "France", position: "Midfielder" },
  { id: "player-rudiger", name: "Antonio Rudiger", nationality: "Germany", position: "Defender" },
];

const squadMembers: TeamSquadMember[] = [
  { active: true, playerId: "player-isak", position: "Attacker", shirtNumber: 9, teamId: "swe" },
  { active: true, playerId: "player-kulusevski", position: "Midfielder", shirtNumber: 21, teamId: "swe" },
  { active: true, playerId: "player-vini", position: "Attacker", shirtNumber: 7, teamId: "bra" },
  { active: true, playerId: "player-rodrygo", position: "Attacker", shirtNumber: 11, teamId: "bra" },
  { active: true, playerId: "player-mbappe", position: "Attacker", shirtNumber: 10, teamId: "fra" },
  { active: true, playerId: "player-griezmann", position: "Midfielder", shirtNumber: 7, teamId: "fra" },
  { active: true, playerId: "player-rudiger", position: "Defender", shirtNumber: 2, teamId: "ger" },
];

function buildMatches(now: Date): Match[] {
  const day = startOfDay(now);

  return [
    {
      id: "m-swe-bra",
      apiFootballFixtureId: 1001,
      homeTeamId: "swe",
      awayTeamId: "bra",
      stage: "Group stage",
      groupName: "Group F",
      venue: "MetLife Stadium",
      city: "New York/New Jersey",
      kickoffAt: formatISO(addMinutes(now, -63)),
      predictionLockAt: formatISO(addMinutes(now, -78)),
      status: "live",
      providerStatusCode: "2H",
      elapsedMinutes: 63,
      homeScore: 1,
      awayScore: 1,
      lastSyncedAt: formatISO(addMinutes(now, -1)),
    },
    {
      id: "m-mex-jpn",
      apiFootballFixtureId: 1002,
      homeTeamId: "mex",
      awayTeamId: "jpn",
      stage: "Group stage",
      groupName: "Group A",
      venue: "Estadio Azteca",
      city: "Mexico City",
      kickoffAt: formatISO(addMinutes(now, -45)),
      predictionLockAt: formatISO(addMinutes(now, -60)),
      status: "halftime",
      providerStatusCode: "HT",
      elapsedMinutes: 45,
      homeScore: 0,
      awayScore: 0,
      lastSyncedAt: formatISO(addMinutes(now, -2)),
    },
    {
      id: "m-can-nor",
      apiFootballFixtureId: 1003,
      homeTeamId: "can",
      awayTeamId: "nor",
      stage: "Group stage",
      groupName: "Group A",
      venue: "BC Place",
      city: "Vancouver",
      kickoffAt: formatISO(addHours(now, 3)),
      predictionLockAt: formatISO(addMinutes(addHours(now, 3), -15)),
      status: "scheduled",
      providerStatusCode: "NS",
    },
    {
      id: "m-col-jpn",
      apiFootballFixtureId: 1004,
      homeTeamId: "col",
      awayTeamId: "jpn",
      stage: "Group stage",
      groupName: "Group F",
      venue: "SoFi Stadium",
      city: "Los Angeles",
      kickoffAt: formatISO(addHours(now, 6)),
      predictionLockAt: formatISO(addMinutes(addHours(now, 6), -15)),
      status: "scheduled",
      providerStatusCode: "NS",
    },
    {
      id: "m-usa-can",
      apiFootballFixtureId: 1005,
      homeTeamId: "usa",
      awayTeamId: "can",
      stage: "Group stage",
      groupName: "Group A",
      venue: "AT&T Stadium",
      city: "Dallas",
      kickoffAt: formatISO(addHours(day, 30)),
      predictionLockAt: formatISO(addMinutes(addHours(day, 30), -15)),
      status: "scheduled",
      providerStatusCode: "NS",
    },
    {
      id: "m-eng-sen",
      apiFootballFixtureId: 1006,
      homeTeamId: "eng",
      awayTeamId: "sen",
      stage: "Group stage",
      groupName: "Group B",
      venue: "Hard Rock Stadium",
      city: "Miami",
      kickoffAt: formatISO(addHours(day, 33)),
      predictionLockAt: formatISO(addMinutes(addHours(day, 33), -15)),
      status: "scheduled",
      providerStatusCode: "NS",
    },
    {
      id: "m-fra-ger",
      apiFootballFixtureId: 1007,
      homeTeamId: "fra",
      awayTeamId: "ger",
      stage: "Group stage",
      groupName: "Group B",
      venue: "Lumen Field",
      city: "Seattle",
      kickoffAt: formatISO(addHours(day, -6)),
      predictionLockAt: formatISO(addMinutes(addHours(day, -6), -15)),
      status: "finished",
      providerStatusCode: "FT",
      homeScore: 2,
      awayScore: 1,
      winner: "home",
      lastSyncedAt: formatISO(addHours(day, -3)),
    },
  ];
}

function buildEvents(matches: Match[]): MatchEvent[] {
  const events: MatchEvent[] = [
    {
      id: "e-swe-1",
      matchId: "m-swe-bra",
      minute: 18,
      teamId: "swe",
      playerName: "Alexander Isak",
      assistName: "Dejan Kulusevski",
      type: "goal",
    },
    {
      id: "e-bra-1",
      matchId: "m-swe-bra",
      minute: 52,
      teamId: "bra",
      playerName: "Vinicius Jr.",
      assistName: "Rodrygo",
      type: "goal",
    },
    {
      id: "e-bra-card-1",
      matchId: "m-swe-bra",
      minute: 58,
      teamId: "bra",
      playerName: "Casemiro",
      type: "yellow_card",
    },
    {
      id: "e-swe-card-1",
      matchId: "m-swe-bra",
      minute: 61,
      teamId: "swe",
      playerName: "Victor Lindelof",
      type: "yellow_card",
    },
    {
      id: "e-fra-1",
      matchId: "m-fra-ger",
      minute: 22,
      teamId: "fra",
      playerName: "Kylian Mbappe",
      assistName: "Antoine Griezmann",
      type: "goal",
    },
    {
      id: "e-ger-1",
      matchId: "m-fra-ger",
      minute: 64,
      teamId: "ger",
      playerName: "Jamal Musiala",
      type: "goal",
    },
    {
      id: "e-fra-2",
      matchId: "m-fra-ger",
      minute: 81,
      teamId: "fra",
      playerName: "Ousmane Dembele",
      assistName: "Theo Hernandez",
      type: "goal",
    },
    {
      id: "e-ger-card-1",
      matchId: "m-fra-ger",
      minute: 72,
      teamId: "ger",
      playerName: "Antonio Rudiger",
      type: "red_card",
    },
  ];

  return events.filter((event) => matches.some((match) => match.id === event.matchId));
}

function buildPredictions(now: Date): Prediction[] {
  return [
    {
      id: "p1",
      poolId: pool.id,
      matchId: "m-swe-bra",
      userId: "user-miguel",
      predictedResult: "home",
      homeScore: 2,
      awayScore: 1,
      lockedAt: formatISO(addMinutes(now, -78)),
      updatedAt: formatISO(addHours(now, -5)),
    },
    {
      id: "p2",
      poolId: pool.id,
      matchId: "m-swe-bra",
      userId: "user-lina",
      predictedResult: "away",
      homeScore: 1,
      awayScore: 3,
      lockedAt: formatISO(addMinutes(now, -78)),
      updatedAt: formatISO(addHours(now, -7)),
    },
    {
      id: "p3",
      poolId: pool.id,
      matchId: "m-swe-bra",
      userId: "user-anna",
      predictedResult: "draw",
      homeScore: 1,
      awayScore: 1,
      lockedAt: formatISO(addMinutes(now, -78)),
      updatedAt: formatISO(addHours(now, -2)),
    },
    {
      id: "p4",
      poolId: pool.id,
      matchId: "m-mex-jpn",
      userId: "user-miguel",
      predictedResult: "draw",
      homeScore: 1,
      awayScore: 1,
      lockedAt: formatISO(addMinutes(now, -60)),
      updatedAt: formatISO(addHours(now, -3)),
    },
    {
      id: "p5",
      poolId: pool.id,
      matchId: "m-can-nor",
      userId: "user-lina",
      predictedResult: "home",
      homeScore: 2,
      awayScore: 0,
      updatedAt: formatISO(addHours(now, -1)),
    },
    {
      id: "p6",
      poolId: pool.id,
      matchId: "m-col-jpn",
      userId: "user-miguel",
      predictedResult: "home",
      homeScore: 2,
      awayScore: 1,
      updatedAt: formatISO(addHours(now, -2)),
    },
    {
      id: "p7",
      poolId: pool.id,
      matchId: "m-fra-ger",
      userId: "user-miguel",
      predictedResult: "home",
      homeScore: 2,
      awayScore: 1,
      lockedAt: formatISO(addHours(now, -7)),
      updatedAt: formatISO(addHours(now, -24)),
    },
  ];
}

const leaderboard: LeaderboardRow[] = [
  { userId: "user-lina", rank: 1, displayName: "Lina", avatarColor: "#d5a021", points: 18, todayPoints: 5, movement: 2, exactScores: 2, riskyHits: 1 },
  { userId: "user-miguel", rank: 2, displayName: "Miguel", avatarColor: "#006a4e", points: 16, todayPoints: 5, movement: -1, exactScores: 2, riskyHits: 0 },
  { userId: "user-dad", rank: 3, displayName: "Dad", avatarColor: "#111827", points: 14, todayPoints: 3, movement: 1, exactScores: 1, riskyHits: 1 },
  { userId: "user-anna", rank: 4, displayName: "Anna", avatarColor: "#c1121f", points: 12, todayPoints: 4, movement: 0, exactScores: 1, riskyHits: 0 },
  { userId: "user-oscar", rank: 5, displayName: "Oscar", avatarColor: "#1746a2", points: 9, todayPoints: 0, movement: -2, exactScores: 0, riskyHits: 1 },
];

const standings: Record<string, StandingRow[]> = {
  "Group A": [
    { teamId: "mex", played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 2, goalsAgainst: 0, points: 3, qualification: "possible" },
    { teamId: "usa", played: 1, won: 0, drawn: 1, lost: 0, goalsFor: 1, goalsAgainst: 1, points: 1, qualification: "possible" },
    { teamId: "can", played: 1, won: 0, drawn: 1, lost: 0, goalsFor: 1, goalsAgainst: 1, points: 1, qualification: "possible" },
    { teamId: "nor", played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 0, goalsAgainst: 2, points: 0, qualification: "possible" },
  ],
  "Group B": [
    { teamId: "fra", played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 2, goalsAgainst: 1, points: 3, qualification: "possible" },
    { teamId: "eng", played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, qualification: "possible" },
    { teamId: "sen", played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, qualification: "possible" },
    { teamId: "ger", played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 1, goalsAgainst: 2, points: 0, qualification: "possible" },
  ],
  "Group F": [
    { teamId: "swe", played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, qualification: "possible" },
    { teamId: "bra", played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, qualification: "possible" },
    { teamId: "col", played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, qualification: "possible" },
    { teamId: "jpn", played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, qualification: "possible" },
  ],
};

const bonusPickOptions: BonusPickOption[] = [
  { id: "bonus-champion-bra", type: "champion", label: "Brazil", teamId: "bra" },
  { id: "bonus-champion-fra", type: "champion", label: "France", teamId: "fra" },
  { id: "bonus-champion-col", type: "champion", label: "Colombia", teamId: "col" },
  { id: "bonus-finalist-swe", type: "finalist", label: "Sweden", teamId: "swe" },
  { id: "bonus-finalist-eng", type: "finalist", label: "England", teamId: "eng" },
  { id: "bonus-scorer-mbappe", type: "top_scorer", label: "Kylian Mbappe", playerId: "player-mbappe", playerName: "Kylian Mbappe" },
  { id: "bonus-scorer-isak", type: "top_scorer", label: "Alexander Isak", playerId: "player-isak", playerName: "Alexander Isak" },
  { id: "bonus-assists-vini", type: "most_assists", label: "Vinicius Jr.", playerId: "player-vini", playerName: "Vinicius Jr." },
  ...teams.map((team) => ({
    id: `bonus-cards-${team.id}`,
    type: "most_cards_country" as const,
    label: team.name,
    teamId: team.id,
  })),
];

function buildBonusPicks(now: Date): BonusPick[] {
  return [
    {
      id: "bonus-pick-1",
      optionId: "bonus-champion-col",
      poolId: pool.id,
      slot: 1,
      type: "champion",
      updatedAt: formatISO(addHours(now, -18)),
      userId: "user-miguel",
    },
    {
      id: "bonus-pick-2",
      optionId: "bonus-finalist-swe",
      poolId: pool.id,
      slot: 1,
      type: "finalist",
      updatedAt: formatISO(addHours(now, -18)),
      userId: "user-miguel",
    },
    {
      id: "bonus-pick-2b",
      optionId: "bonus-finalist-eng",
      poolId: pool.id,
      slot: 2,
      type: "finalist",
      updatedAt: formatISO(addHours(now, -18)),
      userId: "user-miguel",
    },
    {
      id: "bonus-pick-3",
      optionId: "bonus-scorer-isak",
      poolId: pool.id,
      slot: 1,
      type: "top_scorer",
      updatedAt: formatISO(addHours(now, -18)),
      userId: "user-miguel",
    },
  ];
}

const bonusScoreSnapshots: BonusScoreSnapshot[] = [];

function buildMatchPlayerStats(now: Date): MatchPlayerStat[] {
  return [
    {
      assists: 1,
      cleanSheets: 0,
      goals: 1,
      matchId: "m-swe-bra",
      minutes: 63,
      playerId: "player-isak",
      playerName: "Alexander Isak",
      position: "Attacker",
      redCards: 0,
      saves: 0,
      teamId: "swe",
      updatedAt: formatISO(addMinutes(now, -1)),
      yellowCards: 0,
    },
    {
      assists: 1,
      cleanSheets: 0,
      goals: 1,
      matchId: "m-swe-bra",
      minutes: 63,
      playerId: "player-vini",
      playerName: "Vinicius Jr.",
      position: "Attacker",
      redCards: 0,
      saves: 0,
      teamId: "bra",
      updatedAt: formatISO(addMinutes(now, -1)),
      yellowCards: 1,
    },
    {
      assists: 0,
      cleanSheets: 0,
      goals: 0,
      matchId: "m-fra-ger",
      minutes: 90,
      playerId: "player-rudiger",
      playerName: "Antonio Rudiger",
      position: "Defender",
      redCards: 1,
      saves: 0,
      teamId: "ger",
      updatedAt: formatISO(addHours(now, -3)),
      yellowCards: 0,
    },
  ];
}

function buildPlayerStatSnapshots(stats: MatchPlayerStat[]): TournamentPlayerStatSnapshot[] {
  const grouped = new Map<string, TournamentPlayerStatSnapshot>();

  stats.forEach((stat) => {
    const key = `${stat.teamId}:${stat.playerName}`;
    const current = grouped.get(key);

    if (!current) {
      grouped.set(key, {
        assists: stat.assists,
        cleanSheets: stat.cleanSheets,
        goals: stat.goals,
        playerId: stat.playerId,
        playerName: stat.playerName,
        redCards: stat.redCards,
        saves: stat.saves,
        teamId: stat.teamId,
        updatedAt: stat.updatedAt,
        yellowCards: stat.yellowCards,
      });
      return;
    }

    current.assists += stat.assists;
    current.cleanSheets += stat.cleanSheets;
    current.goals += stat.goals;
    current.redCards += stat.redCards;
    current.saves += stat.saves;
    current.yellowCards += stat.yellowCards;
    current.updatedAt = stat.updatedAt;
  });

  return [...grouped.values()];
}

export function buildMockBootstrapData(): BootstrapData {
  const now = new Date();
  const matches = buildMatches(now);
  const events = buildEvents(matches);
  const matchPlayerStats = buildMatchPlayerStats(now);
  const playerStatSnapshots = buildPlayerStatSnapshots(matchPlayerStats);

  return {
    authMode: "demo",
    generatedAt: formatISO(now),
    currentUserId: "user-miguel",
    currentMemberRole: "admin",
    pool: {
      ...pool,
      bonusLockAt: formatISO(addHours(now, 24)),
    },
    profiles,
    members: profiles.map((profile, index) => ({
      userId: profile.id,
      role: index === 0 ? "admin" : "player",
      joinedAt: formatISO(addHours(now, -72 + index)),
    })),
    teams,
    players,
    squadMembers,
    matches,
    events,
    matchPlayerStats,
    predictions: buildPredictions(now),
    leaderboard,
    standings,
    adminOverrides: [
      {
        createdAt: formatISO(addHours(now, -5)),
        createdBy: "user-miguel",
        id: "override-1",
        matchId: "m-fra-ger",
        overrideType: "match",
        payload: { home_score: 2, away_score: 1, status: "finished" },
        reason: "Verified final score.",
      },
    ],
    bonusPickOptions,
    bonusPicks: buildBonusPicks(now),
    bonusScoreSnapshots,
    playerStatSnapshots,
    categoryLeaderboards: aggregateCategoryLeaderboards({
      events,
      matches,
      playerStats: matchPlayerStats,
      teams,
    }),
    syncRuns: [
      {
        id: "sync-1",
        source: "api-football",
        status: "ok",
        startedAt: formatISO(addMinutes(now, -2)),
        finishedAt: formatISO(addMinutes(now, -1)),
        requestsUsed: 2,
        message: "Live fixtures and events synced.",
      },
      {
        id: "sync-2",
        source: "manual",
        status: "ok",
        startedAt: formatISO(addHours(now, -5)),
        finishedAt: formatISO(addHours(now, -5)),
        requestsUsed: 0,
        message: "Admin verified final score for France vs Germany.",
      },
    ],
  };
}
