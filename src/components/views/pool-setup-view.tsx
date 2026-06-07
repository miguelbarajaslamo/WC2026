"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, PlusCircle, Ticket } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { LogoutButton } from "@/components/app/logout-button";
import { bootstrapQueryKey } from "@/lib/api/bootstrap";
import { cn } from "@/lib/cn";

type Mode = "create" | "join";

type CreatedPool = { inviteCode: string; inviteUrl: string };

export function PoolSetupView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("create");

  const [poolName, setPoolName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [created, setCreated] = useState<CreatedPool | null>(null);
  const [copied, setCopied] = useState(false);

  async function enterPool() {
    await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
    router.push("/");
    router.refresh();
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    const response = await fetch("/api/pools", {
      body: JSON.stringify({ name: poolName }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      inviteCode?: string;
    };

    setSubmitting(false);

    if (!response.ok || !body.inviteCode) {
      setErrorMessage(body.error ?? "Could not create pool");
      return;
    }

    setCreated({
      inviteCode: body.inviteCode,
      inviteUrl: `${window.location.origin}/invite/${body.inviteCode}`,
    });
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    const response = await fetch("/api/invites/redeem", {
      body: JSON.stringify({ code: joinCode.trim() }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setSubmitting(false);
      setErrorMessage(body.error ?? "Could not join pool");
      return;
    }

    await enterPool();
  }

  async function copyInvite() {
    if (!created) {
      return;
    }

    await navigator.clipboard.writeText(created.inviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (created) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#022c22] px-4 py-10 text-white">
        <div className="w-full max-w-sm rounded-lg bg-white p-5 text-stone-950 shadow-2xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-800">
            Pool created
          </p>
          <h1 className="mt-2 text-2xl font-black">Share your invite</h1>
          <p className="mt-2 text-sm font-bold leading-6 text-stone-600">
            Send this link to family and friends so they can join your pool.
          </p>

          <div className="mt-4 rounded-md border border-black/10 bg-stone-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-stone-500">
              Invite code
            </p>
            <p className="font-mono text-2xl font-black tracking-widest">
              {created.inviteCode}
            </p>
          </div>

          <button
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-black/10 bg-stone-50 px-3 py-3 text-sm font-black"
            onClick={copyInvite}
            type="button"
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? "Copied" : "Copy invite link"}
          </button>

          <button
            className="mt-4 h-12 w-full rounded-md bg-stone-950 text-sm font-black uppercase tracking-wide text-white"
            onClick={enterPool}
            type="button"
          >
            Enter pool
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-[#022c22] px-4 py-10 text-white">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 text-stone-950 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-800">
          WORLD CUP PICKS
        </p>
        <h1 className="mt-2 text-2xl font-black">Set up your pool</h1>
        <p className="mt-2 text-sm font-bold leading-6 text-stone-600">
          Create a new pool to play with friends, or join one you were invited
          to.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-1 rounded-md bg-stone-100 p-1">
          {(["create", "join"] as const).map((value) => (
            <button
              className={cn(
                "flex items-center justify-center gap-2 rounded px-3 py-2 text-sm font-black",
                mode === value
                  ? "bg-white text-stone-950 shadow-sm"
                  : "text-stone-500",
              )}
              key={value}
              onClick={() => {
                setMode(value);
                setErrorMessage("");
              }}
              type="button"
            >
              {value === "create" ? <PlusCircle size={16} /> : <Ticket size={16} />}
              {value === "create" ? "Create" : "Join"}
            </button>
          ))}
        </div>

        {mode === "create" ? (
          <form className="mt-4 space-y-3" onSubmit={handleCreate}>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-stone-500">
                Pool name
              </span>
              <input
                className="mt-1 w-full rounded-md border border-black/10 bg-stone-50 px-3 py-3 text-sm font-bold outline-none"
                onChange={(event) => setPoolName(event.target.value)}
                placeholder="The Barajas Cup"
                required
                value={poolName}
              />
            </label>
            <button
              className="h-12 w-full rounded-md bg-stone-950 text-sm font-black uppercase tracking-wide text-white disabled:bg-stone-300"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Creating" : "Create pool"}
            </button>
          </form>
        ) : (
          <form className="mt-4 space-y-3" onSubmit={handleJoin}>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-stone-500">
                Invite code
              </span>
              <input
                className="mt-1 w-full rounded-md border border-black/10 bg-stone-50 px-3 py-3 text-sm font-bold uppercase tracking-widest outline-none"
                onChange={(event) => setJoinCode(event.target.value)}
                placeholder="ABC1234"
                required
                value={joinCode}
              />
            </label>
            <button
              className="h-12 w-full rounded-md bg-stone-950 text-sm font-black uppercase tracking-wide text-white disabled:bg-stone-300"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Joining" : "Join pool"}
            </button>
          </form>
        )}

        {errorMessage ? (
          <p className="mt-3 text-sm font-bold text-red-700">{errorMessage}</p>
        ) : null}

        <div className="mt-5 border-t border-black/10 pt-4">
          <LogoutButton className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-black text-stone-500" />
        </div>
      </div>
    </div>
  );
}
