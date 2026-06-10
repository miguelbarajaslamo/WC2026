"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronRight, Pencil } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { ErrorState, LoadingState } from "@/components/app/data-state";
import { InstallInstructions } from "@/components/app/install-instructions";
import { useBootstrap } from "@/components/app/use-bootstrap";
import { bootstrapQueryKey } from "@/lib/api/bootstrap";
import { getProfile } from "@/lib/data/selectors";

export function PoolView() {
  const { data, error, isLoading } = useBootstrap();

  if (isLoading || !data) {
    return <LoadingState label="Loading pool" />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg bg-[#022c22] p-4 text-white">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
          Private pool
        </p>
        <PoolName
          isOwner={data.currentMemberRole === "admin"}
          name={data.pool.name}
          poolId={data.pool.id}
        />
        <p className="mt-2 text-sm font-bold text-white/70">{data.pool.prizeNote}</p>
      </section>

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <h2 className="font-black">Rules</h2>
        <div className="mt-3 space-y-3 text-sm font-bold text-stone-600">
          <p>Picks lock {data.pool.lockMinutesBeforeKickoff} minutes before kickoff.</p>
          <p>Other players&apos; picks reveal when the match locks.</p>
          <p>
            Traditional scoring: correct winner or draw gives 3 points. Exact
            score adds 3 more, for 6 total.
          </p>
          <p>
            Pot scoring, if selected before lock, splits the match pot among
            correct result picks and adds a 2 point exact-score bonus.
          </p>
          <p>Official scoring mode: {data.pool.scoringMode}.</p>
          <p>
            Tournament specials lock before the first kickoff
            {data.pool.bonusLockAt ? ` (${new Date(data.pool.bonusLockAt).toLocaleString()})` : ""}.
          </p>
          <p>Saved early picks count if you miss the deadline.</p>
        </div>
      </section>

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <h2 className="font-black">Members</h2>
        <div className="mt-3 space-y-3">
          {data.members.map((member) => {
            const profile = getProfile(data, member.userId);
            return (
              <Link
                className="grid grid-cols-[40px_1fr_auto_16px] items-center gap-3 rounded-md p-1 -m-1 hover:bg-stone-50"
                href={`/members/${member.userId}`}
                key={member.userId}
              >
                <Avatar
                  color={profile.avatarColor}
                  imageUrl={profile.avatarUrl}
                  name={profile.displayName}
                />
                <span className="font-bold">{profile.displayName}</span>
                <span className="rounded bg-stone-100 px-2 py-1 text-[10px] font-black uppercase text-stone-500">
                  {member.role}
                </span>
                <ChevronRight className="text-stone-300" size={16} />
              </Link>
            );
          })}
        </div>
      </section>

      <InstallInstructions />
    </div>
  );
}

function PoolName({
  isOwner,
  name,
  poolId,
}: {
  isOwner: boolean;
  name: string;
  poolId: string;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function save() {
    const trimmed = value.trim();
    if (trimmed.length < 2 || saving) {
      return;
    }

    setSaving(true);
    setErrorMessage("");

    const response = await fetch("/api/pools", {
      body: JSON.stringify({ name: trimmed, poolId }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setErrorMessage(payload.error ?? "Could not rename the pool.");
      setSaving(false);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
    setSaving(false);
    setEditing(false);
  }

  if (!editing) {
    return (
      <h2 className="mt-1 flex items-center gap-2 text-2xl font-black">
        {name}
        {isOwner ? (
          <button
            aria-label="Rename pool"
            className="grid size-8 place-items-center rounded-md bg-white/10 text-white/70 ring-1 ring-white/15 hover:text-white"
            onClick={() => {
              setValue(name);
              setEditing(true);
            }}
            type="button"
          >
            <Pencil size={14} />
          </button>
        ) : null}
      </h2>
    );
  }

  return (
    <div className="mt-1">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          className="h-11 w-full rounded-md border border-white/25 bg-white/10 px-3 text-lg font-black text-white outline-none placeholder:text-white/40 focus:border-white/50"
          maxLength={60}
          minLength={2}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void save();
            }
            if (event.key === "Escape") {
              setEditing(false);
            }
          }}
          value={value}
        />
        <button
          className="h-11 shrink-0 rounded-md bg-white px-3 text-xs font-black uppercase text-emerald-950 disabled:opacity-50"
          disabled={saving || value.trim().length < 2}
          onClick={() => void save()}
          type="button"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          className="h-11 shrink-0 rounded-md bg-white/10 px-3 text-xs font-black uppercase text-white ring-1 ring-white/15"
          onClick={() => setEditing(false)}
          type="button"
        >
          Cancel
        </button>
      </div>
      {errorMessage ? (
        <p className="mt-1 text-xs font-bold text-red-300">{errorMessage}</p>
      ) : null}
    </div>
  );
}
