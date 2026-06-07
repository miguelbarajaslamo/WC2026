"use client";

import { useEffect, useState } from "react";
import { formatShortCountdown } from "@/lib/time";

export function Countdown({
  label,
  target,
}: {
  label: string;
  target: string;
}) {
  const [value, setValue] = useState(() => formatShortCountdown(target));

  useEffect(() => {
    const interval = window.setInterval(() => {
      setValue(formatShortCountdown(target));
    }, 1000 * 30);

    return () => window.clearInterval(interval);
  }, [target]);

  return (
    <span className="rounded-md bg-white px-3 py-2 text-right text-stone-950">
      <span className="block font-mono text-lg font-black">{value}</span>
      <span className="block text-[10px] font-black uppercase tracking-wide text-stone-500">
        {label}
      </span>
    </span>
  );
}
