"use client";

import Link from "next/link";
import { Ticket } from "lucide-react";

export function InviteView({ code }: { code: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-[#022c22] px-4 text-white">
      <main className="w-full max-w-sm rounded-lg bg-white p-5 text-stone-950 shadow-2xl">
        <div className="grid size-11 place-items-center rounded-md bg-emerald-950 text-white">
          <Ticket size={22} />
        </div>
        <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-emerald-800">
          Invite
        </p>
        <h1 className="mt-2 text-3xl font-black">Join WORLD CUP PICKS</h1>
        <p className="mt-2 text-sm font-bold leading-6 text-stone-600">
          Invite code <span className="font-mono text-stone-950">{code}</span> will
          be exchanged for pool membership after login.
        </p>
        <Link
          className="mt-5 grid h-12 place-items-center rounded-md bg-stone-950 text-sm font-black uppercase tracking-wide text-white"
          href={`/login?next=/onboarding&invite=${encodeURIComponent(code)}`}
        >
          Continue
        </Link>
      </main>
    </div>
  );
}
