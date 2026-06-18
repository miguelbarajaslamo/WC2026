import type {
  Match,
  PoolMember,
  Profile,
  UserStreakCategoryRow,
} from "@/lib/types";

export type StreakScoreSnapshot = {
  match_id?: string | null;
  points: number | string;
  reason: string;
  user_id: string;
};

export type UserStreak = {
  currentStreak: number;
  longestStreak: number;
  userId: string;
};

function numericPoints(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}

function isCorrectSnapshot(snapshot?: StreakScoreSnapshot) {
  if (!snapshot) {
    return false;
  }

  if (snapshot.reason === "incorrect" || snapshot.reason === "not_finished") {
    return false;
  }

  return numericPoints(snapshot.points) > 0;
}

export function buildUserStreaks({
  matches,
  members,
  scoreSnapshots,
}: {
  matches: Match[];
  members: PoolMember[];
  scoreSnapshots: StreakScoreSnapshot[];
}): UserStreak[] {
  const finishedMatches = [...matches]
    .filter((match) => match.status === "finished")
    .sort(
      (left, right) =>
        new Date(left.kickoffAt).getTime() - new Date(right.kickoffAt).getTime(),
    );
  const snapshotsByUserMatch = new Map(
    scoreSnapshots
      .filter((snapshot) => snapshot.match_id)
      .map((snapshot) => [`${snapshot.user_id}:${snapshot.match_id}`, snapshot]),
  );

  return members.map((member) => {
    let currentStreak = 0;
    let longestStreak = 0;

    finishedMatches.forEach((match) => {
      const snapshot = snapshotsByUserMatch.get(`${member.userId}:${match.id}`);

      if (isCorrectSnapshot(snapshot)) {
        currentStreak += 1;
        longestStreak = Math.max(longestStreak, currentStreak);
        return;
      }

      currentStreak = 0;
    });

    return {
      currentStreak,
      longestStreak,
      userId: member.userId,
    };
  });
}

export function buildUserStreakCategoryRows({
  profiles,
  streaks,
}: {
  profiles: Profile[];
  streaks: UserStreak[];
}): UserStreakCategoryRow[] {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  return streaks
    .map((streak) => {
      const profile = profileById.get(streak.userId);

      return {
        avatarColor: profile?.avatarColor ?? "#064e3b",
        avatarUrl: profile?.avatarUrl,
        currentStreak: streak.currentStreak,
        displayName: profile?.displayName ?? "Player",
        longestStreak: streak.longestStreak,
        rank: 0,
        userId: streak.userId,
      };
    })
    .sort(
      (left, right) =>
        right.currentStreak - left.currentStreak ||
        right.longestStreak - left.longestStreak ||
        left.displayName.localeCompare(right.displayName),
    )
    .map((row, index, rows) => ({
      ...row,
      rank:
        index > 0 &&
        row.currentStreak === rows[index - 1].currentStreak &&
        row.longestStreak === rows[index - 1].longestStreak
          ? rows[index - 1].rank
          : index + 1,
    }));
}
