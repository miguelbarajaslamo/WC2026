"use client";

import { useState } from "react";
import { LoadingState } from "@/components/app/data-state";
import { useBootstrap } from "@/components/app/use-bootstrap";
import { FinalsView } from "@/components/views/finals-view";
import { GroupsView } from "@/components/views/groups-view";
import { cn } from "@/lib/cn";
import { groupStageComplete } from "@/lib/stages";

export function GroupsFinalsView() {
  const [selectedTab, setSelectedTab] = useState<"finals" | "groups" | null>(null);
  const { data, isLoading } = useBootstrap();
  const defaultFinals = data ? groupStageComplete(data.matches) : false;
  const tab = selectedTab ?? (defaultFinals ? "finals" : "groups");

  if (isLoading || !data) {
    return <LoadingState label="Loading groups" />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <TabButton
          active={tab === "groups"}
          label="Groups"
          onClick={() => setSelectedTab("groups")}
        />
        <TabButton
          active={tab === "finals"}
          label="Finals"
          onClick={() => setSelectedTab("finals")}
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
