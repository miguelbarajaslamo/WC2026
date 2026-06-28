"use client";

import Link from "next/link";
import { Bell, CheckCircle2, ClipboardList, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { InlinePredictionPicker } from "@/components/app/inline-prediction-picker";
import { NotificationOptIn } from "@/components/app/notification-opt-in";
import { ErrorState, LoadingState } from "@/components/app/data-state";
import { BonusPicksPanel } from "@/components/views/bonus-picks-panel";
import { useBootstrap } from "@/components/app/use-bootstrap";
import { getVisibleMatches, isMatchLocked } from "@/lib/data/selectors";
import { getLocalTimeZone } from "@/lib/time";

export function OnboardingView({ invite }: { invite?: string }) {
  const { data, error, isLoading } = useBootstrap();
  const [inviteMessage, setInviteMessage] = useState("");

  useEffect(() => {
    if (!invite) {
      return;
    }

    let cancelled = false;

    async function redeemInvite() {
      setInviteMessage("Joining pool");
      const response = await fetch("/api/invites/redeem", {
        body: JSON.stringify({ code: invite }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body = (await response.json()) as { error?: string; alreadyMember?: boolean };

      if (!cancelled) {
        setInviteMessage(
          response.ok
            ? body.alreadyMember
              ? "Invite already joined"
              : "Invite joined"
            : body.error ?? "Could not redeem invite",
        );
      }
    }

    void redeemInvite();

    return () => {
      cancelled = true;
    };
  }, [invite]);

  if (isLoading || !data) {
    return <LoadingState label="Loading onboarding" />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  const firstOpenMatches = getVisibleMatches(data)
    .filter((match) => !isMatchLocked(match))
    .slice(0, 4);

  return (
    <div className="space-y-5">
      <section className="rounded-lg bg-[#022c22] p-4 text-white">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
          Setup
        </p>
        <h2 className="mt-1 text-2xl font-black">Get ready before kickoff</h2>
        <p className="mt-2 text-sm font-bold leading-6 text-white/70">
          Read the rules, enable reminders, make tournament specials, and fill
          the first batch of match picks.
        </p>
      </section>

      {inviteMessage ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-black text-emerald-950">
          {inviteMessage}
        </section>
      ) : null}

      <section className="grid gap-3">
        <RuleRow
          body="Group-stage winner/draw gives 3 points. Knockout picks choose who advances."
          icon={<Trophy size={20} />}
          title="Traditional scoring"
        />
        <RuleRow
          body="Each match locks 15 minutes before kickoff. Saved early picks count."
          icon={<ClipboardList size={20} />}
          title="Lock rule"
        />
        <RuleRow
          body={`Kickoffs and deadlines display in your device timezone: ${getLocalTimeZone()}.`}
          icon={<CheckCircle2 size={20} />}
          title="Local time"
        />
        <RuleRow
          body="Deadline reminders are optional and require PWA push permission."
          icon={<Bell size={20} />}
          title="Notifications"
        />
      </section>

      <NotificationOptIn />
      <BonusPicksPanel data={data} />

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wide text-stone-500">
            Initial match picks
          </h2>
          <p className="mt-1 text-xs font-bold text-stone-500">
            Start with 0-0 and adjust each score. You can edit until lock.
          </p>
        </div>
        {firstOpenMatches.map((match) => (
          <InlinePredictionPicker
            compact
            data={data}
            key={match.id}
            match={match}
          />
        ))}
      </section>

      <Link
        className="grid h-12 place-items-center rounded-md bg-stone-950 text-sm font-black uppercase tracking-wide text-white"
        href="/"
      >
        Enter app
      </Link>
    </div>
  );
}

function RuleRow({
  body,
  icon,
  title,
}: {
  body: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="grid grid-cols-[36px_1fr] gap-3 rounded-lg border border-black/10 bg-white p-4">
      <span className="grid size-9 place-items-center rounded-md bg-stone-100 text-stone-600">
        {icon}
      </span>
      <span>
        <span className="block font-black">{title}</span>
        <span className="text-sm font-bold leading-6 text-stone-500">{body}</span>
      </span>
    </div>
  );
}
