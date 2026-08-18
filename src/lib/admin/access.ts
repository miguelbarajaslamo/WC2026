import type { User } from "@supabase/supabase-js";

// Server-only. Overrides touch global tournament data (matches, events, stats),
// so this gate is a single operator account rather than a role.
// Fails closed: an unset or empty SYSTEM_ADMIN_EMAIL denies everyone.
export function isSystemAdminEmail(email: string | null | undefined) {
  const adminEmail = process.env.SYSTEM_ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) return false;
  return email?.toLowerCase() === adminEmail;
}

export function isSystemAdminUser(user: User) {
  return isSystemAdminEmail(user.email);
}
