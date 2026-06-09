"use client";

import { Bell, Share, SquarePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type OS = "ios" | "android";

function detectOS(): OS {
  if (typeof navigator === "undefined") {
    return "android";
  }
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ? "ios" : "android";
}

const STEPS: Record<
  OS,
  { install: string[]; notifications: string[] }
> = {
  ios: {
    install: [
      "Open this site in Safari.",
      "Tap the Share button (the square with an up-arrow).",
      "Scroll down and tap “Add to Home Screen”, then “Add”.",
    ],
    notifications: [
      "Open WORLD CUP PICKS from your Home Screen (not Safari).",
      "Allow notifications when prompted, or enable them in the app settings.",
      "Requires iOS 16.4+ and the app installed to the Home Screen.",
    ],
  },
  android: {
    install: [
      "Open this site in Chrome.",
      "Tap the menu (⋮) in the top-right.",
      "Tap “Install app” (or “Add to Home screen”).",
    ],
    notifications: [
      "Tap “Enable notifications” in Settings.",
      "Allow notifications when the browser prompts you.",
    ],
  },
};

export function InstallInstructions() {
  const [os, setOs] = useState<OS>("android");
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOs(detectOS()), []);

  const steps = STEPS[os];

  return (
    <section className="rounded-lg border border-black/10 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-black">Install & notifications</h2>
        <div className="flex gap-1 rounded-md bg-stone-100 p-1">
          {(["ios", "android"] as const).map((value) => (
            <button
              className={cn(
                "rounded px-3 py-1 text-xs font-black",
                os === value ? "bg-white text-stone-950 shadow-sm" : "text-stone-500",
              )}
              key={value}
              onClick={() => setOs(value)}
              type="button"
            >
              {value === "ios" ? "iPhone" : "Android"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-black text-stone-950">
            {os === "ios" ? <Share size={16} /> : <SquarePlus size={16} />}
            Add to Home Screen
          </p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm font-bold text-stone-600">
            {steps.install.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
        <div className="border-t border-black/10 pt-3">
          <p className="flex items-center gap-2 text-sm font-black text-stone-950">
            <Bell size={16} />
            Turn on notifications
          </p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm font-bold text-stone-600">
            {steps.notifications.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
