// Client-only, per-device preferences stored in localStorage.

const WARNING_DAYS_KEY = "pick-warning-days";
export const DEFAULT_WARNING_DAYS = 2;

export function getWarningDays(): number {
  if (typeof window === "undefined") {
    return DEFAULT_WARNING_DAYS;
  }
  const value = Number(window.localStorage.getItem(WARNING_DAYS_KEY));
  return Number.isFinite(value) && value >= 1 && value <= 14
    ? value
    : DEFAULT_WARNING_DAYS;
}

export function setWarningDays(days: number) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(WARNING_DAYS_KEY, String(days));
  }
}
