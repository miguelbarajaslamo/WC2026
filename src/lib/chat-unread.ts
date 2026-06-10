// Per-device "last seen" tracking for the pool chat, stored in localStorage.
// Unread = messages newer than this, from someone other than you.

function key(poolId: string) {
  return `chat-last-seen:${poolId}`;
}

export function chatUnreadQueryKey(poolId: string) {
  return ["chat-unread", poolId];
}

// Epoch millis of the newest message you've seen. On first ever read we seed it
// to now, so existing chat history doesn't show up as a wall of unread.
export function getChatLastSeen(poolId: string): number {
  if (typeof window === "undefined") {
    return Date.now();
  }
  const raw = window.localStorage.getItem(key(poolId));
  if (raw) {
    const value = Number(raw);
    return Number.isFinite(value) ? value : Date.now();
  }
  const now = Date.now();
  window.localStorage.setItem(key(poolId), String(now));
  return now;
}

export function setChatLastSeen(poolId: string, timestamp: number) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(key(poolId), String(timestamp));
  }
}
