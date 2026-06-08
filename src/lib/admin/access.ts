import type { User } from "@supabase/supabase-js";

export const systemAdminEmail = "miguelbarajas@live.se";

export function isSystemAdminUser(user: User) {
  return user.email?.toLowerCase() === systemAdminEmail;
}
