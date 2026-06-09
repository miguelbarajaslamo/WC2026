"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Moon } from "lucide-react";
import { useState } from "react";
import { bootstrapQueryKey } from "@/lib/api/bootstrap";
import { cn } from "@/lib/cn";
import { getLocalTimeZone } from "@/lib/time";
import type { Profile } from "@/lib/types";

// Start hours run 0–23; end hours run 1–24 (24 = midnight) so the window is non-empty.
const START_HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const END_HOURS = Array.from({ length: 24 }, (_, index) => index + 1);

function formatHour(hour: number) {
  if (hour === 0 || hour === 24) {
    return "Midnight";
  }
  if (hour === 12) {
    return "Noon";
  }
  const period = hour < 12 ? "AM" : "PM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${period}`;
}

export function QuietHoursPanel({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(profile.quietHoursEnabled);
  const [start, setStart] = useState(profile.quietHoursStart);
  const [end, setEnd] = useState(profile.quietHoursEnd);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const timezone = profile.timezone ?? getLocalTimeZone();
  const dirty =
    enabled !== profile.quietHoursEnabled ||
    start !== profile.quietHoursStart ||
    end !== profile.quietHoursEnd;

  function changeStart(value: number) {
    setStart(value);
    if (value >= end) {
      setEnd(Math.min(value + 1, 24));
    }
  }

  function changeEnd(value: number) {
    setEnd(value);
    if (value <= start) {
      setStart(Math.max(value - 1, 0));
    }
  }

  async function save() {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/profile", {
        body: JSON.stringify({
          quietHoursEnabled: enabled,
          quietHoursEnd: end,
          quietHoursStart: start,
          // Persist the current device timezone so the server can resolve local time.
          timezone: getLocalTimeZone(),
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setMessage(body.error ?? "Could not save quiet hours.");
        return;
      }

      setMessage("Saved.");
      await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
    } catch {
      setMessage("Could not save quiet hours.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-black/10 bg-white p-4">
      <div className="grid grid-cols-[36px_1fr_auto] items-center gap-3">
        <span className="grid size-9 place-items-center rounded-md bg-stone-100 text-stone-600">
          <Moon size={20} />
        </span>
        <span>
          <span className="block font-black">Quiet hours</span>
          <span className="text-sm font-bold text-stone-500">
            Hold reminders until your waking hours.
          </span>
        </span>
        <button
          aria-pressed={enabled}
          className={cn(
            "rounded-md px-3 py-2 text-xs font-black uppercase",
            enabled ? "bg-emerald-950 text-white" : "bg-stone-200 text-stone-600",
          )}
          onClick={() => setEnabled((value) => !value)}
          type="button"
        >
          {enabled ? "On" : "Off"}
        </button>
      </div>

      {enabled ? (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-stone-500">
                From
              </span>
              <select
                className="w-full rounded-md border border-black/15 bg-white px-2 py-2 text-sm font-black"
                onChange={(event) => changeStart(Number(event.target.value))}
                value={start}
              >
                {START_HOURS.map((hour) => (
                  <option key={hour} value={hour}>
                    {formatHour(hour)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-stone-500">
                Until
              </span>
              <select
                className="w-full rounded-md border border-black/15 bg-white px-2 py-2 text-sm font-black"
                onChange={(event) => changeEnd(Number(event.target.value))}
                value={end}
              >
                {END_HOURS.map((hour) => (
                  <option key={hour} value={hour}>
                    {formatHour(hour)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs font-bold leading-5 text-stone-500">
            A reminder due outside this window arrives just before it closes, so you
            still have time to pick. Times use {timezone}.
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-stone-500">{message}</span>
        <button
          className="rounded-md bg-stone-950 px-4 py-2 text-xs font-black uppercase text-white disabled:bg-stone-300 disabled:text-stone-500"
          disabled={saving || !dirty}
          onClick={save}
          type="button"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
