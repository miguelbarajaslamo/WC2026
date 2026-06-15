"use client";

import { useState } from "react";
import { FinalsView } from "@/components/views/finals-view";
import { GroupsView } from "@/components/views/groups-view";
import { useBootstrap } from "@/components/app/use-bootstrap";
import { cn } from "@/lib/cn";

// Groups page with a Groups/Finals tab switcher. The Finals tab is gated to the
// system admin while the bracket is built — everyone else sees only Groups,
// exactly as before (no tab, no hint the Finals view exists).
export function GroupsFinalsView() {
  const { data } = useBootstrap();
  const canSeeFinals = Boolean(data?.currentUserIsSystemAdmin);
  const [tab, setTab] = useState<"finals" | "groups">("groups");

  if (!canSeeFinals) {
    return <GroupsView />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <TabButton
          active={tab === "groups"}
          label="Groups"
          onClick={() => setTab("groups")}
        />
        <TabButton
          active={tab === "finals"}
          label="Finals"
          onClick={() => setTab("finals")}
        />
      </div>

      {tab === "groups" ? <GroupsView /> : <FinalsView />}
    </div>
  );
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "rounded-lg border border-black/10 px-3 py-2.5 text-sm font-black shadow-sm",
        active ? "bg-emerald-950 text-white" : "bg-white text-stone-950",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
