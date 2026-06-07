import type { SupabaseClient, User } from "@supabase/supabase-js";

// pool_members.user_id references profiles(id). A profile is normally created
// by the handle_new_user trigger on signup, but accounts created before that
// trigger existed have none — which breaks the foreign key. Ensure one exists
// before writing a membership. Existing profiles are left untouched.
export async function ensureProfile(admin: SupabaseClient, user: User) {
  const metadataName =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name
      : undefined;
  const displayName = metadataName ?? user.email?.split("@")[0] ?? "Player";

  const { error } = await admin
    .from("profiles")
    .upsert(
      { id: user.id, display_name: displayName },
      { onConflict: "id", ignoreDuplicates: true },
    );

  if (error) {
    throw new Error(error.message);
  }
}
