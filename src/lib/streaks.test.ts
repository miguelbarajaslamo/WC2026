import { describe, expect, it } from "vitest";
import { buildUserStreakCategoryRows, buildUserStreaks } from "@/lib/streaks";
import type { Match, PoolMember, Profile } from "@/lib/types";

const members: PoolMember[] = [
  { joinedAt: "2026-01-01T00:00:00.000Z", paid: false, role: "player", userId: "a" },
  { joinedAt: "2026-01-01T00:00:00.000Z", paid: false, role: "player", userId: "b" },
];

const matches = [
  match("m1", "2026-06-11T18:00:00.000Z"),
  match("m2", "2026-06-12T18:00:00.000Z"),
  match("m3", "2026-06-13T18:00:00.000Z"),
  match("m4", "2026-06-14T18:00:00.000Z"),
] satisfies Match[];

function match(id: string, kickoffAt: string): Match {
  return {
    apiFootballFixtureId: Number(id.slice(1)),
    awayScore: 0,
    awayTeamId: "away",
    city: "City",
    homeScore: 1,
    homeTeamId: "home",
    id,
    kickoffAt,
    predictionLockAt: kickoffAt,
    providerStatusCode: "FT",
    stage: "Group stage",
    status: "finished",
    venue: "Venue",
  };
}

describe("buildUserStreaks", () => {
  it("counts consecutive correct picks and treats missed/incorrect picks as breaks", () => {
    const streaks = buildUserStreaks({
      matches,
      members,
      scoreSnapshots: [
        { match_id: "m1", points: 3, reason: "correct_result", user_id: "a" },
        { match_id: "m2", points: 6, reason: "exact_score", user_id: "a" },
        { match_id: "m3", points: 0, reason: "incorrect", user_id: "a" },
        { match_id: "m4", points: 3, reason: "correct_result", user_id: "a" },
        { match_id: "m1", points: 3, reason: "correct_result", user_id: "b" },
        { match_id: "m2", points: 3, reason: "correct_result", user_id: "b" },
        // b misses m3, which breaks the streak.
        { match_id: "m4", points: 3, reason: "correct_result", user_id: "b" },
      ],
    });

    expect(streaks).toEqual([
      { currentStreak: 1, longestStreak: 2, userId: "a" },
      { currentStreak: 1, longestStreak: 2, userId: "b" },
    ]);
  });

  it("sorts category rows by current streak, then longest ever", () => {
    const profiles: Profile[] = [
      {
        avatarColor: "#111",
        displayName: "Anna",
        id: "a",
        notificationDeadlines: true,
        notificationFullTime: false,
        notificationLiveScores: false,
        notificationMatchLocks: false,
        quietHoursEnabled: false,
        quietHoursEnd: 23,
        quietHoursStart: 9,
      },
      {
        avatarColor: "#222",
        displayName: "Bo",
        id: "b",
        notificationDeadlines: true,
        notificationFullTime: false,
        notificationLiveScores: false,
        notificationMatchLocks: false,
        quietHoursEnabled: false,
        quietHoursEnd: 23,
        quietHoursStart: 9,
      },
    ];

    expect(
      buildUserStreakCategoryRows({
        profiles,
        streaks: [
          { currentStreak: 1, longestStreak: 4, userId: "a" },
          { currentStreak: 3, longestStreak: 3, userId: "b" },
        ],
      }).map((row) => row.userId),
    ).toEqual(["b", "a"]);
  });

  it("keeps the same non-zero rank for tied streak rows", () => {
    const profiles: Profile[] = [
      profile("a", "Anna"),
      profile("b", "Bo"),
      profile("c", "Clara"),
      profile("d", "Dee"),
    ];

    expect(
      buildUserStreakCategoryRows({
        profiles,
        streaks: [
          { currentStreak: 3, longestStreak: 5, userId: "a" },
          { currentStreak: 2, longestStreak: 4, userId: "b" },
          { currentStreak: 2, longestStreak: 4, userId: "c" },
          { currentStreak: 1, longestStreak: 4, userId: "d" },
        ],
      }).map((row) => ({ rank: row.rank, userId: row.userId })),
    ).toEqual([
      { rank: 1, userId: "a" },
      { rank: 2, userId: "b" },
      { rank: 2, userId: "c" },
      { rank: 4, userId: "d" },
    ]);
  });
});

function profile(id: string, displayName: string): Profile {
  return {
    avatarColor: "#111",
    displayName,
    id,
    notificationDeadlines: true,
    notificationFullTime: false,
    notificationLiveScores: false,
    notificationMatchLocks: false,
    quietHoursEnabled: false,
    quietHoursEnd: 23,
    quietHoursStart: 9,
  };
}
