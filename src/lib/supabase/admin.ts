import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

export function createSupabaseAdminClient() {
  return createClient(
    requireEnv("supabaseUrl"),
    requireEnv("supabaseServiceRoleKey"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
