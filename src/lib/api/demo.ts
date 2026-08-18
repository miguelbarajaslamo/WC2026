import type { SupabaseClient } from "@supabase/supabase-js";
import type { BootstrapData } from "@/lib/types";

// A read-only tour of the real pool for people who have no account (recruiters,
// friends deciding whether to join). It reuses the normal bootstrap path so the
// demo shows real matches, real results and real scoring — only the identities
// are swapped.
//
// Security model: a demo visitor has NO Supabase session. Every write endpoint
// calls getUser() and 401s without one, so read-only needs no extra enforcement
// here. Do not add an endpoint that writes without checking getUser().
export const DEMO_COOKIE = "wcp_demo";

export function isDemoRequest(cookieValue: string | undefined) {
  return cookieValue === "1";
}

// Which seat the tour looks through. Defaults to the operator account so the
// demo needs no configuration beyond what admin access already requires;
// DEMO_USER_ID overrides it if the tour should use a different member.
export async function resolveDemoUserId(
  admin: SupabaseClient,
): Promise<string | null> {
  const explicit = process.env.DEMO_USER_ID?.trim();
  if (explicit) return explicit;

  const seatEmail = process.env.SYSTEM_ADMIN_EMAIL?.trim().toLowerCase();
  if (!seatEmail) return null;

  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error || !data) return null;

  return data.users.find((u) => u.email?.toLowerCase() === seatEmail)?.id ?? null;
}

// The pool members are real people who did not sign up to be part of a public
// portfolio demo. Their picks and points stay (they are what makes the demo
// worth looking at) but their names do not.
const ALIASES = [
  "Robin", "Kim", "Alex", "Sam", "Charlie", "Jo", "Max", "Noa",
  "Ellis", "Frankie", "Harper", "Indigo", "Jules", "Kai", "Lou", "Mika",
  "Nico", "Ola", "Pat", "Quinn", "Reese", "Sasha", "Toni", "Val",
];

// Aliases must stay unique: two identical names in a leaderboard read as a
// rendering bug. Past the end of the list, fall back to a numbered alias.
function aliasAt(index: number) {
  return index < ALIASES.length
    ? ALIASES[index]
    : `Player ${index + 1}`;
}

export function toDemoData(data: BootstrapData, seatUserId: string): BootstrapData {
  const aliasById = new Map<string, string>();
  let next = 0;

  for (const profile of data.profiles) {
    if (profile.id === seatUserId) {
      aliasById.set(profile.id, "You");
      continue;
    }
    aliasById.set(profile.id, aliasAt(next));
    next += 1;
  }

  const rename = (id: string, fallback: string) => aliasById.get(id) ?? fallback;

  return {
    ...data,
    authMode: "demo",
    // The pool carries the organiser's real Swish number and a group name
    // built from a real surname. Neither belongs in a public tour.
    pool: {
      ...data.pool,
      name: "DEMO POOL",
      swishNumber: "",
    },
    currentUserEmail: undefined,
    // Hide the admin surfaces: a visitor should see the pool, not the controls.
    currentUserIsSystemAdmin: false,
    currentMemberRole: "player",
    // Avatars can be real photographs of real people. Drop them and fall back
    // to the generated colour avatars.
    profiles: data.profiles.map((profile) => ({
      ...profile,
      displayName: rename(profile.id, profile.displayName),
      avatarUrl: undefined,
    })),
    leaderboard: data.leaderboard.map((row) => ({
      ...row,
      displayName: rename(row.userId, row.displayName),
      avatarUrl: undefined,
    })),
    // The streaks board is a second place member identities surface. Anything
    // added here later that carries a displayName or avatar needs the same
    // treatment.
    categoryLeaderboards: {
      ...data.categoryLeaderboards,
      userStreaks: data.categoryLeaderboards.userStreaks.map((row) => ({
        ...row,
        displayName: rename(row.userId, row.displayName),
        avatarUrl: undefined,
      })),
    },
  };
}
