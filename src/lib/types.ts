export type MatchStatus =
  | "scheduled"
  | "live"
  | "halftime"
  | "finished"
  | "postponed"
  | "cancelled";

export type PredictionResult = "home" | "draw" | "away";

export type ScoringMode = "traditional" | "pot";

export type EventType = "goal" | "yellow_card" | "red_card" | "substitution";

export const supportedBonusPickTypes = [
  "champion",
  "finalist",
  "top_scorer",
  "most_assists",
  "most_cards_country",
] as const;

export type BonusPickType = (typeof supportedBonusPickTypes)[number];

export type Team = {
  id: string;
  name: string;
  shortName: string;
  iso2?: string;
  groupName?: string;
  flagUrl?: string;
};

export type Player = {
  id: string;
  name: string;
  nationality?: string;
  photoUrl?: string;
  position?: string;
};

export type TeamSquadMember = {
  active: boolean;
  playerId: string;
  position?: string;
  shirtNumber?: number;
  teamId: string;
};

export type Match = {
  id: string;
  apiFootballFixtureId: number;
  homeTeamId: string;
  awayTeamId: string;
  stage: string;
  groupName?: string;
  venue: string;
  city: string;
  kickoffAt: string;
  predictionLockAt: string;
  status: MatchStatus;
  providerStatusCode: string;
  elapsedMinutes?: number;
  homeScore?: number;
  awayScore?: number;
  winner?: PredictionResult;
  lastSyncedAt?: string;
};

export type MatchEvent = {
  id: string;
  matchId: string;
  minute: number;
  stoppageMinute?: number;
  teamId: string;
  playerName: string;
  assistName?: string;
  type: EventType;
  detail?: string;
};

export type MatchPlayerStat = {
  assists: number;
  cleanSheets: number;
  goals: number;
  matchId: string;
  minutes: number;
  playerId?: string;
  playerName: string;
  position?: string;
  rating?: number;
  redCards: number;
  saves: number;
  teamId: string;
  updatedAt?: string;
  yellowCards: number;
};

export type Prediction = {
  id: string;
  poolId: string;
  matchId: string;
  userId: string;
  predictedResult: PredictionResult;
  homeScore: number;
  awayScore: number;
  lockedAt?: string;
  updatedAt: string;
};

export type Profile = {
  id: string;
  displayName: string;
  avatarColor: string;
  notificationDeadlines: boolean;
  notificationLiveScores: boolean;
};

export type PoolMember = {
  userId: string;
  role: "admin" | "player";
  joinedAt: string;
};

export type Pool = {
  id: string;
  name: string;
  prizeNote: string;
  scoringMode: ScoringMode;
  scoringLockedAt?: string;
  bonusLockAt?: string;
  lockMinutesBeforeKickoff: number;
};

export type LeaderboardRow = {
  userId: string;
  rank: number;
  displayName: string;
  avatarColor: string;
  points: number;
  todayPoints: number;
  movement: number;
  exactScores: number;
  riskyHits: number;
};

export type StandingRow = {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  qualification: "qualified" | "possible" | "out";
};

export type SyncRun = {
  id: string;
  source: string;
  status: "ok" | "warning" | "error";
  startedAt: string;
  finishedAt?: string;
  requestsUsed: number;
  message: string;
};

export type BonusPickOption = {
  id: string;
  type: BonusPickType;
  label: string;
  playerId?: string;
  teamId?: string;
  playerName?: string;
};

export type BonusPick = {
  id: string;
  poolId: string;
  userId: string;
  type: BonusPickType;
  slot: number;
  optionId: string;
  lockedAt?: string;
  updatedAt: string;
};

export type BonusScoreSnapshot = {
  id: string;
  poolId: string;
  userId: string;
  type: BonusPickType;
  slot: number;
  points: number;
  reason: string;
};

export type PlayerCategoryRow = {
  rank: number;
  playerName: string;
  teamId?: string;
  teamName?: string;
  teamShortName?: string;
  iso2?: string;
  value: number;
  updatedAt?: string;
};

export type CountryCardCategoryRow = {
  rank: number;
  teamId: string;
  teamName: string;
  teamShortName: string;
  iso2?: string;
  points: number;
  yellowCards: number;
  redCards: number;
  updatedAt?: string;
};

export type CategoryLeaderboards = {
  topScorers: PlayerCategoryRow[];
  topAssists: PlayerCategoryRow[];
  countryCardPoints: CountryCardCategoryRow[];
};

export type TournamentPlayerStatSnapshot = {
  assists: number;
  cleanSheets: number;
  goals: number;
  playerId?: string;
  playerName: string;
  redCards: number;
  saves: number;
  teamId: string;
  updatedAt?: string;
  yellowCards: number;
};

export type AdminOverride = {
  createdAt: string;
  createdBy?: string;
  id: string;
  matchId?: string;
  overrideType: string;
  payload: Record<string, unknown>;
  reason?: string;
};

export type PushSubscriptionRecord = {
  id: string;
  userId: string;
  endpoint: string;
  userAgent?: string;
  createdAt: string;
  lastSeenAt: string;
};

export type BootstrapData = {
  authMode: "authenticated" | "demo";
  generatedAt: string;
  currentUserId: string;
  currentMemberRole: "admin" | "player";
  pool: Pool;
  profiles: Profile[];
  members: PoolMember[];
  teams: Team[];
  players: Player[];
  squadMembers: TeamSquadMember[];
  matches: Match[];
  events: MatchEvent[];
  matchPlayerStats: MatchPlayerStat[];
  predictions: Prediction[];
  leaderboard: LeaderboardRow[];
  standings: Record<string, StandingRow[]>;
  syncRuns: SyncRun[];
  adminOverrides: AdminOverride[];
  bonusPickOptions: BonusPickOption[];
  bonusPicks: BonusPick[];
  bonusScoreSnapshots: BonusScoreSnapshot[];
  playerStatSnapshots: TournamentPlayerStatSnapshot[];
  categoryLeaderboards: CategoryLeaderboards;
};
