import type { BonusPickType, BootstrapData } from "@/lib/types";

// Look up which pool members picked a given player/country as their special for
// a category. Keys: `${type}:p:${playerId}` for player specials (top scorer,
// most assists) and `${type}:t:${teamId}` for country specials (most cards).
export type SpecialPickers = Map<string, string[]>;

export function specialPlayerKey(type: BonusPickType, playerId: string) {
  return `${type}:p:${playerId}`;
}

export function specialTeamKey(type: BonusPickType, teamId: string) {
  return `${type}:t:${teamId}`;
}

export function buildSpecialPickers(data: BootstrapData): SpecialPickers {
  const optionsById = new Map(data.bonusPickOptions.map((option) => [option.id, option]));
  const nameById = new Map(data.profiles.map((profile) => [profile.id, profile.displayName]));
  const pickers: SpecialPickers = new Map();

  for (const pick of data.bonusPicks) {
    const option = optionsById.get(pick.optionId);
    if (!option) {
      continue;
    }
    const key = option.playerId
      ? specialPlayerKey(pick.type, option.playerId)
      : option.teamId
        ? specialTeamKey(pick.type, option.teamId)
        : null;
    const name = nameById.get(pick.userId);
    if (!key || !name) {
      continue;
    }
    const list = pickers.get(key) ?? [];
    list.push(name);
    pickers.set(key, list);
  }

  for (const list of pickers.values()) {
    list.sort((a, b) => a.localeCompare(b));
  }

  return pickers;
}
