"use client";

import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo } from "react";
import { bootstrapQueryKey } from "@/lib/api/bootstrap";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            gcTime: 1000 * 60 * 60 * 8,
            refetchOnWindowFocus: false,
            staleTime: 1000 * 30,
          },
        },
      }),
    [],
  );

  const persister = useMemo(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    return createSyncStoragePersister({
      key: "world-cup-picks-cache",
      storage: window.localStorage,
    });
  }, []);

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const channel = supabase
      .channel("world-cup-picks-bootstrap")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => {
        void queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "match_events" }, () => {
        void queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "predictions" }, () => {
        void queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "score_snapshots" }, () => {
        void queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "bonus_winners" }, () => {
        void queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "bonus_score_snapshots" }, () => {
        void queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "match_player_stats" }, () => {
        void queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_player_stat_snapshots" }, () => {
        void queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_overrides" }, () => {
        void queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  if (!persister) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        maxAge: 1000 * 60 * 60 * 8,
        persister,
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
