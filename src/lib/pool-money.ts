import { parseISO } from "date-fns";
import type { BootstrapData } from "@/lib/types";

// Whole kronor, grouped Swedish-style: 1234 → "1 234 kr".
export function formatKr(amount: number) {
  return `${Math.round(amount).toLocaleString("sv-SE")} kr`;
}

export type PotInfo = {
  entryFee: number;
  paidCount: number;
  totalMembers: number;
  pot: number;
  swishNumber: string;
  configured: boolean;
};

// The pot is the entry fee times the members marked as paid.
export function getPotInfo(data: BootstrapData): PotInfo {
  const entryFee = data.pool.entryFee;
  const paidCount = data.members.filter((member) => member.paid).length;
  return {
    configured: entryFee > 0,
    entryFee,
    paidCount,
    pot: entryFee * paidCount,
    swishNumber: data.pool.swishNumber,
    totalMembers: data.members.length,
  };
}

export function isCurrentUserPaid(data: BootstrapData) {
  return Boolean(
    data.members.find((member) => member.userId === data.currentUserId)?.paid,
  );
}

// True until the earliest match locks — the deadline to pay the entry fee.
export function isBeforeFirstLock(data: BootstrapData) {
  let firstLock: number | null = null;
  for (const match of data.matches) {
    const time = parseISO(match.predictionLockAt).getTime();
    if (firstLock === null || time < firstLock) {
      firstLock = time;
    }
  }
  return firstLock !== null && firstLock > Date.now();
}

// The Today "Swisha insatsen" nudge shows only to unpaid members, while the
// fee/Swish number are set, and only before the first lock (the pay-by point).
export function shouldNudgeSwish(data: BootstrapData) {
  return (
    data.pool.entryFee > 0 &&
    Boolean(data.pool.swishNumber) &&
    !isCurrentUserPaid(data) &&
    isBeforeFirstLock(data)
  );
}
