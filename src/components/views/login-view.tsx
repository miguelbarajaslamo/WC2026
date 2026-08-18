"use client";

import { Lock, Mail, User } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { cn } from "@/lib/cn";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Mode = "signin" | "signup";

export function LoginView() {
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") ? nextParam : "/";
  const invite = searchParams.get("invite");

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const supabase = createSupabaseBrowserClient();
    const { error: authError } =
      mode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: { data: { display_name: displayName.trim() || undefined } },
          })
        : await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setSubmitting(false);
      setError(authError.message);
      return;
    }

    // Now authenticated — redeem an invite if we arrived with one.
    if (invite) {
      await fetch("/api/invites/redeem", {
        body: JSON.stringify({ code: invite }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }).catch(() => {});
    }

    // Full navigation so the server/proxy pick up the new session cookie.
    window.location.assign(next);
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-[#022c22] px-4 text-white">
      <form
        className="w-full max-w-sm rounded-lg bg-white p-5 text-stone-950 shadow-2xl"
        onSubmit={handleSubmit}
      >
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-800">
          WORLD CUP PICKS
        </p>
        <h1 className="mt-2 text-3xl font-black">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>
        <p className="mt-2 text-sm font-bold leading-6 text-stone-600">
          {mode === "signin"
            ? "Enter your email and password."
            : "Pick a display name, email, and password to join."}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-1 rounded-md bg-stone-100 p-1">
          {(["signin", "signup"] as const).map((value) => (
            <button
              className={cn(
                "rounded px-3 py-2 text-sm font-black",
                mode === value
                  ? "bg-white text-stone-950 shadow-sm"
                  : "text-stone-500",
              )}
              key={value}
              onClick={() => {
                setMode(value);
                setError("");
              }}
              type="button"
            >
              {value === "signin" ? "Sign in" : "Create"}
            </button>
          ))}
        </div>

        {mode === "signup" ? (
          <label className="mt-4 grid grid-cols-[20px_1fr] items-center gap-2 rounded-md border border-black/10 bg-stone-50 px-3 py-3">
            <User size={18} />
            <input
              className="min-w-0 bg-transparent text-sm font-bold outline-none"
              autoComplete="name"
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Display name"
              value={displayName}
            />
          </label>
        ) : null}

        <label className="mt-3 grid grid-cols-[20px_1fr] items-center gap-2 rounded-md border border-black/10 bg-stone-50 px-3 py-3">
          <Mail size={18} />
          <input
            className="min-w-0 bg-transparent text-sm font-bold outline-none"
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            required
            type="email"
            value={email}
          />
        </label>

        <label className="mt-3 grid grid-cols-[20px_1fr] items-center gap-2 rounded-md border border-black/10 bg-stone-50 px-3 py-3">
          <Lock size={18} />
          <input
            className="min-w-0 bg-transparent text-sm font-bold outline-none"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            minLength={6}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password (min 6 characters)"
            required
            type="password"
            value={password}
          />
        </label>

        <button
          className="mt-4 h-12 w-full rounded-md bg-stone-950 text-sm font-black uppercase tracking-wide text-white disabled:bg-stone-300"
          disabled={submitting}
          type="submit"
        >
          {submitting
            ? "Working…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </button>

        {error ? (
          <p className="mt-3 text-sm font-bold text-red-700">{error}</p>
        ) : null}

        <button
          className="mt-4 w-full text-center text-sm font-bold text-stone-500"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError("");
          }}
          type="button"
        >
          {mode === "signin"
            ? "Need an account? Create one"
            : "Already have an account? Sign in"}
        </button>

        <div className="mt-5 border-t border-stone-200 pt-4">
          <a
            className="block w-full rounded-lg border border-stone-300 py-3 text-center text-sm font-bold text-stone-700"
            href="/demo"
          >
            Take a look around first
          </a>
          <p className="mt-2 text-center text-xs font-bold text-stone-500">
            Read-only tour. No account needed.
          </p>
        </div>
      </form>
    </div>
  );
}
