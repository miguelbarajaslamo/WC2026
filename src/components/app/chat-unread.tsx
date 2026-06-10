"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useBootstrap } from "@/components/app/use-bootstrap";
import { chatUnreadQueryKey, getChatLastSeen } from "@/lib/chat-unread";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

// Count of unseen chat messages (from others), kept live via realtime. Used to
// badge the header chat icon from anywhere in the app.
function useChatUnread() {
  const queryClient = useQueryClient();
  const { data } = useBootstrap();
  const poolId = data?.pool.id ?? "";
  const currentUserId = data?.currentUserId ?? "";
  const enabled = Boolean(poolId && currentUserId) && data?.authMode !== "demo";

  const query = useQuery({
    enabled,
    queryFn: async () => {
      const since = getChatLastSeen(poolId);
      const supabase = createSupabaseBrowserClient();
      const { count } = await supabase
        .from("pool_messages")
        .select("id", { count: "exact", head: true })
        .eq("pool_id", poolId)
        .neq("user_id", currentUserId)
        .gt("created_at", new Date(since).toISOString());
      return count ?? 0;
    },
    queryKey: chatUnreadQueryKey(poolId),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`chat-unread-${poolId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pool_messages" },
        () => {
          void queryClient.invalidateQueries({ queryKey: chatUnreadQueryKey(poolId) });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, poolId, queryClient]);

  return enabled ? query.data ?? 0 : 0;
}

export function ChatUnreadBadge() {
  const count = useChatUnread();

  if (count <= 0) {
    return null;
  }

  return (
    <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-[20px] place-items-center rounded-full border-2 border-[#022c22] bg-red-500 px-1 text-[10px] font-black leading-none text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}
