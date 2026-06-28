"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronRight, Coins, Pencil } from "lucide-react";
import { useState } from "react";
import { ClickableAvatar } from "@/components/app/clickable-avatar";
import { ErrorState, LoadingState } from "@/components/app/data-state";
import { InstallInstructions } from "@/components/app/install-instructions";
import { PotSummary } from "@/components/app/pot-summary";
import { useBootstrap } from "@/components/app/use-bootstrap";
import { bootstrapQueryKey } from "@/lib/api/bootstrap";
import { getProfile } from "@/lib/data/selectors";
import { formatKr } from "@/lib/pool-money";
import type { Pool } from "@/lib/types";

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

      <PotSummary data={data} />

      {data.currentMemberRole === "admin" ? (
        <PoolMoneySettings pool={data.pool} />
      ) : null}

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <h2 className="font-black">Rules</h2>
        <div className="mt-3 space-y-3 text-sm font-bold text-stone-600">
          <p>Picks lock {data.pool.lockMinutesBeforeKickoff} minutes before kickoff.</p>
          <p>Other players&apos; picks reveal when the match locks.</p>
          <p>
            Traditional scoring: correct group-stage winner/draw gives 3 points.
            Knockout picks are for who advances. Exact score adds 3 more when
            score prediction is enabled.
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
            const detailHref = `/members/${member.userId}`;
            return (
              <div
                className="grid grid-cols-[40px_1fr_auto_16px] items-center gap-3 rounded-md p-1 -m-1 hover:bg-stone-50"
                key={member.userId}
              >
                <ClickableAvatar
                  color={profile.avatarColor}
                  fallbackHref={detailHref}
                  imageUrl={profile.avatarUrl}
                  name={profile.displayName}
                />
                {/* display:contents lets the link's cells flow into the grid
                    while keeping the avatar button a separate click target. */}
                <Link className="contents" href={detailHref}>
                  <span className="font-bold">{profile.displayName}</span>
                  <span className="rounded bg-stone-100 px-2 py-1 text-[10px] font-black uppercase text-stone-500">
                    {member.role}
                  </span>
                  <ChevronRight className="text-stone-300" size={16} />
                </Link>
              </div>
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

function PoolMoneySettings({ pool }: { pool: Pool }) {
  const queryClient = useQueryClient();
  const [fee, setFee] = useState(String(pool.entryFee || ""));
  const [swish, setSwish] = useState(pool.swishNumber);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const dirty =
    Number(fee || 0) !== pool.entryFee || swish.trim() !== pool.swishNumber;

  async function save() {
    const entryFee = Number(fee || 0);
    if (!Number.isInteger(entryFee) || entryFee < 0) {
      setErrorMessage("Insatsen måste vara ett heltal i kronor.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setMessage("");

    const response = await fetch("/api/pools", {
      body: JSON.stringify({ entryFee, poolId: pool.id, swishNumber: swish.trim() }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setErrorMessage(payload.error ?? "Kunde inte spara.");
      setSaving(false);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
    setMessage("Sparat.");
    setSaving(false);
  }

  return (
    <section className="rounded-lg border border-black/10 bg-white p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-md bg-stone-100 text-stone-600">
          <Coins size={20} />
        </span>
        <div>
          <h2 className="font-black">Pott & betalning</h2>
          <p className="text-sm font-bold text-stone-500">
            Insats per person och Swish-nummer. Du bockar av betalda under Admin.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-stone-500">
            Insats (kr/person)
          </span>
          <input
            className="input"
            inputMode="numeric"
            onChange={(event) => setFee(event.target.value.replace(/[^0-9]/g, ""))}
            placeholder="0"
            value={fee}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-stone-500">
            Swish-nummer
          </span>
          <input
            className="input"
            inputMode="tel"
            onChange={(event) => setSwish(event.target.value)}
            placeholder="123 456 78 90"
            value={swish}
          />
        </label>
      </div>

      <button
        className="mt-3 h-11 w-full rounded-md bg-emerald-950 text-sm font-black text-white disabled:bg-stone-300 disabled:text-stone-500"
        disabled={saving || !dirty}
        onClick={() => void save()}
        type="button"
      >
        {saving ? "Sparar..." : "Spara"}
      </button>

      <p className="mt-2 text-xs font-bold text-stone-500">
        {Number(fee || 0) > 0
          ? `Varje avbockad medlem lägger ${formatKr(Number(fee))} i potten.`
          : "Sätt en insats för att visa potten i topplistan."}
      </p>
      {message ? (
        <p className="mt-1 text-xs font-bold text-emerald-700">{message}</p>
      ) : null}
      {errorMessage ? (
        <p className="mt-1 text-xs font-bold text-red-700">{errorMessage}</p>
      ) : null}
    </section>
  );
}
