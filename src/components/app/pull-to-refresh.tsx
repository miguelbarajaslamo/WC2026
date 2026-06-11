"use client";

import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useRef, useState } from "react";
import { bootstrapQueryKey } from "@/lib/api/bootstrap";

const TRIGGER_PX = 70;

// Pull down at the very top of the page to refetch the bootstrap data.
// The pull indicator is driven through refs (not state) so dragging doesn't
// re-render the wrapped view on every touch move.
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const pullRef = useRef(0);
  const indicatorRef = useRef<HTMLDivElement>(null);

  function setIndicator(pull: number) {
    pullRef.current = pull;
    const node = indicatorRef.current;
    if (!node) {
      return;
    }
    const progress = Math.min(pull / TRIGGER_PX, 1);
    node.style.opacity = String(progress);
    node.style.transform = `translateY(${Math.min(pull / 2, 48)}px) rotate(${progress * 360}deg)`;
  }

  async function refresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
    setRefreshing(false);
  }

  return (
    <div
      onTouchEnd={() => {
        const shouldRefresh = pullRef.current >= TRIGGER_PX && !refreshing;
        startYRef.current = null;
        setIndicator(0);
        if (shouldRefresh) {
          void refresh();
        }
      }}
      onTouchMove={(event) => {
        if (startYRef.current === null) {
          return;
        }
        if (window.scrollY > 0) {
          setIndicator(0);
          return;
        }
        const dy = event.touches[0].clientY - startYRef.current;
        setIndicator(dy > 0 ? Math.min(dy, 120) : 0);
      }}
      onTouchStart={(event) => {
        startYRef.current = window.scrollY <= 0 ? event.touches[0].clientY : null;
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-[calc(76px+var(--safe-top))] z-30 flex justify-center"
        ref={indicatorRef}
        style={{ opacity: refreshing ? 1 : 0 }}
      >
        <span className="grid size-9 place-items-center rounded-full bg-emerald-950 text-white shadow-lg">
          <RefreshCw className={refreshing ? "animate-spin" : ""} size={18} />
        </span>
      </div>
      {children}
    </div>
  );
}
