import { specialSlots } from "@/lib/specials";
import type { BootstrapData } from "@/lib/types";

export type TipOption = {
  count: number;
  iso2?: string;
  label: string;
  members: string[];
  optionId: string;
};

export type TipCategory = {
  key: string;
  label: string;
  options: TipOption[];
};

// Per tournament-special slot, rank the picked options by how many pool members
// chose each, and collect those members' display names. Reads the bonus_picks
// already in the bootstrap (all members' picks are present after lock).
export function aggregateTopTips(data: BootstrapData): TipCategory[] {
  const optionsById = new Map(data.bonusPickOptions.map((option) => [option.id, option]));
  const nameById = new Map(data.profiles.map((profile) => [profile.id, profile.displayName]));
  const iso2ByTeam = new Map(data.teams.map((team) => [team.id, team.iso2]));

  return specialSlots.map((slot) => {
    const byOption = new Map<string, TipOption>();

    for (const pick of data.bonusPicks) {
      if (pick.type !== slot.type || pick.slot !== slot.slot) {
        continue;
      }
      const option = optionsById.get(pick.optionId);
      const entry =
        byOption.get(pick.optionId) ??
        {
          count: 0,
          iso2: option?.teamId ? iso2ByTeam.get(option.teamId) : undefined,
          label: option?.label ?? "Unknown",
          members: [],
          optionId: pick.optionId,
        };
      entry.count += 1;
      const name = nameById.get(pick.userId);
      if (name) {
        entry.members.push(name);
      }
      byOption.set(pick.optionId, entry);
    }

    const options = [...byOption.values()].sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label),
    );
    for (const option of options) {
      option.members.sort((a, b) => a.localeCompare(b));
    }

    return { key: `${slot.type}-${slot.slot}`, label: slot.label, options };
  });
}
