"use client";

import { Mail } from "lucide-react";
import { type FormEvent, useState } from "react";

export function LoginView() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    const response = await fetch("/api/auth/magic-link", {
      body: JSON.stringify({ email }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const body = (await response.json()) as { error?: string };

    setSubmitting(false);
    setMessage(response.ok ? "Magic link sent. Check your email." : body.error ?? "Could not send link.");
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
        <h1 className="mt-2 text-3xl font-black">Sign in</h1>
        <p className="mt-2 text-sm font-bold leading-6 text-stone-600">
          Enter your email to receive a magic link. Auth wiring is ready for Supabase.
        </p>
        <label className="mt-5 grid grid-cols-[20px_1fr] items-center gap-2 rounded-md border border-black/10 bg-stone-50 px-3 py-3">
          <Mail size={18} />
          <input
            className="min-w-0 bg-transparent text-sm font-bold outline-none"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            type="email"
            value={email}
          />
        </label>
        <button
          className="mt-4 h-12 w-full rounded-md bg-stone-950 text-sm font-black uppercase tracking-wide text-white disabled:bg-stone-300"
          disabled={submitting}
          type="submit"
        >
          {submitting ? "Sending" : "Send magic link"}
        </button>
        {message ? (
          <p className="mt-3 text-sm font-bold text-stone-600">{message}</p>
        ) : null}
      </form>
    </div>
  );
}
