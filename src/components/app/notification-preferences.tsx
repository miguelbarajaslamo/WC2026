"use client";

import { useQueryClient } from "@tanstack/react-query";
import { BellRing } from "lucide-react";
import { useState } from "react";
import { bootstrapQueryKey } from "@/lib/api/bootstrap";
import { cn } from "@/lib/cn";
import type { Profile } from "@/lib/types";

type PrefKey =
  | "notificationDeadlines"
  | "notificationMatchLocks"
  | "notificationFullTime";

const ROWS: Array<{ body: string; key: PrefKey; title: string }> = [
  {
    body: "When a match is locking soon and you haven't saved a pick.",
    key: "notificationDeadlines",
    title: "Pick reminders",
  },
  {
    body: "A last-chance nudge ~15 min before a match's picks lock.",
    key: "notificationMatchLocks",
    title: "Locking soon",
  },
  {
    body: "The final score when a match finishes.",
    key: "notificationFullTime",
    title: "Full-time scores",
  },
];

export function NotificationPreferences({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<PrefKey, boolean>>({
    notificationDeadlines: profile.notificationDeadlines,
    notificationFullTime: profile.notificationFullTime,
    notificationMatchLocks: profile.notificationMatchLocks,
  });
  const [pending, setPending] = useState<PrefKey | null>(null);
  const [message, setMessage] = useState("");

  async function toggle(key: PrefKey) {
    const next = !values[key];
    setValues((current) => ({ ...current, [key]: next }));
    setPending(key);
    setMessage("");

    try {
      const response = await fetch("/api/profile", {
        body: JSON.stringify({ [key]: next }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setValues((current) => ({ ...current, [key]: !next }));
        setMessage(body.error ?? "Could not save.");
        return;
      }

      await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
    } catch {
      setValues((current) => ({ ...current, [key]: !next }));
      setMessage("Could not save.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="rounded-lg border border-black/10 bg-white p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-md bg-stone-100 text-stone-600">
          <BellRing size={20} />
        </span>
        <div>
          <h2 className="font-black">Notification types</h2>
          <p className="text-sm font-bold text-stone-500">Choose what gets pushed.</p>
        </div>
      </div>

      <div className="mt-3 divide-y divide-black/5">
        {ROWS.map((row) => (
          <div className="flex items-center justify-between gap-3 py-3" key={row.key}>
            <div className="min-w-0">
              <p className="font-black">{row.title}</p>
              <p className="text-sm font-bold text-stone-500">{row.body}</p>
            </div>
            <button
              aria-pressed={values[row.key]}
              className={cn(
                "shrink-0 rounded-md px-3 py-2 text-xs font-black uppercase",
                values[row.key]
                  ? "bg-emerald-950 text-white"
                  : "bg-stone-200 text-stone-600",
              )}
              disabled={pending === row.key}
              onClick={() => toggle(row.key)}
              type="button"
            >
              {values[row.key] ? "On" : "Off"}
            </button>
          </div>
        ))}
      </div>

      {message ? (
        <p className="mt-2 text-sm font-bold text-red-700">{message}</p>
      ) : null}
      <p className="mt-3 text-xs font-bold leading-5 text-stone-500">
        These need notifications enabled above. Match-lock and full-time alerts are
        immediate, so they ignore quiet hours.
      </p>
    </div>
  );
}
