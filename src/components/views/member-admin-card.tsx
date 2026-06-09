"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CircleDollarSign } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { bootstrapQueryKey } from "@/lib/api/bootstrap";
import { getProfile } from "@/lib/data/selectors";
import type { BootstrapData } from "@/lib/types";

export function MemberAdminCard({ data }: { data: BootstrapData }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  // Optimistic paid overrides: userId → paid value while the PATCH is in-flight.
  const [paidOverrides, setPaidOverrides] = useState<Record<string, boolean>>({});

  function startEdit(userId: string) {
    const profile = getProfile(data, userId);
    setEditing(userId);
    setName(profile.displayName);
    setColor(profile.avatarColor);
    setMessage("");
  }

  async function togglePaid(userId: string, currentPaid: boolean) {
    const next = !currentPaid;
    setPaidOverrides((prev) => ({ ...prev, [userId]: next }));
    const response = await fetch("/api/admin/members", {
      body: JSON.stringify({ paid: next, poolId: data.pool.id, userId }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    if (!response.ok) {
      setPaidOverrides((prev) => ({ ...prev, [userId]: currentPaid }));
    } else {
      await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
    }
  }

  async function save(userId: string, clearPhoto = false) {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/members", {
      body: JSON.stringify({
        avatarColor: color,
        clearPhoto,
        displayName: name,
        poolId: data.pool.id,
        userId,
      }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setSaving(false);

    if (!response.ok) {
      setMessage(body.error ?? "Could not save.");
      return;
    }

    setMessage("Saved.");
    setEditing(null);
    await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
  }

  return (
    <section className="rounded-lg border border-black/10 bg-white p-4">
      <h2 className="font-black">Members</h2>
      <p className="mt-1 text-xs font-bold text-stone-500">
        Edit a member&apos;s display name or avatar.
      </p>

      <div className="mt-3 space-y-2">
        {data.members.map((member) => {
          const profile = getProfile(data, member.userId);
          const isEditing = editing === member.userId;
          return (
            <div
              className="rounded-md border border-black/10 bg-stone-50 p-2"
              key={member.userId}
            >
              <div className="flex items-center gap-2">
                <Avatar
                  color={profile.avatarColor}
                  imageUrl={profile.avatarUrl}
                  name={profile.displayName}
                />
                <span className="min-w-0 flex-1 truncate font-bold">
                  {profile.displayName}
                </span>
                <span className="rounded bg-stone-200 px-2 py-0.5 text-[10px] font-black uppercase text-stone-600">
                  {member.role}
                </span>
                {(() => {
                  const isPaid = paidOverrides[member.userId] ?? member.paid;
                  return (
                    <button
                      aria-label={isPaid ? "Mark as unpaid" : "Mark as paid"}
                      className={isPaid ? "text-emerald-500" : "text-stone-300 hover:text-stone-400"}
                      onClick={() => togglePaid(member.userId, isPaid)}
                      title={isPaid ? "Paid" : "Not paid"}
                      type="button"
                    >
                      <CircleDollarSign size={18} />
                    </button>
                  );
                })()}
                <button
                  className="text-xs font-black uppercase text-emerald-800"
                  onClick={() => (isEditing ? setEditing(null) : startEdit(member.userId))}
                  type="button"
                >
                  {isEditing ? "Close" : "Edit"}
                </button>
              </div>

              {isEditing ? (
                <div className="mt-2 space-y-2">
                  <input
                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm font-bold"
                    maxLength={40}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Display name"
                    value={name}
                  />
                  <div className="grid grid-cols-[44px_1fr] gap-2">
                    <input
                      aria-label="Avatar color"
                      className="h-10 w-full rounded-md border border-black/15 bg-white p-1"
                      onChange={(event) => setColor(event.target.value)}
                      type="color"
                      value={color}
                    />
                    <input
                      className="rounded-md border border-black/15 bg-white px-3 text-sm font-bold"
                      onChange={(event) => setColor(event.target.value)}
                      value={color}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="h-10 flex-1 rounded-md bg-emerald-950 text-sm font-black text-white disabled:bg-stone-300"
                      disabled={saving}
                      onClick={() => save(member.userId)}
                      type="button"
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                    {profile.avatarUrl ? (
                      <button
                        className="h-10 rounded-md border border-black/15 px-3 text-sm font-black text-red-700"
                        disabled={saving}
                        onClick={() => save(member.userId, true)}
                        type="button"
                      >
                        Clear photo
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {message ? (
        <p className="mt-2 text-sm font-black text-stone-600">{message}</p>
      ) : null}
    </section>
  );
}
