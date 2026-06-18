"use client";

import { useState } from "react";
import { FinalsView } from "@/components/views/finals-view";
import { GroupsView } from "@/components/views/groups-view";
import { cn } from "@/lib/cn";

// Groups remains the primary tab; Finals is a secondary bracket projection.
export function GroupsFinalsView() {
  const [tab, setTab] = useState<"finals" | "groups">("groups");

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
