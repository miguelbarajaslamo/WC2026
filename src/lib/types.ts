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

export type BonusPickType =
  | "champion"
  | "finalist"
  | "top_scorer"
  | "most_assists"
  | "golden_glove";

export type Team = {
  id: string;
  name: string;
  shortName: string;
  iso2: string;
  groupName: string;
  flagUrl?: string;
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
  source: "api-football" | "manual";
  status: "ok" | "warning" | "error";
  startedAt: string;
  finishedAt: string;
  requestsUsed: number;
  message: string;
};

export type BonusPickOption = {
  id: string;
  type: BonusPickType;
  label: string;
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
  points: number;
  reason: string;
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
  generatedAt: string;
  currentUserId: string;
  pool: Pool;
  profiles: Profile[];
  members: PoolMember[];
  teams: Team[];
  matches: Match[];
  events: MatchEvent[];
  predictions: Prediction[];
  leaderboard: LeaderboardRow[];
  standings: Record<string, StandingRow[]>;
  syncRuns: SyncRun[];
  bonusPickOptions: BonusPickOption[];
  bonusPicks: BonusPick[];
  bonusScoreSnapshots: BonusScoreSnapshot[];
};
