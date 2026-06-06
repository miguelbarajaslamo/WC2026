"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requireEnv } from "@/lib/env";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    requireEnv("supabaseUrl"),
    requireEnv("supabaseAnonKey"),
  );
}
