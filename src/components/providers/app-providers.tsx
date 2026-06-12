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
            // Realtime invalidations handle freshness; a longer staleTime
            // avoids redundant refetches between them.
            staleTime: 1000 * 60,
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
      // Persisting serializes the whole cache to localStorage on the main
      // thread — keep it infrequent so live-match bursts don't jank the UI.
      throttleTime: 5000,
    });
  }, []);

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // The sync job writes several tables in quick bursts (a live tick touches
    // matches + events + player stats together). Coalesce the events so a
    // burst causes one bootstrap refetch instead of one per table row.
    let invalidateTimer: ReturnType<typeof setTimeout> | null = null;
    const invalidateSoon = () => {
      if (invalidateTimer) {
        return;
      }
      invalidateTimer = setTimeout(() => {
        invalidateTimer = null;
        void queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
      }, 2000);
    };

    const tables = [
      "matches",
      "match_events",
      "predictions",
      "score_snapshots",
      "standings",
      "bonus_winners",
      "bonus_score_snapshots",
      "match_player_stats",
      "tournament_player_stat_snapshots",
      "admin_overrides",
    ];
    let channel = supabase.channel("world-cup-picks-bootstrap");
    for (const table of tables) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        invalidateSoon,
      );
    }
    channel.subscribe();

    return () => {
      if (invalidateTimer) {
        clearTimeout(invalidateTimer);
      }
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
