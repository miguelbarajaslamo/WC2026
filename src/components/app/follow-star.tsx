"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

// Follow a match: kickoff, goals, cards, half-time and full-time pushes.
// Follows are per-user rows guarded by RLS, so the browser client writes them
// directly.
export function FollowStar({
  matchId,
  userId,
}: {
  matchId: string;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const queryKey = ["match-follow", matchId];

  const { data: following } = useQuery({
    enabled: Boolean(userId),
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: row } = await supabase
        .from("match_follows")
        .select("match_id")
        .eq("match_id", matchId)
        .eq("user_id", userId)
        .maybeSingle();
      return Boolean(row);
    },
    queryKey,
  });

  async function toggle() {
    if (busy) {
      return;
    }
    setBusy(true);
    const next = !following;
    queryClient.setQueryData(queryKey, next);

    const supabase = createSupabaseBrowserClient();
    const { error } = next
      ? await supabase
          .from("match_follows")
          .upsert({ match_id: matchId, user_id: userId })
      : await supabase
          .from("match_follows")
          .delete()
          .eq("match_id", matchId)
          .eq("user_id", userId);

    if (error) {
      queryClient.setQueryData(queryKey, !next);
    }
    setBusy(false);
  }

  return (
    <button
      aria-label={following ? "Unfollow this match" : "Follow this match"}
      aria-pressed={Boolean(following)}
      className={cn(
        "grid size-10 place-items-center rounded-md ring-1 transition",
        following
          ? "bg-amber-400 text-amber-950 ring-amber-300"
          : "bg-white/10 text-white/70 ring-white/15 hover:text-white",
      )}
      disabled={busy}
      onClick={() => void toggle()}
      title={
        following
          ? "Following: kickoff, goals, cards, half-time, full-time"
          : "Follow for kickoff, goals, cards, half-time, full-time alerts"
      }
      type="button"
    >
      <Star fill={following ? "currentColor" : "none"} size={19} />
    </button>
  );
}
